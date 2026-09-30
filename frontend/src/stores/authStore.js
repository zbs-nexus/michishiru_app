import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import {
  fetchSignedInUsername,
  signInWithPassword,
  signOutFromCognito,
  toAuthErrorMessage
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

  /** 直近のサインイン失敗の理由。成功時はnull */
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
   * @description サインアウトする
   * @returns {Promise<void>}
   */
  const signOut = async () => {
    await signOutFromCognito();
    username.value = null;
    errorMessage.value = null;
  };

  return {
    username,
    isSessionRestored,
    isSigningIn,
    errorMessage,
    isSignedIn,
    restoreSession,
    signIn,
    signOut
  };
});
