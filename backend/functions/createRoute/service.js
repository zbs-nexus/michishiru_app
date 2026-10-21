import { createNotFoundError } from '../../shared/utils/errorHandler.js';
import { logInfo, logWarn } from '../../shared/utils/logger.js';
import { calculateDistanceM } from '../../shared/utils/geo.js';
import { buildRoutePlanPrompt } from './prompt.js';
import { searchNearbySpots } from './repositories/placesRepository.js';
import { generateRoutePlan } from './repositories/bedrockRepository.js';
import { calculateWalkingRoute } from './repositories/routesRepository.js';
import {
  queryGenreNumberByGenreId,
  querySpotCategoryIdsByGenreNumber
} from './repositories/spotCategoryRepository.js';
import { listConditions } from './repositories/conditionRepository.js';
import { listReviewSpots } from './repositories/reviewSpotRepository.js';
import {
  BEDROCK_RETRY_TEMPERATURE,
  BEDROCK_TEMPERATURE,
  DISTANCE_CONDITION_PK,
  GENRE_CONDITION_PK,
  TARGET_DISTANCE_RANGE_KM,
  DISTANCE_LOWER_RATIO,
  DISTANCE_UPPER_RATIO,
  MAX_PROMPT_CANDIDATES,
  MAX_PROMPT_REVIEW_CANDIDATES,
  MAX_REVIEW_SPOT_ATTEMPTS,
  MAX_ROUTE_RETRY_COUNT,
  MAX_SEARCH_CATEGORIES,
  MAX_SPOT_COUNT,
  METERS_PER_KM,
  MIN_SPOT_COUNT,
  REVIEW_SPOT_DUPLICATE_RADIUS_M,
  SEARCH_RADIUS_RANGE_M,
  SEARCH_RADIUS_RATIO,
  STRANDED_DISTANCE_THRESHOLD_M
} from './constants.js';

/**
 * @description ルート作成のビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを受け取って返す。
 *
 * 処理の流れ（仕様書 Step 2〜5）:
 * 1. ジャンルIDから検索対象のスポットカテゴリを引く（マスタ）
 * 2. カテゴリごとに現在地の周辺スポットを検索し、重複を除いて候補にする（Places）
 * 3. 候補から巡るスポットとストーリーを選定させる（Bedrock）
 * 4. 選定したスポットを結ぶ徒歩経路を計算する（Routes）
 * 5. 目標距離を大きく超える場合はスポットを削って再計算する
 */

/** 既定で使うリポジトリ。テスト時は差し替える */
const defaultRepositories = {
  queryGenreNumberByGenreId,
  querySpotCategoryIdsByGenreNumber,
  searchNearbySpots,
  generateRoutePlan,
  calculateWalkingRoute,
  listConditions,
  listReviewSpots
};

/**
 * @description [経度, 緯度] の座標を、距離計算に渡す { lng, lat } へ変換する
 * @param {number[]} position [経度, 緯度]
 * @returns {{lng: number, lat: number}} 変換した座標
 */
const toLngLat = (position) => ({ lng: position[0], lat: position[1] });

/**
 * @description 2つの [経度, 緯度] の直線距離（m）を求める。計算できない場合は無限大
 * @param {number[]} from 起点
 * @param {number[]} to 終点
 * @returns {number} 距離（m）
 */
const distanceBetweenM = (from, to) =>
  calculateDistanceM(toLngLat(from), toLngLat(to)) ?? Number.POSITIVE_INFINITY;

/**
 * @description 現在地から選択された距離以内にある口コミの場所を、近い順に集める。
 *
 * 口コミの場所はルートの質を上げる付加的な候補のため、取得に失敗しても
 * ルート作成は止めず、口コミの場所なしで続行する。
 * @param {object} params パラメータ
 * @param {{lat: number, lng: number}} params.currentLocation 現在地
 * @param {number} params.radiusM 候補にする範囲（m）。選択された距離
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<Array<{name: string, position: number[], isReviewSpot: true}>>} 近い順の口コミの場所
 */
