import { createNotFoundError } from '../../shared/utils/errorHandler.js';
import { logInfo } from '../../shared/utils/logger.js';
import * as routeRepository from './repository.js';
import { WALKING_MINUTES_PER_KM } from './constants.js';

/**
 * @description ルート取得のビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを受け取って返す。
 */

/**
 * @description 希望距離との差が小さいルートを選ぶ
 * @param {object[]} routes 候補となるルートの一覧
 * @param {number} distance 希望距離（km）
 * @returns {object} 最も希望に近いルート
 */
const selectClosestRoute = (routes, distance) =>
  routes.reduce((closest, candidate) => {
    const closestGap = Math.abs(closest.distance - distance);
    const candidateGap = Math.abs(candidate.distance - distance);

    return candidateGap < closestGap ? candidate : closest;
  });

/**
 * @description 目的が一致するルートを優先して絞り込む
 * @param {object[]} routes 候補となるルートの一覧
 * @param {string} purpose 目的
 * @returns {object[]} 絞り込んだ一覧。一致するものが無い場合は元の一覧
 */
const preferMatchingPurpose = (routes, purpose) => {
  const matched = routes.filter((route) => route.purpose === purpose);

  return matched.length > 0 ? matched : routes;
};

/**
 * @description 距離から所要時間（分）を求める
 * @param {number} distance 距離（km）
 * @returns {number} 所要時間（分）
 */
const calculateDuration = (distance) => Math.round(distance * WALKING_MINUTES_PER_KM);

/**
 * @description 条件に合うルートを1件返す
 * @param {object} conditions 検索条件
 * @param {string} conditions.purpose 目的
 * @param {string} conditions.category カテゴリ
 * @param {number} conditions.distance 希望距離（km）
 * @param {object} [repository] データ取得に使うリポジトリ（テスト時に差し替える）
 * @returns {Promise<object>} 提案するルート
 * @throws {ApplicationError} 条件に合うルートが存在しない場合
 */
export const getRoute = async (
  { purpose, category, distance },
  repository = routeRepository
) => {
  // 希望距離に完全一致するものを優先し、無ければ同カテゴリから最も近いものを選ぶ
  let candidates = await repository.queryRoutesByCategory({ category, distance });

  if (candidates.length === 0) {
    candidates = await repository.queryRoutesByCategoryOnly({ category });
  }

  if (candidates.length === 0) {
    throw createNotFoundError('条件に合うルートが見つかりませんでした', {
      purpose,
      category,
      distance
    });
  }

  const selected = selectClosestRoute(
    preferMatchingPurpose(candidates, purpose),
    distance
  );

  logInfo('ルートを選択しました', {
    routeId: selected.routeId,
    requestedDistance: distance,
    selectedDistance: selected.distance
  });

  return {
    routeId: selected.routeId,
    routeName: selected.routeName,
    description: selected.description,
    distance: selected.distance,
    duration: calculateDuration(selected.distance),
    waypoints: selected.waypoints,
    createdAt: selected.createdAt
  };
};
