import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  confirmPasswordResetWithCode,
  confirmSignUpWithCode,
  fetchSignedInUsername,
  resendConfirmationCode,
  sendPasswordResetCode,
  signInWithPassword,
  signOutFromCognito,
  signUpWithEmail,
  toAuthErrorMessage,
  toPasswordResetErrorMessage,
  toSignUpErrorMessage
} from '@/services/authService';

/**
 * @description ログイン状態を保持するグローバルストア。
 * ルーターガードと各画面から参照するため、Piniaで一元管理する。
 */
export const useAuthStore = defineStore('auth', () => {
  /** サインイン中のユーザー名。未サインインの場合はnull */
  const username = ref(null);

  /** Cognito のセッションを確認済みかどうか（再読み込み直後の二重確認を防ぐ） */
  const isSessionRestored = ref(false);

  /** サインインの通信中かどうか */
  const isSigningIn = ref(false);

  /** ユーザー登録の通信中かどうか */
  const isSigningUp = ref(false);

  /** パスワード再設定の通信中かどうか */
  const isResettingPassword = ref(false);

  /** 直近のサインイン・ユーザー登録の失敗の理由。成功時はnull */
  const errorMessage = ref(null);

  /** サインイン済みかどうか */
  const isSignedIn = computed(() => username.value !== null);

  /**
   * @description 保存されているセッションからログイン状態を復元する
   * @returns {Promise<void>}
   */
  const restoreSession = async () => {
    username.value = await fetchSignedInUsername();
    isSessionRestored.value = true;
  };

  /**
   * @description ユーザー名とパスワードでサインインする
   * @param {string} inputUsername 入力されたユーザー名
   * @param {string} inputPassword 入力されたパスワード
   * @returns {Promise<boolean>} 成功したかどうか
   */
  const signIn = async (inputUsername, inputPassword) => {
    isSigningIn.value = true;
    errorMessage.value = null;

    try {
      await signInWithPassword(inputUsername, inputPassword);
      username.value = await fetchSignedInUsername();

      return true;
    } catch (error) {
      errorMessage.value = toAuthErrorMessage(error);

      return false;
    } finally {
      isSigningIn.value = false;
    }
  };

  /**
   * @description ユーザーを新規登録する。
   * 登録できてもこの時点ではまだサインインしておらず、
   * メールで届く確認コードを confirmSignUp に渡すまで有効にならない。
   * @param {string} inputUsername 入力されたユーザー名
   * @param {string} inputEmail 入力されたメールアドレス
   * @param {string} inputPassword 入力されたパスワード
   * @returns {Promise<{isSucceeded: boolean, isConfirmationRequired: boolean, codeDeliveryDestination: string|null}>} 登録の結果
   */
  const signUp = async (inputUsername, inputEmail, inputPassword) => {
    isSigningUp.value = true;
    errorMessage.value = null;

    try {
      const { isConfirmationRequired, codeDeliveryDestination } =
        await signUpWithEmail(inputUsername, inputEmail, inputPassword);

      return { isSucceeded: true, isConfirmationRequired, codeDeliveryDestination };
    } catch (error) {
      errorMessage.value = toSignUpErrorMessage(error);

      return {
        isSucceeded: false,
        isConfirmationRequired: false,
        codeDeliveryDestination: null
      };
    } finally {
      isSigningUp.value = false;
    }
  };

  /**
   * @description 確認コードでユーザー登録を確定する
   * @param {string} inputUsername 登録したユーザー名
   * @param {string} inputConfirmationCode 入力された確認コード
   * @returns {Promise<boolean>} 成功したかどうか
   */
  const confirmSignUp = async (inputUsername, inputConfirmationCode) => {
    isSigningUp.value = true;
    errorMessage.value = null;

    try {
      await confirmSignUpWithCode(inputUsername, inputConfirmationCode);

      return true;
    } catch (error) {
      errorMessage.value = toSignUpErrorMessage(error);

      return false;
    } finally {
      isSigningUp.value = false;
    }
  };

  /**
   * @description 確認コードを再送する
   * @param {string} inputUsername 登録したユーザー名
   * @returns {Promise<boolean>} 成功したかどうか
   */
  const resendCode = async (inputUsername) => {
    isSigningUp.value = true;
    errorMessage.value = null;

    try {
      await resendConfirmationCode(inputUsername);

      return true;
    } catch (error) {
      errorMessage.value = toSignUpErrorMessage(error);

      return false;
    } finally {
      isSigningUp.value = false;
    }
  };

  /**
   * @description パスワード再設定の確認コードを送る。
   * この時点ではまだパスワードは変わらない。
   * @param {string} inputUsername 入力されたユーザー名
   * @returns {Promise<{isSucceeded: boolean, codeDeliveryDestination: string|null}>} 送信の結果とコードの送信先
   */
  const resetPassword = async (inputUsername) => {
    isResettingPassword.value = true;
    errorMessage.value = null;

    try {
      const codeDeliveryDestination = await sendPasswordResetCode(inputUsername);

      return { isSucceeded: true, codeDeliveryDestination };
    } catch (error) {
      errorMessage.value = toPasswordResetErrorMessage(error);

      return { isSucceeded: false, codeDeliveryDestination: null };
    } finally {
      isResettingPassword.value = false;
    }
  };

  /**
   * @description 確認コードと新しいパスワードで再設定を確定する
   * @param {string} inputUsername 対象のユーザー名
   * @param {string} inputConfirmationCode 入力された確認コード
   * @param {string} inputNewPassword 入力された新しいパスワード
   * @returns {Promise<boolean>} 成功したかどうか
   */
  const confirmResetPassword = async (
    inputUsername,
    inputConfirmationCode,
    inputNewPassword
  ) => {
    isResettingPassword.value = true;
    errorMessage.value = null;

    try {
      await confirmPasswordResetWithCode(
        inputUsername,
        inputConfirmationCode,
        inputNewPassword
      );

      return true;
    } catch (error) {
      errorMessage.value = toPasswordResetErrorMessage(error);

      return false;
    } finally {
      isResettingPassword.value = false;
    }
  };

  /**
   * @description サインアウトする
   * @returns {Promise<void>}
   */
  const signOut = async () => {
    await signOutFromCognito();
    username.value = null;
    errorMessage.value = null;
  };

  /**
   * @description 直近の失敗メッセージを消す。
   * 画面を切り替えたときに前の画面のエラーが残らないようにする。
   * @returns {void}
   */
  const clearErrorMessage = () => {
    errorMessage.value = null;
  };

  return {
    username,
    isSessionRestored,
    isSigningIn,
    isSigningUp,
    isResettingPassword,
    errorMessage,
    isSignedIn,
    restoreSession,
    signIn,
    signUp,
    confirmSignUp,
    resendCode,
    resetPassword,
    confirmResetPassword,
    signOut,
    clearErrorMessage
  };
});
