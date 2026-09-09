import {
  DEFAULT_SPOT_CATEGORY,
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
 * @description 現在地を検証し、エラーメッセージを積む
 * @param {*} currentLocation 検証する現在地
 * @param {string[]} errorMessages エラーメッセージの格納先
 * @returns {{lat: number, lng: number}|null} 正規化した現在地。不正な場合はnull
 */
const validateCurrentLocation = (currentLocation, errorMessages) => {
  if (currentLocation === null || typeof currentLocation !== 'object') {
    errorMessages.push('currentLocationは必須です（lat・lngを持つオブジェクト）');
    return null;
  }

  const lat = Number(currentLocation.lat);
  const lng = Number(currentLocation.lng);

  if (!isWithinRange(lat, LATITUDE_RANGE)) {
    errorMessages.push(
      `currentLocation.latが不正です（${LATITUDE_RANGE.min}〜${LATITUDE_RANGE.max}の数値）`
    );
  }

  if (!isWithinRange(lng, LONGITUDE_RANGE)) {
    errorMessages.push(
      `currentLocation.lngが不正です（${LONGITUDE_RANGE.min}〜${LONGITUDE_RANGE.max}の数値）`
    );
  }

  return errorMessages.length === 0 ? { lat, lng } : null;
};

/**
 * @description ルート作成リクエストを検証する。
 *
 * リクエストのキー名は既存の外部仕様に合わせている。
 * TODO(NZ未採番): `purposeCategory` を用語辞書に沿った `genre` へ改名する
 * （`naming-conventions.md` の未決定事項 #1）。フロントとの同時変更が必要。
 * @param {object} body リクエストボディ
 * @param {string} [body.purposeCategory] 検索するスポットのカテゴリ
 * @param {number} [body.targetDistanceKm] 目標距離（km）
 * @param {{lat: number, lng: number}} [body.currentLocation] 現在地
 * @returns {{isValid: boolean, errorMessages: string[], value: object|null}} 検証結果と正規化した値
 */
export const validateCreateRouteRequest = (body = {}) => {
  const errorMessages = [];

  const spotCategory = body.purposeCategory || DEFAULT_SPOT_CATEGORY;

  if (typeof spotCategory !== 'string') {
    errorMessages.push('purposeCategoryは文字列で指定してください');
  }

  const rawTargetDistanceKm = body.targetDistanceKm ?? DEFAULT_TARGET_DISTANCE_KM;
  const targetDistanceKm = Number(rawTargetDistanceKm);

  if (!isWithinRange(targetDistanceKm, TARGET_DISTANCE_RANGE_KM)) {
    errorMessages.push(
      `targetDistanceKmが不正です（${TARGET_DISTANCE_RANGE_KM.min}〜${TARGET_DISTANCE_RANGE_KM.max}の数値）`
    );
  }

  const currentLocation = validateCurrentLocation(body.currentLocation ?? null, errorMessages);

  const isValid = errorMessages.length === 0;

  return {
    isValid,
    errorMessages,
    value: isValid ? { spotCategory, targetDistanceKm, currentLocation } : null
  };
};
