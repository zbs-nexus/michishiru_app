import {
  confirmResetPassword as cognitoConfirmResetPassword,
  confirmSignUp as cognitoConfirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resendSignUpCode as cognitoResendSignUpCode,
  resetPassword as cognitoResetPassword,
  signIn as cognitoSignIn,
  signOut as cognitoSignOut,
  signUp as cognitoSignUp
} from 'aws-amplify/auth';

/**
 * @description Cognito を使った認証処理をまとめる。
 * ライブラリへの依存をこのファイルに閉じ込め、呼び出し側は例外だけを扱う。
 */

/**
 * セッションが無い・失効した場合に画面へ出す文言。
 *
 * この文言だけ定数に切り出しているのは、2つの経路から同じものを出す必要があるため。
 * サインインの失敗は authStore が `toAuthErrorMessage` で対応表を引くが、
 * API の認可で失敗した場合は composable が `error.message` をそのまま表示する。
 * 対応表と throw するメッセージが別々だと、経路によって文言が変わってしまう。
 */
const NO_VALID_SESSION_MESSAGE =
  'ログインの有効期限が切れました。もう一度ログインしてください';

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
    'パスワードの初期設定が必要です。管理者に連絡してください',
  // ここから下はユーザー登録で出るもの
  UsernameExistsException: 'このユーザー名は既に使われています',
  InvalidPasswordException:
    'パスワードの条件を満たしていません。8文字以上で、大文字・小文字・数字・記号をそれぞれ含めてください',
  InvalidParameterException: '入力内容を確認してください',
  CodeMismatchException: '確認コードが違います',
  ExpiredCodeException:
    '確認コードの有効期限が切れています。コードを再送してください',
  CodeDeliveryFailureException:
    '確認コードを送信できませんでした。メールアドレスを確認してください',
  LimitExceededException: '試行回数が多すぎます。しばらく待ってから試してください',
  EmptySignUpUsername: 'ユーザー名を入力してください',
  EmptySignUpPassword: 'パスワードを入力してください',
  EmptyConfirmSignUpUsername: 'ユーザー名を入力してください',
  EmptyConfirmSignUpCode: '確認コードを入力してください',
  // ここから下はパスワード再設定で出るもの
  EmptyResetPasswordUsername: 'ユーザー名を入力してください',
  EmptyConfirmResetPasswordUsername: 'ユーザー名を入力してください',
  EmptyConfirmResetPasswordConfirmationCode: '確認コードを入力してください',
  EmptyConfirmResetPasswordNewPassword: '新しいパスワードを入力してください',
  // ここから下はAPIの認可で出るもの
  NoValidSession: NO_VALID_SESSION_MESSAGE
};

/**
 * パスワード再設定のときだけ文言を変える例外。
 * サインインと同じ対応表を使うと「パスワードが違います」のように場面に合わない文言になるため、
 * こちらを先に見る。
 */
const PASSWORD_RESET_ERROR_MESSAGES = {
  // ユーザーの有無を画面で言い当てないよう、あいまいな文言にする
  UserNotFoundException: 'ユーザー名を確認してください',
  // 入力されたユーザー名とメールアドレスの組み合わせが、登録内容と一致しなかった場合
  EmailMismatch: 'ユーザー名とメールアドレスの組み合わせが一致しません',
  // 照合そのものができなかった場合（APIへ到達できない等）
  VerificationUnavailable:
    '組み合わせを確認できませんでした。通信状況を確認してください',
  // メールアドレスが未確認のユーザーは、送信先が無いため再設定できない
  InvalidParameterException:
    'このユーザーはメールアドレスが未確認のため再設定できません。管理者に連絡してください'
};

/** サインインの対応表に無い例外に使う文言 */
const SIGN_IN_DEFAULT_ERROR_MESSAGE =
  'ログインに失敗しました。通信状況を確認してください';

