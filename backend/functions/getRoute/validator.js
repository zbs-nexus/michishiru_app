import {
  ALLOWED_CATEGORIES,
  ALLOWED_DISTANCES_KM,
  ALLOWED_PURPOSES
} from './constants.js';

/**
 * @description リクエスト入力の検証を行う。
 * 純粋関数として実装し、データ取得や副作用は持たない。
 */

/**
 * @description ルート取得リクエストを検証する
 * @param {object} query クエリパラメータ
 * @param {string} [query.purpose] 目的
 * @param {string} [query.category] カテゴリ
 * @param {string} [query.distance] 希望距離（km、文字列）
 * @returns {{isValid: boolean, errorMessages: string[], value: object|null}} 検証結果と正規化した値
 */
export const validateGetRouteRequest = (query = {}) => {
  const errorMessages = [];

  const purpose = query.purpose ?? null;
  const category = query.category ?? null;
  const rawDistance = query.distance ?? null;

  if (!purpose) {
    errorMessages.push('purposeは必須です');
  } else if (!ALLOWED_PURPOSES.includes(purpose)) {
    errorMessages.push(`purposeが不正です（許可値: ${ALLOWED_PURPOSES.join(', ')}）`);
  }

  if (!category) {
    errorMessages.push('categoryは必須です');
  } else if (!ALLOWED_CATEGORIES.includes(category)) {
    errorMessages.push(`categoryが不正です（許可値: ${ALLOWED_CATEGORIES.join(', ')}）`);
  }

  let distance = null;

  if (rawDistance === null || rawDistance === '') {
    errorMessages.push('distanceは必須です');
  } else {
    distance = Number(rawDistance);

    if (!Number.isFinite(distance)) {
      errorMessages.push('distanceは数値で指定してください');
    } else if (!ALLOWED_DISTANCES_KM.includes(distance)) {
      errorMessages.push(`distanceが不正です（許可値: ${ALLOWED_DISTANCES_KM.join(', ')}）`);
    }
  }

  const isValid = errorMessages.length === 0;

  return {
    isValid,
    errorMessages,
    value: isValid ? { purpose, category, distance } : null
  };
};
