import { calculateDistanceM } from '@/utils/geoDistance';

/**
 * @description 経路の折れ線（LineString）に対する計算を行う。
 * Vueに依存しないため、composableから呼び出して使う。
 *
 * 現在地を折れ線上へ射影することで、直線距離ではなく道に沿った距離を求められる。
 * 経路はCalculateRoutesが返した道なりの座標列なので、道路網のデータは別途必要ない。
 */

/** 緯度1度あたりのメートル数 */
const METERS_PER_DEGREE_LAT = 111320;

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
 * @description 経路の座標列から、距離計算に使う測定用データを組み立てる。
 * 各点までの累積距離を先に求めておき、現在地が動くたびの計算を軽くする。
 * @param {number[][]|undefined} coordinates [経度, 緯度] の配列
 * @returns {{points: object[], cumulativeM: number[], totalM: number}|null} 測定用データ。線にならない場合はnull
 */
export const toRouteMeasure = (coordinates) => {
  if (!Array.isArray(coordinates)) {
    return null;
  }

  const points = coordinates
    .filter(
      (coordinate) =>
        Array.isArray(coordinate) &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1])
    )
    .map((coordinate) => ({
      lng: Number(coordinate[0]),
      lat: Number(coordinate[1])
    }));

  // 1点だけでは線にならないため、測定できないものとして扱う
  if (points.length < 2) {
    return null;
  }

  const cumulativeM = [0];

  for (let index = 1; index < points.length; index += 1) {
    cumulativeM.push(
      cumulativeM[index - 1] + calculateDistanceM(points[index - 1], points[index])
    );
  }

  return {
    points,
    cumulativeM,
    totalM: cumulativeM[cumulativeM.length - 1]
  };
};

/**
 * @description 座標を折れ線上の最も近い点へ射影する。
 * 区間ごとに平面へ近似して射影し、最も近い区間の結果を返す。
 * @param {object|null} measure toRouteMeasureで作った測定用データ
 * @param {{lat: number, lng: number}} position 射影する座標
 * @returns {{alongM: number, deviationM: number}|null} 始点からの距離と折れ線までの離れ。射影できない場合はnull
 */
export const toRouteProjection = (measure, position) => {
  if (measure === null || !isPosition(position)) {
    return null;
  }

  let nearest = null;

  for (let index = 0; index < measure.points.length - 1; index += 1) {
    const start = measure.points[index];
    const end = measure.points[index + 1];

    // 経度1度あたりの距離は緯度によって変わるため、区間の始点の緯度で換算する
    const metersPerDegreeLng =
      METERS_PER_DEGREE_LAT * Math.cos(toRadians(start.lat));

    const segmentX = (end.lng - start.lng) * metersPerDegreeLng;
    const segmentY = (end.lat - start.lat) * METERS_PER_DEGREE_LAT;
    const positionX = (position.lng - start.lng) * metersPerDegreeLng;
    const positionY = (position.lat - start.lat) * METERS_PER_DEGREE_LAT;

    const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;

    // 同じ座標が連続している区間は長さ0になるため、始点へ射影したものとして扱う
    const ratio =
      segmentLengthSquared === 0
        ? 0
        : Math.min(
            Math.max(
              (positionX * segmentX + positionY * segmentY) / segmentLengthSquared,
              0
            ),
            1
          );

    const deviationM = Math.sqrt(
      (positionX - segmentX * ratio) ** 2 + (positionY - segmentY * ratio) ** 2
    );

    if (nearest === null || deviationM < nearest.deviationM) {
      const segmentLengthM =
        measure.cumulativeM[index + 1] - measure.cumulativeM[index];

      nearest = {
        deviationM,
        alongM: measure.cumulativeM[index] + segmentLengthM * ratio
      };
    }
  }

  return nearest;
};

/**
 * @description 2地点間の距離を、経路の折れ線に沿って求める。
 * 現在地が経路から離れすぎている場合は、射影先が別の区間へ吸着して
 * 距離が大きく飛ぶため、測定できないものとしてnullを返す。
 * @param {object} conditions 計算条件
 * @param {object|null} conditions.measure toRouteMeasureで作った測定用データ
 * @param {{lat: number, lng: number}} conditions.fromPosition 起点
 * @param {{lat: number, lng: number}} conditions.toPosition 終点
 * @param {number} conditions.maxDeviationM 起点が経路から離れていても測定を許す上限
 * @returns {number|null} 経路に沿った距離（メートル）。測定できない場合はnull
 */
export const calculateAlongRouteDistanceM = ({
  measure,
  fromPosition,
  toPosition,
  maxDeviationM
}) => {
  const from = toRouteProjection(measure, fromPosition);
  const to = toRouteProjection(measure, toPosition);

  if (from === null || to === null) {
    return null;
  }

  if (from.deviationM > maxDeviationM) {
    return null;
  }

  return Math.abs(to.alongM - from.alongM);
};

/**
 * @description 経路の終点までの残り距離を、折れ線に沿って求める。
 *
 * 散歩ルートは開始地点へ戻る周回のため、終点の座標は開始地点と同じになる。
 * 開始地点を射影すると経路の先頭（距離0の地点）へ吸着してしまい、戻る距離ではなく
 * 出発してからの距離になってしまうため、終点までの残りとして計算する。
 * @param {object} conditions 計算条件
 * @param {object|null} conditions.measure toRouteMeasureで作った測定用データ
 * @param {{lat: number, lng: number}} conditions.fromPosition 現在の座標
 * @param {number} conditions.maxDeviationM 経路から離れていても測定を許す上限
 * @returns {number|null} 終点までの残り距離（メートル）。測定できない場合はnull
 */
export const calculateRemainingRouteDistanceM = ({
  measure,
  fromPosition,
  maxDeviationM
}) => {
  const from = toRouteProjection(measure, fromPosition);

  if (from === null || from.deviationM > maxDeviationM) {
    return null;
  }

  return Math.max(0, measure.totalM - from.alongM);
};
