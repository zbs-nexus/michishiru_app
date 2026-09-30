/**
 * @description 認証の入力チェックに使う定数。
 * 値はCognitoのユーザープールに設定されたポリシーと揃える。
 * ここを変えるだけでは実際のポリシーは変わらないため、
 * 変更する場合はユーザープール側の設定も合わせて直すこと。
 */

/** パスワードの最小文字数（ユーザープールのポリシーと同じ値） */
export const PASSWORD_MIN_LENGTH = 8;

/** パスワードの条件を利用者に伝える文言 */
export const PASSWORD_POLICY_HINT =
  '8文字以上で、大文字・小文字・数字・記号をそれぞれ1文字以上含めてください';

/** メールで届く確認コードの桁数 */
export const CONFIRMATION_CODE_LENGTH = 6;