const collectReviewCandidateSpots = async ({ currentLocation, radiusM }, repositories) => {
  let reviewSpots = [];

  try {
    reviewSpots = await repositories.listReviewSpots();
  } catch (error) {
    logWarn('口コミの場所を取得できなかったため、口コミの場所なしで続行します', {
      errorMessage: error.message
    });
    return [];
  }

  const origin = [currentLocation.lng, currentLocation.lat];

  return reviewSpots
    .filter(
      (spot) =>
        typeof spot.name === 'string' &&
        spot.name !== '' &&
        Number.isFinite(spot.position?.[0]) &&
        Number.isFinite(spot.position?.[1])
    )
    .map((spot) => ({ spot, distanceM: distanceBetweenM(origin, spot.position) }))
    .filter(({ distanceM }) => distanceM <= radiusM)
    .sort((a, b) => a.distanceM - b.distanceM)
    .map(({ spot }) => ({ name: spot.name, position: spot.position, isReviewSpot: true }));
};

/**
 * @description Bedrockへ渡す候補を組み立てる。
 *
 * - 口コミの場所は近い順に上限件数まで先頭に入れ、候補から漏れないようにする
 * - 口コミの場所と同じ名前、または同じ場所（半径内）にある Places の候補は外す
 *   （同じ場所が2回選ばれるのを防ぐ）
 * - チェーン店は優先順位を下げるため後ろへ回す。上限件数で切ると先に落ちる
 * - プロンプトには選定に必要な目印（口コミ・チェーン）だけを、該当するときに付ける
 * @param {object[]} placeCandidates Places の候補（重複除去済み）
 * @param {object[]} reviewCandidates 口コミの場所の候補（近い順）
 * @returns {object[]} プロンプトへ渡す候補
 */
const buildPromptCandidateSpots = (placeCandidates, reviewCandidates) => {
  const reviewSpots = reviewCandidates.slice(0, MAX_PROMPT_REVIEW_CANDIDATES);
  const reviewNames = new Set(reviewSpots.map((spot) => spot.name));

  const placeSpots = placeCandidates.filter(
    (spot) =>
      !reviewNames.has(spot.name) &&
      !reviewSpots.some(
        (reviewSpot) =>
          distanceBetweenM(reviewSpot.position, spot.position) <= REVIEW_SPOT_DUPLICATE_RADIUS_M
      )
  );

  // 元の並びを保ったまま、チェーン店でない候補を前に寄せる
  const orderedPlaceSpots = [
    ...placeSpots.filter((spot) => spot.isChain !== true),
    ...placeSpots.filter((spot) => spot.isChain === true)
  ];

  return [...reviewSpots, ...orderedPlaceSpots]
    .slice(0, MAX_PROMPT_CANDIDATES)
    .map((spot) => ({
      name: spot.name,
      position: spot.position,
      ...(spot.isReviewSpot === true ? { isReviewSpot: true } : {}),
      ...(spot.isChain === true ? { isChain: true } : {})
    }));
};

/**
 * @description Bedrockが選んだスポットに、口コミの場所かどうかの目印を付け直す。
 * Bedrockの出力は名前と座標だけなので、候補の名前から引き直す。
 * @param {object[]} spots Bedrockが選んだスポット
 * @param {object[]} promptCandidateSpots プロンプトへ渡した候補
 * @returns {object[]} 目印を付けたスポット
 */
const markReviewSpots = (spots, promptCandidateSpots) => {
  const candidateByName = new Map(promptCandidateSpots.map((spot) => [spot.name, spot]));

  return spots.map((spot) => ({
    ...spot,
    isReviewSpot: candidateByName.get(spot.name)?.isReviewSpot === true
  }));
};

/**
 * @description 距離超過の調整で外すスポットを決め、外した一覧を返す。
 * 口コミの場所はできるだけ残すため、最後尾から見て口コミでないスポットを外す。
 * すべて口コミの場所なら最後尾を外す（距離を優先する）。
 * @param {object[]} spots 現在のスポット
 * @returns {object[]} 1か所外したスポット
 */
const removeOneSpotForDistance = (spots) => {
  for (let index = spots.length - 1; index >= 0; index -= 1) {
    if (spots[index].isReviewSpot !== true) {
      return spots.filter((_, position) => position !== index);
    }
  }

  return spots.slice(0, -1);
};

/**
 * @description 経路へ口コミの場所を差し込むときの、遠回りが最も小さい位置を求める。
 * 出発地 → スポット… → 出発地 の周回の各区間に入れた場合の、直線距離の増分で比べる。
 * @param {object[]} spots 現在のスポット
 * @param {number[]} origin 出発地 [経度, 緯度]
 * @param {number[]} position 差し込む場所 [経度, 緯度]
 * @returns {{index: number, detourM: number}} 差し込む位置と遠回りの量
 */
