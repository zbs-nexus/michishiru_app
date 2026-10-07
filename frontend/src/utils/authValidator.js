import {
  CONFIRMATION_CODE_LENGTH,
  CONFIRMATION_CODE_PATTERN,
  EMAIL_MAX_LENGTH,
  HALF_WIDTH_HINT,
  HALF_WIDTH_PATTERN,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  USERNAME_MAX_LENGTH
} from '@/constants/authValidation';

/**
 * @description 認証フォームの入力チェックを行う。
 * Vueに依存しない純粋関数で、エラーがあれば表示用の文言を、無ければnullを返す。
 * 画面側はこの戻り値をそのまま項目のエラーとして扱う。
 *
 * サーバー（Cognito）側でも同じ条件が検証されるが、
 * 往復を待たずに気付けるようにするため、送信前にここで確認する。
 */

/**
 * @description ユーザー名を検証する
 * @param {string} username 入力されたユーザー名
 * @returns {string|null} エラーの文言。問題が無い場合はnull
 */
export const validateUsername = (username) => {
  if (username === '') {
    return 'ユーザー名を入力してください';
  }

  if (username.length > USERNAME_MAX_LENGTH) {
    return `ユーザー名は${USERNAME_MAX_LENGTH}文字以内で入力してください`;
  }

  if (!HALF_WIDTH_PATTERN.test(username)) {
    return `ユーザー名は${HALF_WIDTH_HINT}`;
  }

  return null;
};

/**
 * @description メールアドレスを検証する。
 * 形式の厳密な判定は行わず、長さ・文字種と「@が入っていること」だけを見る。
 * 実在するかどうかは確認コードの到達で分かるため、ここでは踏み込まない。
 * @param {string} email 入力されたメールアドレス
 * @returns {string|null} エラーの文言。問題が無い場合はnull
 */
export const validateEmail = (email) => {
  if (email === '') {
    return 'メールアドレスを入力してください';
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    return `メールアドレスは${EMAIL_MAX_LENGTH}文字以内で入力してください`;
  }

  if (!HALF_WIDTH_PATTERN.test(email)) {
    return `メールアドレスは${HALF_WIDTH_HINT}`;
  }

  if (!email.includes('@')) {
    return 'メールアドレスには@を含めてください';
  }

  return null;
};

/**
 * @description パスワードを検証する
 * @param {string} password 入力されたパスワード
 * @param {string} [label] 画面に出す項目名。新しいパスワードの欄では差し替える
 * @returns {string|null} エラーの文言。問題が無い場合はnull
 */
export const validatePassword = (password, label = 'パスワード') => {
  if (password === '') {
    return `${label}を入力してください`;
  }

  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    return `${label}は${PASSWORD_MIN_LENGTH}文字以上${PASSWORD_MAX_LENGTH}文字以内で入力してください`;
  }

  if (!HALF_WIDTH_PATTERN.test(password)) {
    return `${label}は${HALF_WIDTH_HINT}`;
  }

  return null;
};

/**
 * @description 確認パスワードが元のパスワードと一致するかを検証する
 * @param {string} password 入力されたパスワード
 * @param {string} passwordConfirmation 入力された確認パスワード
 * @param {string} [label] 画面に出す項目名
 * @returns {string|null} エラーの文言。問題が無い場合はnull
 */
export const validatePasswordConfirmation = (
  password,
  passwordConfirmation,
  label = 'パスワード'
) => {
  if (passwordConfirmation === '') {
    return `確認のため${label}をもう一度入力してください`;
  }

  if (password !== passwordConfirmation) {
    return `${label}が一致しません`;
  }

  return null;
};

/**
 * @description メールで届いた確認コードを検証する
 * @param {string} confirmationCode 入力された確認コード
 * @returns {string|null} エラーの文言。問題が無い場合はnull
 */
export const validateConfirmationCode = (confirmationCode) => {
  if (confirmationCode === '') {
    return '確認コードを入力してください';
  }

  if (!CONFIRMATION_CODE_PATTERN.test(confirmationCode)) {
    return `確認コードは半角数字${CONFIRMATION_CODE_LENGTH}桁で入力してください`;
  }

  return null;
};

/**
 * @description エラーが1件も無いかどうかを判定する
 * @param {object} fieldErrors 項目名をキーに、エラーの文言またはnullを持つオブジェクト
 * @returns {boolean} すべての項目に問題が無い場合はtrue
 */
export const hasNoFieldError = (fieldErrors) =>
  Object.values(fieldErrors).every((error) => error === null);
