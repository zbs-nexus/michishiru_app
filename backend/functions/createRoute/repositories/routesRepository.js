import { CalculateRoutesCommand, GeoRoutesClient } from '@aws-sdk/client-geo-routes';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import {
  AWS_REGION,
  EARTH_RADIUS_M,
  WALKING_METERS_PER_SECOND
} from '../constants.js';

/**
 * @description Amazon Location Service（Routes）から徒歩経路を取得する。
 * 外部サービスへのアクセスと、応答をアプリ形式（座標列・距離・所要時間）へ
 * 変換する処理のみを行い、業務判断は持たない。
 */

/** クライアントの生成は1度だけ行い、呼び出しごとに作らない */
let routesClient = null;

/**
 * @description Routesのクライアントを取得する
 * @returns {GeoRoutesClient} 生成済みのクライアント
 */
const getRoutesClient = () => {
  if (routesClient === null) {
    routesClient = new GeoRoutesClient({ region: AWS_REGION });
  }

  return routesClient;
};

/**
 * @description 2点間の球面距離を求める（ハバーサイン公式）
 * @param {number[]} fromPosition 始点の座標（[経度, 緯度]）
 * @param {number[]} toPosition 終点の座標（[経度, 緯度]）
 * @returns {number} 距離（m）
 */
const calculateHaversineDistanceM = (fromPosition, toPosition) => {
  const toRadian = Math.PI / 180;
  const latDiff = (toPosition[1] - fromPosition[1]) * toRadian;
  const lngDiff = (toPosition[0] - fromPosition[0]) * toRadian;
  const fromLat = fromPosition[1] * toRadian;
  const toLat = toPosition[1] * toRadian;

  const halfChordSquared =
    Math.sin(latDiff / 2) ** 2 +
    Math.sin(lngDiff / 2) ** 2 * Math.cos(fromLat) * Math.cos(toLat);

  return (
    EARTH_RADIUS_M *
    2 *
    Math.atan2(Math.sqrt(halfChordSquared), Math.sqrt(1 - halfChordSquared))
  );
};

/**
 * @description 応答から経路の座標列を取り出す。
 * 座標が得られない場合は、現在地とスポットを直線で結んだ座標列で代替する。
 * @param {object|null} route Routesが返した経路
 * @param {object} fallback 代替に使う情報
 * @param {number[]} fallback.originPosition 出発地の座標（[経度, 緯度]）
 * @param {object[]} fallback.spots 経由するスポットの一覧
 * @returns {number[][]} [経度, 緯度] の配列
 */
const extractCoordinates = (route, { originPosition, spots }) => {
  const coordinates = [];

  for (const leg of route?.Legs ?? []) {
    const lineString = leg.Geometry?.LineString ?? [];

    if (lineString.length > 0) {
      coordinates.push(...lineString);
    }
  }

  if (coordinates.length > 0) {
    return coordinates;
  }

  // 道なりの形は失われるが、線を引けない状態を避けるため直線で結ぶ
  return [originPosition, ...spots.map((spot) => spot.position), originPosition];
};

/**
 * @description 応答から距離と所要時間を取り出す。
 *
 * 距離・時間は経路全体の集計値である `Route.Summary` のみを参照する。
 * Routes v2 の応答は Summary（経路全体）・Legs[].*LegDetails（レッグ単位）・
 * その中の TravelSteps[] / Spans[]（区間単位）と、同じ実測値を複数の階層で
 * 重複して持つ。過去に応答を再帰探索して全 distance / duration を合算していたため
 * 二重計上となり、総距離と所要時間の比（歩行速度）が実態から乖離していた。
 * @param {object|null} route Routesが返した経路（response.Routes[0]）
 * @returns {{totalDistanceM: number, totalDurationS: number}} 経路全体の距離と所要時間
 */
const sumMetrics = (route) => {
  const summary = route?.Summary ?? null;

  return {
    totalDistanceM: typeof summary?.Distance === 'number' ? summary.Distance : 0,
    totalDurationS: typeof summary?.Duration === 'number' ? summary.Duration : 0
  };
};

/**
 * @description 座標列から距離と所要時間を概算する。
 * APIから数値が取得できなかった場合の代替手段。
 * @param {number[][]} coordinates [経度, 緯度] の配列
 * @returns {{totalDistanceM: number, totalDurationS: number}} 概算した距離と所要時間
 */
const estimateMetricsFromCoordinates = (coordinates) => {
  let totalDistanceM = 0;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    totalDistanceM += calculateHaversineDistanceM(
      coordinates[index],
      coordinates[index + 1]
    );
  }

  totalDistanceM = Math.round(totalDistanceM);

  return {
    totalDistanceM,
    totalDurationS: Math.round(totalDistanceM / WALKING_METERS_PER_SECOND)
  };
};

/**
 * @description スポットを順に巡り、出発地へ戻る徒歩経路を計算する
 * @param {object} conditions 計算条件
 * @param {{lat: number, lng: number}} conditions.currentLocation 出発地かつ目的地となる現在地
 * @param {object[]} conditions.spots 経由するスポットの一覧
 * @returns {Promise<{coordinates: number[][], totalDistanceM: number, totalDurationS: number}>} 経路の座標列と距離・所要時間
 * @throws {ApplicationError} 外部サービスへのアクセスに失敗した場合
 */
export const calculateWalkingRoute = async ({ currentLocation, spots }) => {
  const originPosition = [currentLocation.lng, currentLocation.lat];

  let route = null;

  try {
    const response = await getRoutesClient().send(
      new CalculateRoutesCommand({
        Origin: originPosition,
        // 散歩は出発地に戻る周回コースのため、目的地も現在地にする
        Destination: originPosition,
        Waypoints: spots.map((spot) => ({ Position: spot.position })),
        TravelMode: 'Pedestrian',
        LegGeometryFormat: 'Simple'
      })
    );

    route = response.Routes?.[0] ?? null;
  } catch (error) {
    throw createDataSourceError('徒歩経路の計算に失敗しました', {
      errorName: error.name,
      spotCount: spots.length
    });
  }

  const coordinates = extractCoordinates(route, { originPosition, spots });
  const summed = sumMetrics(route);

  // 応答から距離が取れなかった場合のみ座標から概算する
  const metrics =
    summed.totalDistanceM > 0 ? summed : estimateMetricsFromCoordinates(coordinates);

  return {
    coordinates,
    totalDistanceM: metrics.totalDistanceM,
    totalDurationS: metrics.totalDurationS
  };
};