const findBestInsertion = (spots, origin, position) => {
  const loop = [origin, ...spots.map((spot) => spot.position), origin];
  let best = { index: 0, detourM: Number.POSITIVE_INFINITY };

  for (let index = 0; index < loop.length - 1; index += 1) {
    const detourM =
      distanceBetweenM(loop[index], position) +
      distanceBetweenM(position, loop[index + 1]) -
      distanceBetweenM(loop[index], loop[index + 1]);

    if (detourM < best.detourM) {
      best = { index, detourM };
    }
  }

  return best;
};

/**
 * @description ルートが口コミの場所を1か所も通らない場合に、1か所を差し込む。
 *
 * 総距離が条件に沿うことを優先し、差し込んで許容範囲を外れる場合や、
 * 口コミの場所が徒歩で到達できない（経路から大きく外れる）場合は採用しない。
 * 試すのは遠回りが小さい順に、差し込み → 近くの口コミでないスポットとの入れ替え。
 * 経路計算に失敗した場合も、元のルートをそのまま返す（任意の改善のため）。
 * @param {object} params パラメータ
 * @param {object[]} params.spots 現在のスポット
 * @param {object} params.route 現在の経路
 * @param {object[]} params.reviewCandidates 口コミの場所の候補（近い順）
 * @param {{lat: number, lng: number}} params.currentLocation 現在地
 * @param {number} params.targetDistanceKm 目標距離（km）
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<{spots: object[], route: object}>} 口コミの場所を含めたルート（含められなければ元のまま）
 */
const ensureReviewSpot = async (
  { spots, route, reviewCandidates, currentLocation, targetDistanceKm },
  repositories
) => {
  if (reviewCandidates.length === 0 || spots.some((spot) => spot.isReviewSpot === true)) {
    return { spots, route };
  }

  const origin = [currentLocation.lng, currentLocation.lat];
  const spotNames = new Set(spots.map((spot) => spot.name));

  // 遠回りが小さい口コミの場所から試す
  const rankedCandidates = reviewCandidates
    .filter((candidate) => !spotNames.has(candidate.name))
    .map((candidate) => ({
      candidate,
      insertion: findBestInsertion(spots, origin, candidate.position)
    }))
    .sort((a, b) => a.insertion.detourM - b.insertion.detourM);

  // 試す並び：差し込み → 入れ替え（最寄りの口コミでないスポットと）
  const attempts = rankedCandidates.flatMap(({ candidate, insertion }) => {
    const inserted = [...spots];
    inserted.splice(insertion.index, 0, candidate);

    const replaceIndex = spots
      .map((spot, index) => ({
        index,
        distanceM: distanceBetweenM(spot.position, candidate.position)
      }))
      .sort((a, b) => a.distanceM - b.distanceM)[0]?.index;

    const replaced =
      replaceIndex === undefined
        ? null
        : spots.map((spot, index) => (index === replaceIndex ? candidate : spot));

    return [
      { spots: inserted, reviewIndex: insertion.index },
      ...(replaced === null ? [] : [{ spots: replaced, reviewIndex: replaceIndex }])
    ];
  });

  for (const attempt of attempts.slice(0, MAX_REVIEW_SPOT_ATTEMPTS)) {
    let attemptRoute;

    try {
      attemptRoute = await repositories.calculateWalkingRoute({
        currentLocation,
        spots: attempt.spots
      });
    } catch (error) {
      logWarn('口コミの場所を含めた経路を計算できなかったため、元のルートを使います', {
        errorMessage: error.message
      });
      return { spots, route };
    }

    const isReachable =
      (attemptRoute.spotStrayDistancesM[attempt.reviewIndex] ?? 0) <=
      STRANDED_DISTANCE_THRESHOLD_M;

    if (isReachable && isWithinTargetRange(attemptRoute.totalDistanceM, targetDistanceKm)) {
      logInfo('口コミの場所を含めたルートに差し替えました', {
        totalDistanceM: attemptRoute.totalDistanceM,
        targetDistanceKm,
        spotCount: attempt.spots.length
      });
      return { spots: attempt.spots, route: attemptRoute };
    }
  }

  logInfo('総距離を優先し、口コミの場所を通らないルートにしました', {
    reviewCandidateCount: reviewCandidates.length,
    totalDistanceM: route.totalDistanceM,
    targetDistanceKm
  });

  return { spots, route };
};