/** ユーザー登録の対応表に無い例外に使う文言 */
const SIGN_UP_DEFAULT_ERROR_MESSAGE =
  'ユーザー登録に失敗しました。通信状況を確認してください';

/** パスワード再設定の対応表に無い例外に使う文言 */
const PASSWORD_RESET_DEFAULT_ERROR_MESSAGE =
  'パスワードの再設定に失敗しました。通信状況を確認してください';

/**
 * @description 認証の例外を、画面に出せる文言へ変換する
 * @param {Error} error 発生した例外
 * @returns {string} 画面に出す文言
 */
export const toAuthErrorMessage = (error) =>
  ERROR_MESSAGES[error?.name] ?? SIGN_IN_DEFAULT_ERROR_MESSAGE;

/**
 * @description ユーザー登録の例外を、画面に出せる文言へ変換する。
 * 対応表はサインインと共通で、当てはまらなかった場合の文言だけを変える。
 * @param {Error} error 発生した例外
 * @returns {string} 画面に出す文言
 */
export const toSignUpErrorMessage = (error) =>
  ERROR_MESSAGES[error?.name] ?? SIGN_UP_DEFAULT_ERROR_MESSAGE;

/**
 * @description パスワード再設定の例外を、画面に出せる文言へ変換する。
 * 再設定のときだけ文言を変える例外を先に見て、無ければ共通の対応表を使う。
 * @param {Error} error 発生した例外
 * @returns {string} 画面に出す文言
 */
export const toPasswordResetErrorMessage = (error) =>
  PASSWORD_RESET_ERROR_MESSAGES[error?.name] ??
  ERROR_MESSAGES[error?.name] ??
  PASSWORD_RESET_DEFAULT_ERROR_MESSAGE;

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
 * @description ユーザー名・メールアドレス・パスワードでユーザーを登録する。
 * ユーザープールはメールアドレスを必須属性としているため、登録時に必ず送る。
 *
 * 登録直後のユーザーは未確認の状態で、メールで届く確認コードを
 * `confirmSignUpWithCode` に渡すまでサインインできない。
 * @param {string} username ユーザー名
 * @param {string} email メールアドレス
 * @param {string} password パスワード
 * @returns {Promise<{isConfirmationRequired: boolean, codeDeliveryDestination: string|null}>} 確認コードの入力が必要かどうかと、コードの送信先
 * @throws {Error} 登録に失敗した場合、または未対応の手続きを求められた場合
 */
export const signUpWithEmail = async (username, email, password) => {
  const { isSignUpComplete, nextStep } = await cognitoSignUp({
    username,
    password,
    options: { userAttributes: { email } }
  });

  if (isSignUpComplete) {
    return { isConfirmationRequired: false, codeDeliveryDestination: null };
  }

  if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
    return {
      isConfirmationRequired: true,
      // 送信先はマスクされた形（例: a***@example.com）で返る
      codeDeliveryDestination: nextStep.codeDeliveryDetails?.destination ?? null
    };
  }

  // 自動サインインなど、対応する画面を用意していない手続きは失敗として返す
  const error = new Error(
    `ユーザー登録が完了しませんでした: ${nextStep.signUpStep}`
  );
  error.name = nextStep.signUpStep;
  throw error;
};

/**
 * @description メールで届いた確認コードでユーザーを有効化する
 * @param {string} username 登録したユーザー名
 * @param {string} confirmationCode メールで届いた確認コード
 * @returns {Promise<void>} 成功時は何も返さない。失敗時は例外を投げる
 * @throws {Error} コードが違う・期限切れ、または未対応の手続きを求められた場合
 */
export const confirmSignUpWithCode = async (username, confirmationCode) => {
  const { isSignUpComplete, nextStep } = await cognitoConfirmSignUp({
    username,
    confirmationCode
  });

  if (isSignUpComplete) {
    return;
  }

  const error = new Error(
    `ユーザー登録の確認が完了しませんでした: ${nextStep.signUpStep}`
  );
  error.name = nextStep.signUpStep;
  throw error;
};

