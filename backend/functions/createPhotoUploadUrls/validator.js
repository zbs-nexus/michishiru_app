import { MAX_PHOTO_COUNT } from './constants.js';

/**
 * @description createPhotoUploadUrlsリクエストのバリデーション。
 * 副作用やデータ参照を持たない純粋関数とする。
 */

/**
 * @description 写真アップロードURLの発行リクエストを検証する
 * @param {object} body リクエストボディ（count）
 * @returns {{isValid: boolean, errorMessages: string[], value: {count: number}|null}} 検証結果
 */
export const validateCreatePhotoUploadUrlsRequest = (body = {}) => {
  const errorMessages = [];

  const count = Number(body.count);

  if (!Number.isInteger(count) || count < 1 || count > MAX_PHOTO_COUNT) {
    errorMessages.push(`countは1〜${MAX_PHOTO_COUNT}の整数で指定してください`);
  }

  const isValid = errorMessages.length === 0;

  return {
    isValid,
    errorMessages,
    value: isValid ? { count } : null
  };
};
