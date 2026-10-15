import {
  MAX_RATING,
  MIN_RATING,
  PHOTO_MAX_COUNT,
  SPOT_NAME_MAX_LENGTH
} from './constants.js';

/**
 * @description createReviewリクエストのバリデーション。
 * 副作用やデータ参照を持たない純粋関数とする。
 *
 * 初回投稿か2回目以降かは「その場所が既に存在するか」で決まり、ここでは分からない。
 * そのため、ここでは評価と座標など「常に満たすべき形式」のみを検証し、
 * ロケーション名・ジャンルの要否判定（初回のみ必須）はService層で行う。
 */

/**
 * @description 緯度・経度として扱える値かどうかを判定する
 * @param {number} value 判定する値
 * @param {number} limit 絶対値の上限
 * @returns {boolean} 範囲内の数値ならtrue
 */
const isValidCoordinate = (value, limit) =>
  Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * @description 座標を検証して正規化する
 * @param {object} position 入力の座標
 * @param {string[]} errorMessages エラーの蓄積先
 * @returns {{lng: number, lat: number}|null} 正規化した座標。不正ならnull
 */
const validatePosition = (position, errorMessages) => {
  const lng = Number(position?.lng);
  const lat = Number(position?.lat);

  if (!isValidCoordinate(lng, 180) || !isValidCoordinate(lat, 90)) {
    errorMessages.push('positionは有効な lng / lat を持つ必要があります');
    return null;
  }

  return { lng, lat };
};

/**
 * @description ロケーション名を検証して正規化する。未指定は許容する（初回要否はServiceで判定）。
 * @param {*} spotName 入力のロケーション名
 * @param {string[]} errorMessages エラーの蓄積先
 * @returns {string|null} 前後の空白を除いた名前。未指定ならnull
 */
const validateSpotName = (spotName, errorMessages) => {
  if (spotName === undefined || spotName === null) {
    return null;
  }

  if (typeof spotName !== 'string') {
    errorMessages.push('spotNameは文字列で指定してください');
    return null;
  }

  const trimmed = spotName.trim();

  if (trimmed.length > SPOT_NAME_MAX_LENGTH) {
    errorMessages.push(`spotNameは${SPOT_NAME_MAX_LENGTH}文字以内で指定してください`);
    return null;
  }

  return trimmed === '' ? null : trimmed;
};

/**
 * @description 写真キーの配列を検証する。未指定は空配列として扱う（写真は任意）。
 * @param {*} photoKeys 入力の写真キー配列
 * @param {string[]} errorMessages エラーの蓄積先
 * @returns {string[]} 正規化した写真キーの配列
 */
const validatePhotoKeys = (photoKeys, errorMessages) => {
  if (photoKeys === undefined || photoKeys === null) {
    return [];
  }

  if (!Array.isArray(photoKeys)) {
    errorMessages.push('photoKeysは配列で指定してください');
    return [];
  }

  if (photoKeys.length > PHOTO_MAX_COUNT) {
    errorMessages.push(`写真は${PHOTO_MAX_COUNT}枚までです`);
    return [];
  }

  if (!photoKeys.every((key) => typeof key === 'string' && key.length > 0)) {
    errorMessages.push('photoKeysの要素は空でない文字列で指定してください');
    return [];
  }

  return photoKeys;
};

/**
 * @description 口コミ投稿リクエストのボディを検証する
 * @param {object} body リクエストボディ
 * @returns {{isValid: boolean, errorMessages: string[], value: object|null}} 検証結果
 */
export const validateCreateReviewRequest = (body = {}) => {
  const errorMessages = [];

  const position = validatePosition(body.position, errorMessages);

  const rating = Number(body.rating);

  if (!Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    errorMessages.push(`ratingは${MIN_RATING}〜${MAX_RATING}の整数で指定してください`);
  }

  const spotName = validateSpotName(body.spotName, errorMessages);

  const genreId =
    body.genreId === undefined || body.genreId === null
      ? null
      : String(body.genreId);
  const genreName =
    body.genreName === undefined || body.genreName === null
      ? null
      : String(body.genreName);

  const photoKeys = validatePhotoKeys(body.photoKeys, errorMessages);

  const isValid = errorMessages.length === 0;

  return {
    isValid,
    errorMessages,
    value: isValid
      ? { position, rating, spotName, genreId, genreName, photoKeys }
      : null
  };
};