/**
 * @description 確認コードを再送する
 * @param {string} username 登録したユーザー名
 * @returns {Promise<string|null>} コードの送信先（マスクされた形）
 * @throws {Error} 再送に失敗した場合
 */
export const resendConfirmationCode = async (username) => {
  const codeDeliveryDetails = await cognitoResendSignUpCode({ username });

  return codeDeliveryDetails?.destination ?? null;
};

/**
 * @description パスワードを忘れた利用者へ、再設定用の確認コードをメールで送る。
 *
 * 新しいパスワードはこの時点では決めず、`confirmPasswordResetWithCode` で設定する。
 * 送信先はユーザープールで確認済みのメールアドレスで、こちらからは指定できない。
 *
 * この関数を呼ぶ時点でコードが送信される。
 * ユーザー名とメールアドレスの組み合わせの照合は、呼ぶ前に
 * `passwordResetService.verifyPasswordResetTarget` で済ませておく。
 * @param {string} username ユーザー名
 * @returns {Promise<string|null>} コードの送信先（マスクされた形）。取得できない場合はnull
 * @throws {Error} 送信に失敗した場合、または未対応の手続きを求められた場合
 */
export const sendPasswordResetCode = async (username) => {
  const { nextStep } = await cognitoResetPassword({ username });

  if (nextStep.resetPasswordStep === 'CONFIRM_RESET_PASSWORD_WITH_CODE') {
    // 送信先はマスクされた形（例: a***@example.com）で返る
    return nextStep.codeDeliveryDetails?.destination ?? null;
  }

  // コード入力を伴わない設定（DONE）は想定していないため、失敗として返す
  const error = new Error(
    `パスワード再設定を開始できませんでした: ${nextStep.resetPasswordStep}`
  );
  error.name = nextStep.resetPasswordStep;
  throw error;
};

/**
 * @description メールで届いた確認コードで、新しいパスワードを設定する
 * @param {string} username ユーザー名
 * @param {string} confirmationCode メールで届いた確認コード
 * @param {string} newPassword 新しいパスワード
 * @returns {Promise<void>} 成功時は何も返さない。失敗時は例外を投げる
 * @throws {Error} コードが違う・期限切れ、またはパスワードが条件を満たさない場合
 */
export const confirmPasswordResetWithCode = (
  username,
  confirmationCode,
  newPassword
) => cognitoConfirmResetPassword({ username, confirmationCode, newPassword });

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

/**
 * @description APIの認可に使うIDトークンを取得する。
 * API Gateway のCognitoオーソライザーが検証するため、呼び出し側はこの値を
 * Authorization ヘッダーへそのまま載せる。
 *
 * 取得した値をモジュール変数にキャッシュしてはいけない。
 * idTokenの有効期限は1時間だが、散歩はそれより長く続くことがある。
 * `fetchAuthSession` はリフレッシュトークン（5日）で期限切れのトークンを
 * 自動更新するため、リクエストごとに呼ぶのが最も単純で安全。
 * キャッシュすると期限切れのトークンを送り続け、401になる。
 *
 * 取得できない場合はnullを返さず例外を投げる。呼び出し側が
 * 「通信に失敗した」ではなく「認証が切れた」と区別できる必要があるため。
 * @returns {Promise<string>} Cognito が発行したIDトークン
 * @throws {Error} 未サインイン、またはセッションが失効している場合（name は NoValidSession）
 */
export const fetchIdToken = async () => {
  const session = await fetchAuthSession();
  const idToken = session.tokens?.idToken?.toString();

  if (idToken) {
    return idToken;
  }

  // composable は error.message をそのまま画面へ出すため、ここに利用者向けの文言を入れる
  const error = new Error(NO_VALID_SESSION_MESSAGE);
  error.name = 'NoValidSession';
  throw error;
};
