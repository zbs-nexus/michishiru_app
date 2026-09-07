import { ALLOWED_GENRES, MAX_DISTANCE_KM, MIN_DISTANCE_KM } from './constants.js';

/**
 * @description ルート生成リクエストの検証を行う。
 * 純粋関数として実装し、データ取得や副作用は持たない。
 */

/**
 * @description 座標として妥当な数値かを判定する
 * @param {unknown} value 検証する値
 * @param {number} limit 絶対値の上限
 * @returns {boolean} 妥当な場合はtrue
 */
const isValidCoordinate = (value, limit) =>
  typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * @description ルート生成リクエストを検証する
 * @param {object} body リクエストボディ
 * @param {string} [body.genre] ジャンル
 * @param {number} [body.distance] 目標距離（km）
 * @param {number} [body.lat] 現在地の緯度
 * @param {number} [body.lng] 現在地の経度
 * @returns {{isValid: boolean, errorMessages: string[], value: object|null}} 検証結果と正規化した値
 */
export const validateGenerateRouteRequest = (body = {}) => {
  const errorMessages = [];

  const genre = body.genre ?? null;
  const distance = body.distance ?? null;
  const lat = body.lat ?? null;
  const lng = body.lng ?? null;

  if (!genre) {
    errorMessages.push('genreは必須です');
  } else if (!ALLOWED_GENRES.includes(genre)) {
    errorMessages.push(`genreが不正です（許可値: ${ALLOWED_GENRES.join(', ')}）`);
  }

  if (distance === null) {
    errorMessages.push('distanceは必須です');
  } else if (typeof distance !== 'number' || !Number.isFinite(distance)) {
    errorMessages.push('distanceは数値で指定してください');
  } else if (distance < MIN_DISTANCE_KM || distance > MAX_DISTANCE_KM) {
    errorMessages.push(
      `distanceは${MIN_DISTANCE_KM}以上${MAX_DISTANCE_KM}以下で指定してください`
    );
  }

  if (lat === null) {
    errorMessages.push('latは必須です');
  } else if (!isValidCoordinate(lat, 90)) {
    errorMessages.push('latは-90から90の数値で指定してください');
  }

  if (lng === null) {
    errorMessages.push('lngは必須です');
  } else if (!isValidCoordinate(lng, 180)) {
    errorMessages.push('lngは-180から180の数値で指定してください');
  }

  const isValid = errorMessages.length === 0;

  return {
    isValid,
    errorMessages,
    value: isValid ? { genre, distance, origin: { lat, lng } } : null
  };
};
