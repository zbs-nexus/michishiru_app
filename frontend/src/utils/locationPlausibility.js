import { calculateDistanceM } from '@/utils/geoDistance';

/**
 * @description 2回の測位の間の移動が、徒歩で起こり得るものかを判定する。
 * Vueに依存しないため、composableから呼び出して使う。
 *
 * ビル群ではGPSの電波が壁で反射して届き（マルチパス）、端末が申告する精度は良いまま
 * 座標だけが数十〜数百m飛ぶことがある。精度の申告では捕まえられないため、
 * 移動の速さで判定する。
 */

/**
 * 徒歩として採用する速さの上限（メートル毎秒）。
 * 早歩きは秒速2m弱、小走りでも秒速3m程度のため、これを超える移動は座標の飛びとみなす。
 */
export const MAX_WALKING_SPEED_MPS = 3;

/**
 * 速さを計算するときの経過時間の下限（秒）。
 * 同じ時刻の測位が続いた場合に0で割らないようにする。
 */
const MIN_ELAPSED_S = 1;

/**
 * @description 測位の時刻を取り出す。
 * 測位の時刻を持たない場合（一部の環境・テスト）は受け取った時刻で代用する。
 * @param {GeolocationPosition} position 測位の結果
 * @returns {number} エポックミリ秒
 */
export const toFixTimestamp = (position) =>
  Number.isFinite(position?.timestamp) ? position.timestamp : Date.now();

/**
 * @description 2回の測位の間の移動が徒歩で起こり得るかを判定する。
 *
 * 距離から両方の精度の幅を差し引いてから速さを求める。精度の幅の中での揺れは
 * 実際の移動かどうか区別できないため、飛びとして捨てない。
 * 経過時間が長いほど許す距離も伸びるため、本当に移動した場合は時間が経てば採用される。
 * @param {object} from 前回の測位
 * @param {number} from.lat 緯度
 * @param {number} from.lng 経度
 * @param {number} from.accuracy 精度（メートル）
 * @param {number} from.timestamp 時刻（エポックミリ秒）
 * @param {object} to 今回の測位（形は from と同じ）
 * @returns {boolean} 起こり得る移動ならtrue。座標が不正で判定できない場合もtrue（捨てない）
 */
export const isPlausibleWalkingMove = (from, to) => {
  const distanceM = calculateDistanceM(from, to);

  if (distanceM === null) {
    return true;
  }

  const marginM =
    (Number.isFinite(from.accuracy) ? from.accuracy : 0) +
    (Number.isFinite(to.accuracy) ? to.accuracy : 0);

  const elapsedS = Math.max((to.timestamp - from.timestamp) / 1000, MIN_ELAPSED_S);

  return distanceM - marginM <= MAX_WALKING_SPEED_MPS * elapsedS;
};
