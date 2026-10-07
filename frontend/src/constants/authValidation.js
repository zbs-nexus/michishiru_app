/**
 * @description 認証の入力チェックに使う定数。
 * パスワードの条件はCognitoのユーザープールに設定されたポリシーと揃える。
 * ここを変えるだけでは実際のポリシーは変わらないため、
 * 変更する場合はユーザープール側の設定も合わせて直すこと。
 */

/** ユーザー名の最大文字数 */
export const USERNAME_MAX_LENGTH = 20;

/** パスワードの最小文字数（ユーザープールのポリシーと同じ値） */
export const PASSWORD_MIN_LENGTH = 8;

/** パスワードの最大文字数 */
export const PASSWORD_MAX_LENGTH = 64;

/**
 * メールアドレスの最大文字数。
 * RFC 5321 が定める上限（ローカル部64 + @ + ドメイン部255 の実用上限）に合わせる。
 */
export const EMAIL_MAX_LENGTH = 254;

/**
 * 受け付ける文字の範囲（半角英数字と半角記号）。
 * `\x21`（!）から `\x7E`（~）までのASCII表示文字で、空白は含まない。
 * 全角文字・ひらがな・漢字・空白を弾くために使う。
 */
export const HALF_WIDTH_PATTERN = /^[\x21-\x7E]+$/;

/** 入力できる文字を利用者に伝える文言 */
export const HALF_WIDTH_HINT = '半角の英数字と記号で入力してください';

/** パスワードの条件を利用者に伝える文言 */
export const PASSWORD_POLICY_HINT =
  '8文字以上64文字以内の半角英数字記号で、大文字・小文字・数字・記号をそれぞれ1文字以上含めてください';

/** メールで届く確認コードの桁数 */
export const CONFIRMATION_CODE_LENGTH = 6;

/**
 * 確認コードとして受け付ける形（半角数字6桁）。
 * 桁数は CONFIRMATION_CODE_LENGTH と合わせること。
 */
export const CONFIRMATION_CODE_PATTERN = /^[0-9]{6}$/;
