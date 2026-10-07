/**
 * @description getSpotリクエストのバリデーション。
 * 副作用やデータ参照を持たない純粋関数とする。
 */

/**
 * @description 緯度・経度として扱える値かどうかを判定する
 * @param {number} value 判定する値
 * @param {number} limit 絶対値の上限（緯度90・経度180）
 * @returns {boolean} 範囲内の数値ならtrue
 */
const isValidCoordinate = (value, limit) =>
  Number.isFinite(value) && Math.abs(value) <= limit;

/**
 * @description 場所解決リクエストのクエリを検証する
 * @param {object} query クエリパラメータ（lng, lat）
 * @returns {{isValid: boolean, errorMessages: string[], value: {position: {lng: number, lat: number}}|null}} 検証結果
 */
export const validateGetSpotRequest = (query = {}) => {
  const errorMessages = [];

  const lng = Number(query.lng);
  const lat = Number(query.lat);

  if (!isValidCoordinate(lng, 180)) {
    errorMessages.push('lngは-180〜180の数値で指定してください');
  }

  if (!isValidCoordinate(lat, 90)) {
    errorMessages.push('latは-90〜90の数値で指定してください');
  }

  const isValid = errorMessages.length === 0;

  return {
    isValid,
    errorMessages,
    value: isValid ? { position: { lng, lat } } : null
  };
};
