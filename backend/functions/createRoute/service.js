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
  DISTANCE_TOLERANCE_RATIO,
  METERS_PER_KM,
  MIN_SPOT_COUNT
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
 * @description 目標距離を許容範囲より超えているかどうかを判定する
 * @param {number} totalDistanceM 算出された総距離（m）
 * @param {number} targetDistanceKm 目標距離（km）
 * @returns {boolean} 超過している場合はtrue
 */
const isOverTargetDistance = (totalDistanceM, targetDistanceKm) =>
  totalDistanceM > targetDistanceKm * METERS_PER_KM * DISTANCE_TOLERANCE_RATIO;

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
 * @description カテゴリごとに周辺スポットを検索し、重複を除いた候補にまとめる。
 *
 * 一部のカテゴリで検索が失敗しても、残りの候補でルートを作れるため処理を続ける。
 * すべて失敗した場合は候補が空になり、呼び出し側で404として扱われる。
 * @param {object} conditions 検索条件
 * @param {string[]} conditions.spotCategoryIds 検索するカテゴリIDの一覧
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {object} repositories データ取得に使うリポジトリ
 * @returns {Promise<{name: string, position: number[]}[]>} 重複を除いた候補スポット
 */
const collectCandidateSpots = async (
  { spotCategoryIds, currentLocation },
  repositories
) => {
  const results = await Promise.allSettled(
    spotCategoryIds.map((spotCategoryId) =>
      repositories.searchNearbySpots({ currentLocation, spotCategoryId })
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
  const spotCategoryIds = await resolveSpotCategoryIds(genreName, repositories);

  const candidateSpots = await collectCandidateSpots(
    { spotCategoryIds, currentLocation },
    repositories
  );

  if (candidateSpots.length === 0) {
    throw createNotFoundError('周辺に該当するスポットが見つかりませんでした', {
      genreName,
      spotCategoryIds
    });
  }

  logInfo('候補スポットを取得しました', { candidateSpotCount: candidateSpots.length });

  const plan = await repositories.generateRoutePlan(
    buildRoutePlanPrompt({ targetDistanceKm, currentLocation, candidateSpots })
  );

  logInfo('ルート案を生成しました', {
    routeTitle: plan.routeTitle,
    spotCount: plan.spots.length
  });

  let spots = plan.spots;
  let route = await repositories.calculateWalkingRoute({ currentLocation, spots });

  // 目標距離を大きく超えた場合は末尾のスポットを削って一度だけ作り直す
  if (
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
  }

  return {
    routeTitle: plan.routeTitle,
    conceptStory: plan.conceptStory,
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
