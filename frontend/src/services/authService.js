import {
  getCurrentUser,
  signIn as cognitoSignIn,
  signOut as cognitoSignOut
} from 'aws-amplify/auth';

/**
 * @description Cognito を使った認証処理をまとめる。
 * ライブラリへの依存をこのファイルに閉じ込め、呼び出し側は例外だけを扱う。
 */

/** Cognito が返す例外名と、画面に出す文言の対応 */
const ERROR_MESSAGES = {
  NotAuthorizedException: 'ユーザー名またはパスワードが違います',
  UserNotFoundException: 'ユーザー名またはパスワードが違います',
  UserNotConfirmedException: 'このユーザーは有効化されていません。管理者に連絡してください',
  PasswordResetRequiredException: 'パスワードの再設定が必要です。管理者に連絡してください',
  TooManyRequestsException: '試行回数が多すぎます。しばらく待ってから試してください',
  EmptySignInUsername: 'ユーザー名を入力してください',
  EmptySignInPassword: 'パスワードを入力してください',
  // 仮パスワードのまま（恒久パスワードが未設定）の場合に出る
  CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED:
    'パスワードの初期設定が必要です。管理者に連絡してください'
};

/** 対応表に無い例外に使う文言 */
const DEFAULT_ERROR_MESSAGE = 'ログインに失敗しました。通信状況を確認してください';

/**
 * @description 認証の例外を、画面に出せる文言へ変換する
 * @param {Error} error 発生した例外
 * @returns {string} 画面に出す文言
 */
export const toAuthErrorMessage = (error) =>
  ERROR_MESSAGES[error?.name] ?? DEFAULT_ERROR_MESSAGE;

/**
 * @description ユーザー名とパスワードでサインインする。
 * 通信方式はSRPで、パスワードそのものはネットワークに流れない。
 * @param {string} username ユーザー名
 * @param {string} password パスワード
 * @returns {Promise<void>} 成功時は何も返さない。失敗時は例外を投げる
 */
export const signInWithPassword = async (username, password) => {
  const { isSignedIn, nextStep } = await cognitoSignIn({ username, password });

  if (isSignedIn) {
    return;
  }

  // MFAや初回パスワード変更など、追加の手続きを求められた場合。
  // 対応する画面を用意していないため、失敗として上位へ返す
  const error = new Error(`サインインが完了しませんでした: ${nextStep.signInStep}`);
  error.name = nextStep.signInStep;
  throw error;
};

/**
 * @description サインアウトしてトークンを破棄する
 * @returns {Promise<void>}
 */
export const signOutFromCognito = () => cognitoSignOut();

/**
 * @description 保存されているセッションから、サインイン中のユーザー名を取得する。
 * 再読み込み後にログイン状態を復元するために使う。
 * @returns {Promise<string|null>} ユーザー名。未サインインの場合はnull
 */
export const fetchSignedInUsername = async () => {
  try {
    const { username } = await getCurrentUser();

    return username;
  } catch {
    // 未サインインでも例外になる仕様のため、サインインしていない状態として扱う
    return null;
  }
};
