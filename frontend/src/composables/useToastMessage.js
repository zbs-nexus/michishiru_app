import { onUnmounted, ref } from 'vue';

/** メッセージを自動で閉じるまでの時間（ミリ秒） */
const TOAST_DURATION_MS = 4000;

/**
 * @description 画面上部に表示する一時メッセージの状態を管理する。
 * 一定時間で自動的に閉じ、表示中に新しいメッセージが来た場合は差し替える。
 * @returns {object} メッセージ・種類と表示・非表示の関数
 */
export const useToastMessage = () => {
  /** 表示中のメッセージ。非表示のときはnull */
  const message = ref(null);

  /** 表示中のメッセージの種類（BaseToast の variant） */
  const variant = ref('error');

  /** 自動で閉じるためのタイマーID */
  let timerId = null;

  /**
   * @description メッセージを非表示にする
   * @returns {void}
   */
  const hideMessage = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }

    message.value = null;
  };

  /**
   * @description メッセージを表示する
   * @param {string} text 表示する文言
   * @param {'error'|'omakase'|'success'} [type] メッセージの種類。省略時はエラー
   * @returns {void}
   */
  const showMessage = (text, type = 'error') => {
    // 連続で呼ばれても最後のメッセージだけが残るようにタイマーを張り直す
    hideMessage();

    message.value = text;
    variant.value = type;
    timerId = setTimeout(hideMessage, TOAST_DURATION_MS);
  };

  // 画面を離れた後にタイマーが残らないようにする
  onUnmounted(hideMessage);

  return {
    message,
    variant,
    showMessage,
    hideMessage
  };
};