/**
 * @description 区間ごとの座標列を確かめ、応答に載せる区間の一覧にする。
 *
 * 区間は「出発地→スポット1、…、スポットN→出発地」の順で、数はスポット数+1になる。
 * 数が合わない、または2点未満の区間を含む場合はスポットとの対応を保証できないため、
 * 区間を返さない（フロントは全体の線を1色で描く）。
 * @param {number[][][]|undefined} legCoordinates Repository が返した区間ごとの座標列
 * @param {number} spotCount 巡るスポットの数
 * @returns {Array<{coordinates: number[][]}>} 区間の一覧。確かめられない場合は空配列
 */
const toRouteLegs = (legCoordinates, spotCount) => {
  const legs = Array.isArray(legCoordinates) ? legCoordinates : [];
  const isValid =
    legs.length === spotCount + 1 &&
    legs.every((coordinates) => Array.isArray(coordinates) && coordinates.length >= 2);

  if (!isValid) {
    logWarn('区間の数がスポット数と合わないため、区間ごとの線を返しません', {
      legCount: legs.length,
      spotCount
    });
    return [];
  }

  return legs.map((coordinates) => ({ coordinates }));
};

/**
 * @description 配列をシャッフルした新しい配列を返す（Fisher-Yates）
 * @param {Array} items 元の配列（変更しない）
 * @returns {Array} シャッフルした配列
 */
const shuffleItems = (items) => {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
};

/**
 * @description おまかせ用に、マスタの有効なジャンルから1件以上をランダムに選ぶ。
 * 選ぶ件数に上限は設けず、1〜全件の中からランダムに決める。
 * @param {object[]} conditionItems 検索条件マスタの全項目
 * @returns {{genreId: string, genreName: string}[]} 選んだジャンル
 * @throws {ApplicationError} 有効なジャンルがマスタに無い場合
 */
const pickRandomGenres = (conditionItems) => {
  const genreItems = conditionItems.filter(
    (item) => item.pk === GENRE_CONDITION_PK && item.isActive && item.genreId
  );

  if (genreItems.length === 0) {
    throw createNotFoundError('おまかせで選べるジャンルがマスタに登録されていません');
  }

  const selectCount = Math.floor(Math.random() * genreItems.length) + 1;

  return shuffleItems(genreItems)
    .slice(0, selectCount)
    .map((item) => ({ genreId: item.genreId, genreName: item.genreName ?? item.genreId }));
};

/**
 * @description おまかせ用に、マスタの距離の最小〜最大から1km単位でランダムに選ぶ。
 * APIが受け付ける目標距離の範囲にも収める。
 * @param {object[]} conditionItems 検索条件マスタの全項目
 * @returns {number} 選んだ距離（km、整数）
 * @throws {ApplicationError} 有効な距離がマスタに無い場合
 */
const pickRandomDistanceKm = (conditionItems) => {
  const distancesKm = conditionItems
    .filter((item) => item.pk === DISTANCE_CONDITION_PK && item.isActive)
    .map((item) => Number(item.distanceKm))
    .filter((distanceKm) => Number.isFinite(distanceKm));

  if (distancesKm.length === 0) {
    throw createNotFoundError('おまかせで選べる距離がマスタに登録されていません');
  }

  const minKm = Math.ceil(Math.max(Math.min(...distancesKm), TARGET_DISTANCE_RANGE_KM.min));
  const maxKm = Math.floor(Math.min(Math.max(...distancesKm), TARGET_DISTANCE_RANGE_KM.max));

  if (minKm > maxKm) {
    throw createNotFoundError('おまかせで選べる距離がマスタに登録されていません');
  }

  return minKm + Math.floor(Math.random() * (maxKm - minKm + 1));
};

/**
 * @description 目標距離の許容範囲内かどうかを判定する。
 * 許容範囲は目標距離に対する割合（下限×0.6〜上限×1.4）で決める。
 * @param {number} totalDistanceM 算出された総距離（m）
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {boolean} 許容範囲内の場合はtrue
 */
const isWithinTargetRange = (totalDistanceM, targetDistanceKm) => {
  const targetDistanceM = targetDistanceKm * METERS_PER_KM;
  return (
    totalDistanceM >= targetDistanceM * DISTANCE_LOWER_RATIO &&
    totalDistanceM <= targetDistanceM * DISTANCE_UPPER_RATIO
  );
};

/**
 * @description 目標距離より大幅に短いかどうかを判定する
 * @param {number} totalDistanceM 算出された総距離（m）
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {boolean} 目標距離の下限割合を下回る場合はtrue
 */
