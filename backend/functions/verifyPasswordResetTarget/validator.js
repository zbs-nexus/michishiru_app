import { EMAIL_MAX_LENGTH, USERNAME_MAX_LENGTH } from './constants.js';

/**
 * @description 照合リクエストの入力チェックを担当する。
 * 副作用を持たない純粋関数として実装する。
 */

/** 受け付ける文字の範囲（半角英数字と半角記号。空白は含まない） */
const HALF_WIDTH_PATTERN = /^[\x21-\x7E]+$/;

/**
 * @description 文字列として扱える値かどうかを判定する
 * @param {unknown} value 判定する値
 * @returns {boolean} 空でない文字列の場合はtrue
 */
const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;

/**
 * @description 照合リクエストを検証する
 * @param {object} body リクエストボディ
 * @returns {{isValid: boolean, errorMessages: string[], value: {username: string, email: string}}} 検証の結果と、検証済みの値
 */
export const validateVerifyRequest = (body) => {
  const errorMessages = [];
  const username = isNonEmptyString(body?.username) ? body.username.trim() : '';
  const email = isNonEmptyString(body?.email) ? body.email.trim() : '';

  if (username === '') {
    errorMessages.push('username は必須です');
  } else if (username.length > USERNAME_MAX_LENGTH) {
    errorMessages.push(`username は${USERNAME_MAX_LENGTH}文字以内で指定してください`);
  } else if (!HALF_WIDTH_PATTERN.test(username)) {
    errorMessages.push('username は半角の英数字と記号で指定してください');
  }

  if (email === '') {
    errorMessages.push('email は必須です');
  } else if (email.length > EMAIL_MAX_LENGTH) {
    errorMessages.push(`email は${EMAIL_MAX_LENGTH}文字以内で指定してください`);
  } else if (!email.includes('@')) {
    errorMessages.push('email には@を含めてください');
  }

  return {
    isValid: errorMessages.length === 0,
    errorMessages,
    value: { username, email }
  };
};
