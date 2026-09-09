import { createNotFoundError } from '../../shared/utils/errorHandler.js';
import { logInfo } from '../../shared/utils/logger.js';
import { buildRoutePlanPrompt } from './prompt.js';
import { searchNearbySpots } from './repositories/placesRepository.js';
import { generateRoutePlan } from './repositories/bedrockRepository.js';
import { calculateWalkingRoute } from './repositories/routesRepository.js';
import {
  DISTANCE_TOLERANCE_RATIO,
  METERS_PER_KM,
  MIN_SPOT_COUNT
} from './constants.js';

/**
 * @description ルート作成のビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを受け取って返す。
 *
 * 処理の流れ（仕様書 Step 3〜5）:
 * 1. 現在地の周辺からスポット候補を取得する（Places）
 * 2. 候補から巡るスポットとストーリーを選定させる（Bedrock）
 * 3. 選定したスポットを結ぶ徒歩経路を計算する（Routes）
 * 4. 目標距離を大きく超える場合はスポットを削って再計算する
 */

/** 既定で使うリポジトリ。テスト時は差し替える */
const defaultRepositories = {
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
 * @description 条件に合う散歩ルートを作成する
 * @param {object} conditions 作成条件
 * @param {string} conditions.spotCategory 検索するスポットのカテゴリ
 * @param {number} conditions.targetDistanceKm 目標距離（km）
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {object} [repositories] 外部サービスへのアクセス（テスト時に差し替える）
 * @returns {Promise<{routeTitle: string, conceptStory: string, totalDistanceM: number, totalDurationS: number, spots: object[], coordinates: number[][]}>} 作成したルート
 * @throws {ApplicationError} スポットが見つからない、または外部サービスが失敗した場合
 */
export const createRoute = async (
  { spotCategory, targetDistanceKm, currentLocation },
  repositories = defaultRepositories
) => {
  const candidateSpots = await repositories.searchNearbySpots({
    currentLocation,
    spotCategory
  });

  if (candidateSpots.length === 0) {
    throw createNotFoundError('周辺に該当するスポットが見つかりませんでした', {
      spotCategory
    });
  }

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
