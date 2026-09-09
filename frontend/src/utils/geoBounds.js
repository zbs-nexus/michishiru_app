/**
 * @description 座標列に対する計算を行う。
 * Vueに依存しないため、コンポーネントとサービスの両方から呼び出して使う。
 */

/**
 * @description 座標として扱える値かどうかを判定する
 * @param {*} coordinate 判定する値
 * @returns {boolean} [経度, 緯度] の形をしている場合はtrue
 */
const isCoordinate = (coordinate) =>
  Array.isArray(coordinate) &&
  Number.isFinite(coordinate[0]) &&
  Number.isFinite(coordinate[1]);

/**
 * @description 座標列全体を囲む矩形を求める。
 * ルート全体を地図に収める際の範囲指定に使う。
 * @param {number[][]} coordinates [経度, 緯度] の配列
 * @returns {number[][]|null} [[南西の経度, 南西の緯度], [北東の経度, 北東の緯度]]。有効な座標が無い場合はnull
 */
export const toCoordinateBounds = (coordinates) => {
  if (!Array.isArray(coordinates)) {
    return null;
  }

  const validCoordinates = coordinates.filter(isCoordinate);

  if (validCoordinates.length === 0) {
    return null;
  }

  const longitudes = validCoordinates.map(([lng]) => lng);
  const latitudes = validCoordinates.map(([, lat]) => lat);

  return [
    [Math.min(...longitudes), Math.min(...latitudes)],
    [Math.max(...longitudes), Math.max(...latitudes)]
  ];
};
