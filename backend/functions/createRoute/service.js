import { createNotFoundError } from '../../shared/utils/errorHandler.js';
import { logInfo, logWarn } from '../../shared/utils/logger.js';
import { buildRoutePlanPrompt } from './prompt.js';
import { searchNearbySpots } from './repositories/placesRepository.js';
import { generateRoutePlan } from './repositories/bedrockRepository.js';
import { calculateWalkingRoute } from './repositories/routesRepository.js';
import {
  queryGenreIdByName,
  querySpotCategoryIdsByGenreId
} from './repositories/spotCategoryRepository.js';
import {
  DISTANCE_TOLERANCE_KM,
  DISTANCE_TOLERANCE_RATIO,
  MAX_PROMPT_CANDIDATES,
  MAX_ROUTE_RETRY_COUNT,
  MAX_SEARCH_CATEGORIES,
  MAX_SPOT_COUNT,
  METERS_PER_KM,
  MIN_SPOT_COUNT,
  SEARCH_RADIUS_RANGE_M,
  SEARCH_RADIUS_RATIO
} from './constants.js';

/**
 * @description ルート作成のビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを受け取って返す。
 *
 * 処理の流れ（仕様書 Step 2〜5）:
 * 1. ジャンル名から検索対象のスポットカテゴリを引く（マスタ）
 * 2. カテゴリごとに現在地の周辺スポットを検索し、重複を除いて候補にする（Places）
 * 3. 候補から巡るスポットとストーリーを選定させる（Bedrock）
 * 4. 選定したスポットを結ぶ徒歩経路を計算する（Routes）
 * 5. 目標距離を大きく超える場合はスポットを削って再計算する
 */

/** 既定で使うリポジトリ。テスト時は差し替える */
const defaultRepositories = {
  queryGenreIdByName,
  querySpotCategoryIdsByGenreId,
  searchNearbySpots,
  generateRoutePlan,
  calculateWalkingRoute
};

/**
 * @description 目標距離の許容範囲内かどうかを判定する
 * @param {number} totalDistanceM 算出された総距離（m）
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {boolean} 許容範囲内（目標±1km）の場合はtrue
 */
const isWithinTargetRange = (totalDistanceM, targetDistanceKm) => {
  const targetDistanceM = targetDistanceKm * METERS_PER_KM;
  const toleranceM = DISTANCE_TOLERANCE_KM * METERS_PER_KM;
  return (
    totalDistanceM >= targetDistanceM - toleranceM &&
    totalDistanceM <= targetDistanceM + toleranceM
  );
};

/**
 * @description 目標距離より大幅に短いかどうかを判定する
 * @param {number} totalDistanceM 算出された総距離（m）
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {boolean} 目標距離-1km未満の場合はtrue
 */
const isTooShort = (totalDistanceM, targetDistanceKm) => {
  const targetDistanceM = targetDistanceKm * METERS_PER_KM;
  const toleranceM = DISTANCE_TOLERANCE_KM * METERS_PER_KM;
  return totalDistanceM < targetDistanceM - toleranceM;
};

/**
 * @description 目標距離を許容範囲より超えているかどうかを判定する
 * @param {number} totalDistanceM 算出された総距離（m）
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {boolean} 超過している場合はtrue
 */
const isOverTargetDistance = (totalDistanceM, targetDistanceKm) =>
  totalDistanceM > targetDistanceKm * METERS_PER_KM * DISTANCE_TOLERANCE_RATIO;

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
 * @description ジャンル名から検索対象のスポットカテゴリIDを引く
 * @param {string} genreName ジャンル名
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<string[]>} カテゴリIDの一覧
 * @throws {ApplicationError} ジャンルまたはカテゴリがマスタに存在しない場合
 */
const resolveSpotCategoryIds = async (genreName, repositories) => {
  const genreId = await repositories.queryGenreIdByName(genreName);

  if (genreId === null) {
    throw createNotFoundError(
      `指定されたジャンル（${genreName}）がマスタに登録されていません`,
      { genreName }
    );
  }

  const spotCategoryIds = await repositories.querySpotCategoryIdsByGenreId(genreId);

  if (spotCategoryIds.length === 0) {
    throw createNotFoundError(
      `指定されたジャンル（${genreName}）に紐づくカテゴリ情報が見つかりませんでした`,
      { genreName, genreId }
    );
  }

  logInfo('検索対象のカテゴリを決定しました', { genreName, genreId, spotCategoryIds });

  return spotCategoryIds;
};

/**
 * @description 周辺検索を行うカテゴリを上限数まで絞る。
 * ジャンルに紐づくカテゴリが多いと、その数だけ SearchNearby を並列に呼ぶことになり
 * 生成時間が伸びる。上限を超える場合は毎回ランダムに選び直すことで、生成時間を
 * 抑えつつ、再作成のたびに異なるカテゴリの組み合わせを試せるようにする。
 * @param {string[]} spotCategoryIds ジャンルに紐づく全カテゴリID
 * @returns {string[]} 上限数までのカテゴリID（元が上限以下ならそのまま返す）
 */
const limitSearchCategories = (spotCategoryIds) => {
  if (spotCategoryIds.length <= MAX_SEARCH_CATEGORIES) {
    return spotCategoryIds;
  }

  // Fisher-Yates でシャッフルしてから先頭を採用する
  const shuffled = [...spotCategoryIds];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, MAX_SEARCH_CATEGORIES);
};

/**
 * @description カテゴリごとに周辺スポットを検索し、重複を除いた候補にまとめる。
 *
 * 一部のカテゴリで検索が失敗しても、残りの候補でルートを作れるため処理を続ける。
 * すべて失敗した場合は候補が空になり、呼び出し側で404として扱われる。
 * @param {object} conditions 検索条件
 * @param {string[]} conditions.spotCategoryIds 検索するカテゴリIDの一覧
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {number} conditions.queryRadiusM 周辺検索の半径（m）
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<{name: string, position: number[]}[]>} 重複を除いた候補スポット
 */
