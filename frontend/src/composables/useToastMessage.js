import { onUnmounted, ref } from 'vue';

/** メッセージを自動で閉じるまでの時間（ミリ秒） */
const TOAST_DURATION_MS = 4000;

/**
 * @description 画面上部に表示する一時メッセージの状態を管理する。
 * 一定時間で自動的に閉じ、表示中に新しいメッセージが来た場合は差し替える。
 * @returns {object} メッセージと表示・非表示の関数
 */
export const useToastMessage = () => {
  /** 表示中のメッセージ。非表示のときはnull */
  const message = ref(null);

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
   * @returns {void}
   */
  const showMessage = (text) => {
    // 連続で呼ばれても最後のメッセージだけが残るようにタイマーを張り直す
    hideMessage();

    message.value = text;
    timerId = setTimeout(hideMessage, TOAST_DURATION_MS);
  };

  // 画面を離れた後にタイマーが残らないようにする
  onUnmounted(hideMessage);

  return {
    message,
    showMessage,
    hideMessage
  };
};