const isTooShort = (totalDistanceM, targetDistanceKm) =>
  totalDistanceM < targetDistanceKm * METERS_PER_KM * DISTANCE_LOWER_RATIO;

/**
 * @description 目標距離を許容範囲より超えているかどうかを判定する
 * @param {number} totalDistanceM 算出された総距離（m）
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {boolean} 目標距離の上限割合を上回る場合はtrue
 */
const isOverTargetDistance = (totalDistanceM, targetDistanceKm) =>
  totalDistanceM > targetDistanceKm * METERS_PER_KM * DISTANCE_UPPER_RATIO;

/**
 * @description 目標距離から周辺スポット検索の半径（m）を決める。
 * 出発地へ戻る周回コースでは各スポットは出発地から概ね目標距離の半分より内側に
 * あるため、その距離を半径にして遠方スポットを検索段階で除外する。
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {number} 検索半径（m）。上下限でクランプする
 */
const resolveQueryRadiusM = (targetDistanceKm) => {
  const rawRadiusM = targetDistanceKm * METERS_PER_KM * SEARCH_RADIUS_RATIO;

  return Math.min(
    Math.max(rawRadiusM, SEARCH_RADIUS_RANGE_M.min),
    SEARCH_RADIUS_RANGE_M.max
  );
};

/**
 * @description 英語のジャンルID（genreId）から検索対象のスポットカテゴリIDを引く。
 * ジャンルマスタで英語IDを数値ジャンルキーへ変換し、その値でカテゴリマスタを引く。
 * @param {string} genreId ジャンルID（英語。例: food / nature）
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<string[]>} カテゴリIDの一覧
 * @throws {ApplicationError} ジャンルまたはカテゴリがマスタに存在しない場合
 */
const resolveSpotCategoryIds = async (genreId, repositories) => {
  const genreNumber = await repositories.queryGenreNumberByGenreId(genreId);

  if (genreNumber === null) {
    throw createNotFoundError(
      `指定されたジャンル（${genreId}）がマスタに登録されていません`,
      { genreId }
    );
  }

  const spotCategoryIds =
    await repositories.querySpotCategoryIdsByGenreNumber(genreNumber);

  if (spotCategoryIds.length === 0) {
    throw createNotFoundError(
      `指定されたジャンル（${genreId}）に紐づくカテゴリ情報が見つかりませんでした`,
      { genreId, genreNumber }
    );
  }

  logInfo('検索対象のカテゴリを決定しました', { genreId, genreNumber, spotCategoryIds });

  return spotCategoryIds;
};

/**
 * @description 複数のジャンルIDから検索対象のスポットカテゴリIDをまとめて引く。
 * ジャンルが1つの場合は従来どおりエラーをそのまま投げる。
 * 複数の場合（おまかせ）は、引けないジャンルを飛ばし、1件も引けなければエラーにする。
 * @param {string[]} genreIds ジャンルID（英語）の一覧
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<string[]>} 重複を除いたカテゴリIDの一覧
 * @throws {ApplicationError} カテゴリが1件も見つからない場合
 */
const resolveSpotCategoryIdsForGenres = async (genreIds, repositories) => {
  if (genreIds.length === 1) {
    return resolveSpotCategoryIds(genreIds[0], repositories);
  }

  const results = await Promise.allSettled(
    genreIds.map((genreId) => resolveSpotCategoryIds(genreId, repositories))
  );

  const spotCategoryIds = new Set();

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logWarn('ジャンルのカテゴリを引けなかったため、このジャンルを除いて続行します', {
        genreId: genreIds[index],
        errorMessage: result.reason?.message
      });
      return;
    }

    result.value.forEach((spotCategoryId) => spotCategoryIds.add(spotCategoryId));
  });

  if (spotCategoryIds.size === 0) {
    throw createNotFoundError('おまかせで選んだジャンルに紐づくカテゴリ情報が見つかりませんでした', {
      genreIds
    });
  }

  return Array.from(spotCategoryIds);
};

/**
 * @description 周辺検索を行うカテゴリを上限数まで絞る。
 * ジャンルに紐づくカテゴリが多いと、その数だけ SearchNearby を並列に呼ぶことになり
 * 生成時間が伸びる。上限を超える場合は毎回ランダムに選び直すことで、生成時間を
 * 抑えつつ、再作成のたびに異なるカテゴリの組み合わせを試せるようにする。
 * @param {string[]} spotCategoryIds ジャンルに紐づく全カテゴリID
 * @param {string[]} excludedCategoryIds 除外するカテゴリID（既に使用済みのカテゴリ）
 * @returns {string[]} 上限数までのカテゴリID（元が上限以下ならそのまま返す）
 */
