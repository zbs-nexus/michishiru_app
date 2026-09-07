import { randomUUID } from 'node:crypto';
import { createNotFoundError } from '../../shared/utils/errorHandler.js';
import { logInfo } from '../../shared/utils/logger.js';
import * as routeRepository from './repository.js';
import {
  DISTANCE_OVERSHOOT_RATIO,
  FEATURE_KINDS,
  MIN_SPOT_COUNT
} from './constants.js';

/**
 * @description ルート生成のビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを受け取って返す。
 *
 * 外部サービスの呼び出しはすべてRepository層へ委譲し、
 * ここでは呼び出す順序と、目標距離に対する調整の判断のみを持つ。
 */

/**
 * @description 座標をGeoJSONの並び順（経度, 緯度）へ変換する。
 * GeoJSONは緯度経度ではなく経度緯度の順で持つため、ここで明示的に入れ替える。
 * @param {{lat: number, lng: number}} position 座標
 * @returns {number[]} [経度, 緯度] の配列
 */
const toGeoJsonPosition = ({ lat, lng }) => [lng, lat];

/**
 * @description ルートの線とスポットを1つのFeatureCollectionへまとめる。
 * フロントエンドはこれをそのまま地図ライブラリへ渡し、
 * properties.featureKind で描画を振り分ける。
 * @param {object} params 組み立てに使う値
 * @param {{lat: number, lng: number}} params.origin 出発地（現在地）
 * @param {object[]} params.spots 立ち寄るスポットの一覧
 * @param {{lat: number, lng: number}[]} params.waypoints 経路を構成する座標の点
 * @returns {object} GeoJSONのFeatureCollection
 */
const buildGeoJson = ({ origin, spots, waypoints }) => ({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { featureKind: FEATURE_KINDS.ROUTE },
      geometry: {
        type: 'LineString',
        coordinates: waypoints.map(toGeoJsonPosition)
      }
    },
    {
      type: 'Feature',
      properties: { featureKind: FEATURE_KINDS.ORIGIN, name: '現在地' },
      geometry: {
        type: 'Point',
        coordinates: toGeoJsonPosition(origin)
      }
    },
    ...spots.map((spot, index) => ({
      type: 'Feature',
      properties: {
        featureKind: FEATURE_KINDS.SPOT,
        spotId: spot.spotId,
        name: spot.name,
        spotType: spot.spotType,
        // 何番目に立ち寄るかを1始まりで持つ（地図上のラベルに使う）
        visitOrder: index + 1
      },
      geometry: {
        type: 'Point',
        coordinates: toGeoJsonPosition(spot)
      }
    }))
  ]
});

/**
 * @description 実測距離が目標距離を大きく超える場合、末尾のスポットを削って再計算する。
 * AIを再呼び出しせずプログラム側で調整するため、応答時間と費用を抑えられる。
 * @param {object} params 調整に使う値
 * @param {{lat: number, lng: number}} params.origin 出発地
 * @param {object[]} params.spots 立ち寄るスポットの一覧
 * @param {number} params.targetDistance 目標距離（km）
 * @param {object} params.calculated 初回の計算結果
 * @param {object} repository データ取得に使うリポジトリ
 * @returns {Promise<{spots: object[], calculated: object, adjustedCount: number}>} 調整後の内容
 */
const adjustToTargetDistance = async (
  { origin, spots, targetDistance, calculated },
  repository
) => {
  const allowedDistance = targetDistance * DISTANCE_OVERSHOOT_RATIO;

  let remainingSpots = spots;
  let latestCalculated = calculated;
  let adjustedCount = 0;

  while (latestCalculated.distance > allowedDistance && remainingSpots.length > MIN_SPOT_COUNT) {
    remainingSpots = remainingSpots.slice(0, -1);
    latestCalculated = await repository.calculateWalkingRoute({
      origin,
      spots: remainingSpots
    });
    adjustedCount += 1;

    logInfo('目標距離を超えたため経由スポットを削減しました', {
      removedSpotCount: adjustedCount,
      remainingSpotCount: remainingSpots.length,
      distance: latestCalculated.distance,
      allowedDistance: Number(allowedDistance.toFixed(2))
    });
  }

  return { spots: remainingSpots, calculated: latestCalculated, adjustedCount };
};

/**
 * @description 条件からルートを1件生成する
 * @param {object} conditions 生成条件
 * @param {string} conditions.genre ジャンル
 * @param {number} conditions.distance 目標距離（km）
 * @param {{lat: number, lng: number}} conditions.origin 現在地
 * @param {object} [repository] データ取得に使うリポジトリ（テスト時に差し替える）
 * @returns {Promise<object>} 生成したルート
 * @throws {ApplicationError} 周辺にスポットが見つからない場合
 */
export const generateRoute = async (
  { genre, distance, origin },
  repository = routeRepository
) => {
  const searchKeywords = await repository.getSearchKeywords({ genre });

  const candidates = await repository.searchNearbySpots({
    origin,
    genre,
    searchKeywords
  });

  if (candidates.length === 0) {
    throw createNotFoundError('現在地の周辺に条件に合うスポットが見つかりませんでした', {
      genre,
      distance
    });
  }

  const { routeName, story, spots } = await repository.selectSpotsByAi({
    genre,
    distance,
    candidates
  });

  const calculated = await repository.calculateWalkingRoute({ origin, spots });

  const adjusted = await adjustToTargetDistance(
    { origin, spots, targetDistance: distance, calculated },
    repository
  );

  logInfo('ルートを生成しました', {
    candidateCount: candidates.length,
    spotCount: adjusted.spots.length,
    requestedDistance: distance,
    generatedDistance: adjusted.calculated.distance,
    adjustedCount: adjusted.adjustedCount
  });

  return {
    routeId: randomUUID(),
    routeName,
    story,
    distance: adjusted.calculated.distance,
    duration: adjusted.calculated.duration,
    spotCount: adjusted.spots.length,
    origin,
    spots: adjusted.spots,
    geojson: buildGeoJson({
      origin,
      spots: adjusted.spots,
      waypoints: adjusted.calculated.waypoints
    })
  };
};
