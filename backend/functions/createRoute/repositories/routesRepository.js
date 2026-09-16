import { CalculateRoutesCommand, GeoRoutesClient } from '@aws-sdk/client-geo-routes';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import {
  AWS_REGION,
  EARTH_RADIUS_M,
  SIMPLIFY_TOLERANCE_M,
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
 * @description 緯度経度を局所的な平面座標（m）へ投影する。
 * 短距離の垂直距離計算に使う簡易投影（正距円筒図法）。
 * @param {number[]} position [経度, 緯度]
 * @param {number} originLatRad 投影の基準緯度（ラジアン）
 * @returns {number[]} [x, y]（m）
 */
const projectToLocalXYM = (position, originLatRad) => {
  const toRadian = Math.PI / 180;

  return [
    position[0] * toRadian * EARTH_RADIUS_M * Math.cos(originLatRad),
    position[1] * toRadian * EARTH_RADIUS_M
  ];
};

/**
 * @description 点から、線分の両端を通る直線への垂直距離（m）を求める。
 * @param {number[]} point 対象の点（[経度, 緯度]）
 * @param {number[]} lineStart 線分の始点（[経度, 緯度]）
 * @param {number[]} lineEnd 線分の終点（[経度, 緯度]）
 * @param {number} originLatRad 投影の基準緯度（ラジアン）
 * @returns {number} 垂直距離（m）
 */
const perpendicularDistanceM = (point, lineStart, lineEnd, originLatRad) => {
  const [px, py] = projectToLocalXYM(point, originLatRad);
  const [ax, ay] = projectToLocalXYM(lineStart, originLatRad);
  const [bx, by] = projectToLocalXYM(lineEnd, originLatRad);

  const dx = bx - ax;
  const dy = by - ay;
  const segmentLengthSquared = dx * dx + dy * dy;

  // 始点と終点が同一なら、始点までの距離を返す
  if (segmentLengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const crossProduct = Math.abs(dx * (ay - py) - dy * (ax - px));

  return crossProduct / Math.sqrt(segmentLengthSquared);
};

/**
 * @description Ramer–Douglas–Peucker 法で折れ線を単純化する。
 * 元の線から toleranceM 以内に収まる中間点を省き、形状を保ったまま点を減らす。
 * @param {number[][]} coordinates [経度, 緯度] の配列
 * @param {number} toleranceM 許容誤差（m）
 * @param {number} originLatRad 投影の基準緯度（ラジアン）
 * @returns {number[][]} 単純化した座標列
 */
const simplifyWithRdp = (coordinates, toleranceM, originLatRad) => {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  let maxDistanceM = 0;
  let farthestIndex = 0;
  const lastIndex = coordinates.length - 1;

  for (let index = 1; index < lastIndex; index += 1) {
    const distanceM = perpendicularDistanceM(
      coordinates[index],
      coordinates[0],
      coordinates[lastIndex],
      originLatRad
    );

    if (distanceM > maxDistanceM) {
      maxDistanceM = distanceM;
      farthestIndex = index;
    }
  }

  // 最も離れた点が許容誤差以内なら、始点と終点だけで近似できる
  if (maxDistanceM <= toleranceM) {
    return [coordinates[0], coordinates[lastIndex]];
  }

  // 最も離れた点で分割し、前半・後半をそれぞれ再帰的に単純化する
  const left = simplifyWithRdp(
    coordinates.slice(0, farthestIndex + 1),
    toleranceM,
    originLatRad
  );
  const right = simplifyWithRdp(
    coordinates.slice(farthestIndex),
    toleranceM,
    originLatRad
  );

  // 分割点が重複するため、前半の末尾を除いて連結する
  return [...left.slice(0, -1), ...right];
};

/**
 * @description 経路の座標列を、見た目を保ちつつ間引く。
 * 投影の基準緯度には先頭点の緯度を使う（1経路の範囲では緯度差が小さく十分）。
 * @param {number[][]} coordinates [経度, 緯度] の配列
 * @returns {number[][]} 間引いた座標列
 */
const simplifyCoordinates = (coordinates) => {
  if (coordinates.length <= 2) {
    return coordinates;
  }

  const originLatRad = coordinates[0][1] * (Math.PI / 180);

  return simplifyWithRdp(coordinates, SIMPLIFY_TOLERANCE_M, originLatRad);
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

  // 応答から距離が取れなかった場合のみ座標から概算する。
  // 概算は間引き前の座標で行い、距離・時間が間引きの影響を受けないようにする。
  const metrics =
    summed.totalDistanceM > 0 ? summed : estimateMetricsFromCoordinates(coordinates);

  return {
    // 描画用の座標は形状を保ったまま間引いて、応答サイズと描画コストを抑える
    coordinates: simplifyCoordinates(coordinates),
    totalDistanceM: metrics.totalDistanceM,
    totalDurationS: metrics.totalDurationS
  };
};