const limitSearchCategories = (spotCategoryIds, excludedCategoryIds = []) => {
  // 除外対象を除いた残りのカテゴリを取得
  const availableCategories = spotCategoryIds.filter(
    (id) => !excludedCategoryIds.includes(id)
  );

  if (availableCategories.length === 0) {
    return [];
  }

  if (availableCategories.length <= MAX_SEARCH_CATEGORIES) {
    return availableCategories;
  }

  // シャッフルしてから先頭を採用する
  return shuffleItems(availableCategories).slice(0, MAX_SEARCH_CATEGORIES);
};

/**
 * @description カテゴリごとに周辺スポットを検索し、重複を除いた候補にまとめる。
 * スポットが見つからなかった場合、残りのカテゴリで再検索を行う。
 *
 * 一部のカテゴリで検索が失敗しても、残りの候補でルートを作れるため処理を続ける。
 * すべて失敗した場合は候補が空になり、呼び出し側で404として扱われる。
 * @param {object} conditions 検索条件
 * @param {string[]} conditions.allSpotCategoryIds ジャンルに紐づく全カテゴリID
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {number} conditions.queryRadiusM 周辺検索の半径（m）
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<{name: string, position: number[]}[]>} 重複を除いた候補スポット
 */
const collectCandidateSpotsWithRetry = async (
  { allSpotCategoryIds, currentLocation, queryRadiusM },
  repositories
) => {
  const usedCategoryIds = [];
  let candidateSpots = [];
  let retryCount = 0;

  // スポットが見つかるか、すべてのカテゴリを試すまで繰り返す
  while (candidateSpots.length === 0 && usedCategoryIds.length < allSpotCategoryIds.length) {
    // 未使用のカテゴリから上限数まで選択
    const spotCategoryIds = limitSearchCategories(allSpotCategoryIds, usedCategoryIds);

    if (spotCategoryIds.length === 0) {
      logInfo('すべてのカテゴリを試しましたが、スポットが見つかりませんでした', {
        totalCategoryCount: allSpotCategoryIds.length,
        usedCategoryCount: usedCategoryIds.length
      });
      break;
    }

    logInfo('カテゴリで周辺スポットを検索します', {
      spotCategoryIds,
      retryCount,
      usedCategoryCount: usedCategoryIds.length,
      totalCategoryCount: allSpotCategoryIds.length
    });

    // 今回使用するカテゴリを記録
    usedCategoryIds.push(...spotCategoryIds);

    const results = await Promise.allSettled(
      spotCategoryIds.map((spotCategoryId) =>
        repositories.searchNearbySpots({ currentLocation, spotCategoryId, queryRadiusM })
      )
    );

    // カテゴリの順序を保ったまま、スポット名で重複を除く
    const candidateSpotsByName = new Map();

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        logWarn('カテゴリ単位の周辺検索に失敗したため、このカテゴリを除いて続行します', {
          spotCategoryId: spotCategoryIds[index],
          errorMessage: result.reason?.message
        });
        return;
      }

      for (const spot of result.value) {
        if (!candidateSpotsByName.has(spot.name)) {
          candidateSpotsByName.set(spot.name, spot);
        }
      }
    });

    candidateSpots = Array.from(candidateSpotsByName.values());

    if (candidateSpots.length === 0) {
      logInfo('スポットが見つからなかったため、別のカテゴリで再検索します', {
        triedCategoryIds: spotCategoryIds,
        remainingCategoryCount: allSpotCategoryIds.length - usedCategoryIds.length
      });
    }

    retryCount += 1;
  }

  return candidateSpots;
};

/**
 * @description 条件に合う散歩ルートを作成する
 * @param {object} conditions 作成条件
 * @param {string} [conditions.genreId] ジャンルID（英語。例: food / nature）。isGenreRandomがtrueの場合は未指定可
 * @param {number} [conditions.targetDistanceKm] 目標距離（km）。isDistanceRandomがtrueの場合は未指定可
 * @param {boolean} [conditions.isGenreRandom] ジャンルをおまかせで選ぶか
 * @param {boolean} [conditions.isDistanceRandom] 距離をおまかせで選ぶか
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {object} [repositories] 外部サービスへのアクセス（テスト時に差し替える）
 * @returns {Promise<{routeTitle: string, conceptStory: string, totalDistanceM: number, totalDurationS: number, spots: object[], coordinates: number[][], legs: Array<{coordinates: number[][]}>, selectedGenreId?: string, selectedGenreName?: string, selectedDistanceKm?: number}>} 作成したルート
 * @throws {ApplicationError} マスタやスポットが見つからない、または外部サービスが失敗した場合
 */
