/**
 * @description 2地点間の距離を計算する。
 * Vueに依存しないため、composableとサービスの両方から呼び出して使う。
 */

/** 地球の半径（メートル） */
const EARTH_RADIUS_M = 6371000;

/**
 * @description 度をラジアンへ変換する
 * @param {number} degrees 度
 * @returns {number} ラジアン
 */
const toRadians = (degrees) => (degrees * Math.PI) / 180;

/**
 * @description 座標として扱える値かどうかを判定する
 * @param {*} position 判定する値
 * @returns {boolean} latとlngが数値の場合はtrue
 */
const isPosition = (position) =>
  position !== null &&
  typeof position === 'object' &&
  Number.isFinite(position.lat) &&
  Number.isFinite(position.lng);

/**
 * @description 2地点間の直線距離をハバーサイン公式で求める。
 * 徒歩の実距離ではなく直線距離のため、到達判定のような近さの判定に使う。
 * @param {{lat: number, lng: number}} from 起点
 * @param {{lat: number, lng: number}} to 終点
 * @returns {number|null} 距離（メートル）。座標が不正な場合はnull
 */
export const calculateDistanceM = (from, to) => {
  if (!isPosition(from) || !isPosition(to)) {
    return null;
  }

  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_M * centralAngle;
};
