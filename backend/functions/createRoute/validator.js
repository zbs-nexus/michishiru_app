import {
  DEFAULT_CURRENT_LOCATION,
  DEFAULT_GENRE_NAME,
  DEFAULT_TARGET_DISTANCE_KM,
  LATITUDE_RANGE,
  LONGITUDE_RANGE,
  TARGET_DISTANCE_RANGE_KM
} from './constants.js';

/**
 * @description リクエスト入力の検証を行う。
 * 純粋関数として実装し、データ取得や副作用は持たない。
 */

/**
 * @description 数値が指定した範囲に収まっているかを判定する
 * @param {*} value 判定する値
 * @param {{min: number, max: number}} range 許容範囲
 * @returns {boolean} 範囲内の数値である場合はtrue
 */
const isWithinRange = (value, range) =>
  Number.isFinite(value) && value >= range.min && value <= range.max;

/**
 * @description 現在地を検証する。
 * 未指定の場合は既定の座標で補う（フロントが現在地を送るまでの暫定仕様）。
 * @param {*} currentLocation 検証する現在地
 * @param {string[]} errorMessages エラーメッセージの格納先
 * @returns {{lat: number, lng: number}|null} 正規化した現在地。不正な場合はnull
 */
const validateCurrentLocation = (currentLocation, errorMessages) => {
  if (currentLocation === null || currentLocation === undefined) {
    return { ...DEFAULT_CURRENT_LOCATION };
  }

  if (typeof currentLocation !== 'object') {
    errorMessages.push('currentLocationはlat・lngを持つオブジェクトで指定してください');
    return null;
  }

  const lat = Number(currentLocation.lat);
  const lng = Number(currentLocation.lng);

  let isValidLocation = true;

  if (!isWithinRange(lat, LATITUDE_RANGE)) {
    errorMessages.push(
      `currentLocation.latが不正です（${LATITUDE_RANGE.min}〜${LATITUDE_RANGE.max}の数値）`
    );
    isValidLocation = false;
  }

  if (!isWithinRange(lng, LONGITUDE_RANGE)) {
    errorMessages.push(
      `currentLocation.lngが不正です（${LONGITUDE_RANGE.min}〜${LONGITUDE_RANGE.max}の数値）`
    );
    isValidLocation = false;
  }

  return isValidLocation ? { lat, lng } : null;
};

/**
 * @description ルート作成リクエストを検証する。
 *
 * リクエストのキー名は既存の外部仕様に合わせている。
 * TODO(NZ未採番): `purposeCategory` を用語辞書に沿った `genre` へ改名する
 * （`naming-conventions.md` の未決定事項 #1）。フロントとの同時変更が必要。
 * @param {object} body リクエストボディ
 * @param {string} [body.purposeCategory] ジャンル名（例: 自然）。未指定なら既定値
 * @param {number} [body.targetDistanceKm] 目標距離（km）。未指定なら既定値
 * @param {{lat: number, lng: number}} [body.currentLocation] 現在地。未指定なら既定値
 * @returns {{isValid: boolean, errorMessages: string[], value: object|null}} 検証結果と正規化した値
 */
export const validateCreateRouteRequest = (body = {}) => {
  const errorMessages = [];

  const genreName = body.purposeCategory || DEFAULT_GENRE_NAME;

  if (typeof genreName !== 'string') {
    errorMessages.push('purposeCategoryは文字列で指定してください');
  }

  const rawTargetDistanceKm = body.targetDistanceKm ?? DEFAULT_TARGET_DISTANCE_KM;
  const targetDistanceKm = Number(rawTargetDistanceKm);

  if (!isWithinRange(targetDistanceKm, TARGET_DISTANCE_RANGE_KM)) {
    errorMessages.push(
      `targetDistanceKmが不正です（${TARGET_DISTANCE_RANGE_KM.min}〜${TARGET_DISTANCE_RANGE_KM.max}の数値）`
    );
  }

  const currentLocation = validateCurrentLocation(body.currentLocation, errorMessages);

  const isValid = errorMessages.length === 0;

  return {
    isValid,
    errorMessages,
    value: isValid ? { genreName, targetDistanceKm, currentLocation } : null
  };
};