export const createRoute = async (
  { genreId, targetDistanceKm, currentLocation, isGenreRandom = false, isDistanceRandom = false },
  repositories = defaultRepositories
) => {
  // おまかせの項目は、検索条件マスタからランダムに選ぶ
  const conditionItems =
    isGenreRandom || isDistanceRandom ? await repositories.listConditions() : [];

  const selectedGenres = isGenreRandom
    ? pickRandomGenres(conditionItems)
    : [{ genreId, genreName: null }];
  const selectedDistanceKm = isDistanceRandom
    ? pickRandomDistanceKm(conditionItems)
    : targetDistanceKm;
  const selectedGenreId = selectedGenres.map((genre) => genre.genreId).join(',');

  if (isGenreRandom || isDistanceRandom) {
    logInfo('おまかせで条件を選択しました', {
      selectedGenreIds: selectedGenres.map((genre) => genre.genreId),
      selectedDistanceKm
    });
  }

  const allSpotCategoryIds = await resolveSpotCategoryIdsForGenres(
    selectedGenres.map((genre) => genre.genreId),
    repositories
  );

  const queryRadiusM = resolveQueryRadiusM(selectedDistanceKm);

  // 周辺検索（Places）と口コミの場所の取得（DynamoDB）は互いに依存しないため並行して行う
  const [candidateSpots, reviewCandidates] = await Promise.all([
    collectCandidateSpotsWithRetry(
      { allSpotCategoryIds, currentLocation, queryRadiusM },
      repositories
    ),
    collectReviewCandidateSpots(
      { currentLocation, radiusM: selectedDistanceKm * METERS_PER_KM },
      repositories
    )
  ]);

  // Bedrockへ渡す候補は上限件数までに絞る（トークン削減による生成時間の短縮）
  const promptCandidateSpots = buildPromptCandidateSpots(candidateSpots, reviewCandidates);

  if (promptCandidateSpots.length === 0) {
    throw createNotFoundError(
      '周辺にスポットが見つかりません。ジャンルと距離を変更して再検索してください',
      { genreId: selectedGenreId, totalCategoryCount: allSpotCategoryIds.length }
    );
  }

  logInfo('候補スポットを取得しました', {
    candidateSpotCount: candidateSpots.length,
    reviewCandidateSpotCount: reviewCandidates.length,
    promptCandidateSpotCount: promptCandidateSpots.length,
    queryRadiusM
  });

  let retryCount = 0;
  let previousDistanceM = null;
  let spots = [];
  let route = null;
  let routeTitle = '';
  let conceptStory = '';

  // 目標距離の許容範囲内になるまで調整を試みる
  while (retryCount < MAX_ROUTE_RETRY_COUNT) {
    // 再生成時は temperature を上げ、前回の距離を伝えて別の組み合わせを選び直させる
    const temperature =
      retryCount === 0 ? BEDROCK_TEMPERATURE : BEDROCK_RETRY_TEMPERATURE;

    // AIにルート案を生成させる
    const plan = await repositories.generateRoutePlan(
      buildRoutePlanPrompt({
        targetDistanceKm: selectedDistanceKm,
        currentLocation,
        candidateSpots: promptCandidateSpots,
        previousDistanceM
      }),
      temperature
    );

    routeTitle = plan.routeTitle;
    conceptStory = plan.conceptStory;

    logInfo('ルート案を生成しました', {
      routeTitle: plan.routeTitle,
      spotCount: plan.spots.length,
      retryCount
    });

    spots = markReviewSpots(plan.spots, promptCandidateSpots);
    route = await repositories.calculateWalkingRoute({ currentLocation, spots });

    // 次の再生成に備えて、今回の総距離を控える
    previousDistanceM = route.totalDistanceM;

    // 経路から大きく外れたスポット（徒歩到達困難）を除外して再計算する。
    // 除外すると最小スポット数を下回る場合はそのまま残す。
    const reachableSpots = spots.filter(
      (_, index) =>
        (route.spotStrayDistancesM[index] ?? 0) <= STRANDED_DISTANCE_THRESHOLD_M
    );

    if (reachableSpots.length !== spots.length && reachableSpots.length >= MIN_SPOT_COUNT) {
      logInfo('経路から外れたスポットを除外して再計算します', {
        beforeSpotCount: spots.length,
        afterSpotCount: reachableSpots.length
      });

      spots = reachableSpots;
      route = await repositories.calculateWalkingRoute({ currentLocation, spots });
      previousDistanceM = route.totalDistanceM;
    }

    // 1. 許容範囲内ならそのまま採用
    if (isWithinTargetRange(route.totalDistanceM, selectedDistanceKm)) {
      logInfo('目標距離の許容範囲内のルートを作成しました', {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm: selectedDistanceKm,
        spotCount: spots.length
      });
      break;
    }

    // 2. 大きく超過している場合はスポットを削って調整
    while (
      isOverTargetDistance(route.totalDistanceM, selectedDistanceKm) &&
      spots.length > MIN_SPOT_COUNT
    ) {
      logInfo('目標距離を超えたためスポットを削って再計算します', {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm: selectedDistanceKm,
        spotCount: spots.length
      });

      // 口コミの場所はできるだけ残し、口コミでないスポットから外す
      spots = removeOneSpotForDistance(spots);
      route = await repositories.calculateWalkingRoute({ currentLocation, spots });

      // 削った結果、許容範囲内に収まったらループ終了
      if (isWithinTargetRange(route.totalDistanceM, selectedDistanceKm)) {
        logInfo('スポット削減により許容範囲内のルートを作成しました', {
          totalDistanceM: route.totalDistanceM,
          targetDistanceKm,
          spotCount: spots.length
        });
        break;
      }
    }

    // 許容範囲内に収まったらメインループも終了
    if (isWithinTargetRange(route.totalDistanceM, selectedDistanceKm)) {
      break;
    }

    // 3. 距離が短すぎる場合はスポットを追加して再生成
    if (isTooShort(route.totalDistanceM, selectedDistanceKm)) {
      if (spots.length >= MAX_SPOT_COUNT) {
        logWarn('スポット数が最大のため、これ以上追加できません', {
          totalDistanceM: route.totalDistanceM,
          targetDistanceKm: selectedDistanceKm,
          spotCount: spots.length
        });
        break;
      }

      logInfo('目標距離より短いため、スポットを増やして再生成します', {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm: selectedDistanceKm,
        spotCount: spots.length,
        retryCount
      });

      retryCount += 1;
      continue;
    }

    // 4. その他の場合（スポットが最小数で調整不可など）
    logWarn('許容範囲外ですが、これ以上の調整ができません', {
      totalDistanceM: route.totalDistanceM,
      targetDistanceKm: selectedDistanceKm,
      spotCount: spots.length
    });
    break;
  }

  // 最終確認：許容範囲外ならエラー
  if (!isWithinTargetRange(route.totalDistanceM, selectedDistanceKm)) {
    throw createNotFoundError(
      '目標距離に近いルートを作成できませんでした。ジャンルと距離を変更して再検索してください',
      {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm: selectedDistanceKm,
        spotCount: spots.length
      }
    );
  }

  // 口コミの場所を1か所も通らない場合は、総距離が条件に収まる範囲で1か所差し込む
  ({ spots, route } = await ensureReviewSpot(
    {
      spots,
      route,
      reviewCandidates,
      currentLocation,
      targetDistanceKm: selectedDistanceKm
    },
    repositories
  ));

  // おまかせ機能で選択した値をレスポンスに含める
  const response = {
    routeTitle,
    conceptStory,
    totalDistanceM: route.totalDistanceM,
    totalDurationS: route.totalDurationS,
    // マーカーは経路上のスナップ後座標に合わせ、線とマーカーの乖離（飛び地）を防ぐ
    spots: spots.map((spot, index) => {
      const snappedPosition = route.spotSnappedPositions[index] ?? spot.position;

      return {
        name: spot.name,
        lng: snappedPosition[0],
        lat: snappedPosition[1],
        // 地図で星の形に描き分けるための目印
        isReviewSpot: spot.isReviewSpot === true
      };
    }),
    coordinates: route.coordinates,
    // 案内画面で区間ごとに描き分けるための線。最終の spots と route で確かめる
    legs: toRouteLegs(route.legCoordinates, spots.length)
  };

  if (isGenreRandom) {
    response.selectedGenres = selectedGenres;
  }

  if (isDistanceRandom) {
    response.selectedDistanceKm = selectedDistanceKm;
  }

  return response;
};
