/**
 * @description 地理計算のユーティリティ。
 * 特定のLambda関数に依存しない汎用処理のみを置く。
 * 口コミの「同じ場所」判定（半径40m）と、その候補をDynamoDBから絞り込むための
 * グリッドセル算出に使う。
 */

/** 地球の半径（メートル） */
const EARTH_RADIUS_M = 6371000;

/** 緯度1度あたりの距離（メートル） */
const METERS_PER_DEGREE_LAT = 111320;

/**
 * 同じ場所とみなす半径（メートル）。
 * 案内画面の通過判定（ARRIVAL_THRESHOLD_M）と同じ40mに合わせている。
 */
export const SAME_PLACE_RADIUS_M = 40;

/**
 * 候補絞り込み用グリッドの一辺（メートル）。
 * 半径と同じ40mにすると、対象セルとその周囲8セル（3×3）の問い合わせで
 * 半径40m以内のスポットを必ず候補に含められる。
 */
const GEO_CELL_SIZE_M = SAME_PLACE_RADIUS_M;

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
 * 「同じ場所」かどうかの近さ判定に使う。
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

/** 緯度方向のグリッド幅（度）。緯度では経度に依らず一定 */
const LAT_STEP_DEG = GEO_CELL_SIZE_M / METERS_PER_DEGREE_LAT;

/**
 * @description 指定緯度での経度方向のグリッド幅（度）を求める。
 * 経度1度の距離は緯度が上がるほど cos で縮むため補正する。
 * @param {number} lat 緯度
 * @returns {number} 経度方向のグリッド幅（度）
 */
const lngStepDegAt = (lat) =>
  GEO_CELL_SIZE_M / (METERS_PER_DEGREE_LAT * Math.cos(toRadians(lat)));

/**
 * @description 座標をグリッドのセル番号へ変換する
 * @param {{lng: number, lat: number}} position 座標
 * @returns {{latIndex: number, lngIndex: number}} セル番号
 */
const toCellIndices = ({ lng, lat }) => ({
  latIndex: Math.floor(lat / LAT_STEP_DEG),
  lngIndex: Math.floor(lng / lngStepDegAt(lat))
});

/**
 * @description 座標が属するグリッドセルのキーを求める。
 * 近接するスポットを同じ値で引けるようにし、GSIのパーティションキーに使う。
 * @param {{lng: number, lat: number}} position 座標
 * @returns {string} セルキー（例: "99123:388540"）
 */
export const toGeoCell = (position) => {
  const { latIndex, lngIndex } = toCellIndices(position);
  return `${latIndex}:${lngIndex}`;
};

/**
 * @description 指定座標のセルとその周囲8セルを合わせた9セルのキーを求める。
 * 半径40m以内のスポットは必ずこの範囲のいずれかのセルに入る。
 * @param {{lng: number, lat: number}} position 座標
 * @returns {string[]} セルキーの一覧（9件）
 */
export const toNeighborGeoCells = (position) => {
  const { latIndex, lngIndex } = toCellIndices(position);
  const cells = [];

  for (let deltaLat = -1; deltaLat <= 1; deltaLat += 1) {
    for (let deltaLng = -1; deltaLng <= 1; deltaLng += 1) {
      cells.push(`${latIndex + deltaLat}:${lngIndex + deltaLng}`);
    }
  }

  return cells;
};

/**
 * @description 候補の中から、指定座標に最も近く半径以内にあるものを選ぶ。
 * 各候補は `position`（{lng, lat}）を持つ必要がある。
 * @param {{lng: number, lat: number}} position 中心の座標
 * @param {object[]} items 候補（それぞれ position を持つ）
 * @param {number} radiusM 半径（メートル）
 * @returns {object|null} 最も近い候補。半径内に無ければnull
 */
export const findNearestWithinRadiusM = (position, items, radiusM) => {
  let nearest = null;
  let nearestDistanceM = Infinity;

  for (const item of items) {
    const distanceM = calculateDistanceM(position, item.position);

    if (distanceM === null || distanceM > radiusM) {
      continue;
    }

    if (distanceM < nearestDistanceM) {
      nearest = item;
      nearestDistanceM = distanceM;
    }
  }

  return nearest;
};
