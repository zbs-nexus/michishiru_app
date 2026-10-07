import { computed, ref } from 'vue';

/**
 * @description パスワード欄の表示・非表示の状態を管理する。
 * ログイン・ユーザー登録・パスワード再設定で同じ挙動を使うため切り出している。
 *
 * 状態は入力欄ごとに持つため、1つの欄につき1回呼ぶ。
 *
 * エラーが出た直後は表示ボタンを出さない。
 * 入力が修正されるまで隠し続けることで、
 * 画面に残ったエラーと平文のパスワードが同時に見える状態を避ける。
 * @returns {object} 表示状態と、状態を変える関数
 */
export const usePasswordVisibility = () => {
  /** パスワードを平文で表示しているかどうか */
  const isPasswordVisible = ref(false);

  /** 表示ボタンを出してよい状態かどうか。エラー直後はfalseにする */
  const isPasswordRevealAvailable = ref(true);

  /** パスワード欄に渡す input の type */
  const passwordInputType = computed(() =>
    isPasswordVisible.value ? 'text' : 'password'
  );

  /**
   * @description 表示と非表示を切り替える
   * @returns {void}
   */
  const togglePasswordVisibility = () => {
    isPasswordVisible.value = !isPasswordVisible.value;
  };

  /**
   * @description 表示ボタンを隠す。エラーが出たときに呼ぶ。
   * 平文表示中だった場合は隠した状態へ戻す。
   * @returns {void}
   */
  const disablePasswordReveal = () => {
    isPasswordVisible.value = false;
    isPasswordRevealAvailable.value = false;
  };

  /**
   * @description 表示ボタンを再び出せるようにする。入力が修正されたときに呼ぶ。
   * @returns {void}
   */
  const enablePasswordReveal = () => {
    isPasswordRevealAvailable.value = true;
  };

  return {
    isPasswordVisible,
    isPasswordRevealAvailable,
    passwordInputType,
    togglePasswordVisibility,
    disablePasswordReveal,
    enablePasswordReveal
  };
};