const collectCandidateSpots = async (
  { spotCategoryIds, currentLocation, queryRadiusM },
  repositories
) => {
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

  return Array.from(candidateSpotsByName.values());
};

/**
 * @description 条件に合う散歩ルートを作成する
 * @param {object} conditions 作成条件
 * @param {string} conditions.genreName ジャンル名（例: 自然）
 * @param {number} conditions.targetDistanceKm 目標距離（km）
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {object} [repositories] 外部サービスへのアクセス（テスト時に差し替える）
 * @returns {Promise<{routeTitle: string, conceptStory: string, totalDistanceM: number, totalDurationS: number, spots: object[], coordinates: number[][]}>} 作成したルート
 * @throws {ApplicationError} マスタやスポットが見つからない、または外部サービスが失敗した場合
 */
export const createRoute = async (
  { genreName, targetDistanceKm, currentLocation },
  repositories = defaultRepositories
) => {
  const spotCategoryIds = limitSearchCategories(
    await resolveSpotCategoryIds(genreName, repositories)
  );

  const queryRadiusM = resolveQueryRadiusM(targetDistanceKm);

  const candidateSpots = await collectCandidateSpots(
    { spotCategoryIds, currentLocation, queryRadiusM },
    repositories
  );

  if (candidateSpots.length === 0) {
    throw createNotFoundError('周辺に該当するスポットが見つかりませんでした', {
      genreName,
      spotCategoryIds
    });
  }

  // Bedrockへ渡す候補は上限件数までに絞る（トークン削減による生成時間の短縮）
  const promptCandidateSpots = candidateSpots.slice(0, MAX_PROMPT_CANDIDATES);

  logInfo('候補スポットを取得しました', {
    candidateSpotCount: candidateSpots.length,
    promptCandidateSpotCount: promptCandidateSpots.length,
    queryRadiusM
  });

  let retryCount = 0;
  let spots = [];
  let route = null;
  let routeTitle = '';
  let conceptStory = '';

  // 目標距離±1kmの許容範囲内になるまで調整を試みる
  while (retryCount < MAX_ROUTE_RETRY_COUNT) {
    // AIにルート案を生成させる
    const plan = await repositories.generateRoutePlan(
      buildRoutePlanPrompt({
        targetDistanceKm,
        currentLocation,
        candidateSpots: promptCandidateSpots
      })
    );

    routeTitle = plan.routeTitle;
    conceptStory = plan.conceptStory;

    logInfo('ルート案を生成しました', {
      routeTitle: plan.routeTitle,
      spotCount: plan.spots.length,
      retryCount
    });

    spots = plan.spots;
    route = await repositories.calculateWalkingRoute({ currentLocation, spots });

    // 1. 許容範囲内ならそのまま採用
    if (isWithinTargetRange(route.totalDistanceM, targetDistanceKm)) {
      logInfo('目標距離の許容範囲内のルートを作成しました', {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm,
        spotCount: spots.length
      });
      break;
    }

    // 2. 大きく超過している場合はスポットを削って調整
    while (
      isOverTargetDistance(route.totalDistanceM, targetDistanceKm) &&
      spots.length > MIN_SPOT_COUNT
    ) {
      logInfo('目標距離を超えたためスポットを削って再計算します', {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm,
        spotCount: spots.length
      });

      spots = spots.slice(0, -1);
      route = await repositories.calculateWalkingRoute({ currentLocation, spots });

      // 削った結果、許容範囲内に収まったらループ終了
      if (isWithinTargetRange(route.totalDistanceM, targetDistanceKm)) {
        logInfo('スポット削減により許容範囲内のルートを作成しました', {
          totalDistanceM: route.totalDistanceM,
          targetDistanceKm,
          spotCount: spots.length
        });
        break;
      }
    }

    // 許容範囲内に収まったらメインループも終了
    if (isWithinTargetRange(route.totalDistanceM, targetDistanceKm)) {
      break;
    }

    // 3. 距離が短すぎる場合はスポットを追加して再生成
    if (isTooShort(route.totalDistanceM, targetDistanceKm)) {
      if (spots.length >= MAX_SPOT_COUNT) {
        logWarn('スポット数が最大のため、これ以上追加できません', {
          totalDistanceM: route.totalDistanceM,
          targetDistanceKm,
          spotCount: spots.length
        });
        break;
      }

      logInfo('目標距離より短いため、スポットを増やして再生成します', {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm,
        spotCount: spots.length,
        retryCount
      });

      retryCount += 1;
      continue;
    }

    // 4. その他の場合（スポットが最小数で調整不可など）
    logWarn('許容範囲外ですが、これ以上の調整ができません', {
      totalDistanceM: route.totalDistanceM,
      targetDistanceKm,
      spotCount: spots.length
    });
    break;
  }

  // 最終確認：許容範囲外ならエラー
  if (!isWithinTargetRange(route.totalDistanceM, targetDistanceKm)) {
    throw createNotFoundError(
      '目標距離の許容範囲内（±1km）のルートを作成できませんでした',
      {
        totalDistanceM: route.totalDistanceM,
        targetDistanceKm,
        spotCount: spots.length,
        toleranceKm: DISTANCE_TOLERANCE_KM
      }
    );
  }

  return {
    routeTitle,
    conceptStory,
    totalDistanceM: route.totalDistanceM,
    totalDurationS: route.totalDurationS,
    spots: spots.map((spot) => ({
      name: spot.name,
      lng: spot.position[0],
      lat: spot.position[1]
    })),
    coordinates: route.coordinates
  };
};
