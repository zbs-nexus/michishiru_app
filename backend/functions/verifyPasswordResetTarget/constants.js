/**
 * @description verifyPasswordResetTarget関数が使う定数。
 * 環境依存値は環境変数から取得し、ハードコードしない。
 * このファイルだけが process.env を読む。
 */

/** 照合先のCognitoユーザープールID */
export const USER_POOL_ID = process.env.USER_POOL_ID ?? '';

/** ユーザー名の最大文字数（フロントの入力チェックと同じ値） */
export const USERNAME_MAX_LENGTH = 20;

/** メールアドレスの最大文字数（フロントの入力チェックと同じ値） */
export const EMAIL_MAX_LENGTH = 254;
