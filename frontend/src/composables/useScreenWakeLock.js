import { onBeforeUnmount, ref } from 'vue';

/**
 * @description 案内中に画面の自動消灯を抑止する composable。
 * Screen Wake Lock API でロックを取得し、案内画面を離れる際に解放する。
 *
 * この API でできることには限界があるため、過信しない前提で使う。
 * - 抑止できるのは画面の「自動」消灯だけで、利用者が手動で画面をロックした場合や
 *   他アプリへ切り替えた場合に測位が続くことは保証できない。
 * - Web にバックグラウンドで測位を継続する手段はない。これは根本解決ではなく緩和策で、
 *   止まってしまった場合は walkStore の hasMeasurementGap 側で記録して結果画面で注記する。
 * - iOS Safari は 16.4 以降で利用できる。未対応環境では何もしない（例外も投げない）。
 */

/**
 * @description 画面の消灯抑止を提供する composable
 * @returns {object} 消灯抑止の状態と制御関数
 */
export const useScreenWakeLock = () => {
  /** 画面の消灯を抑止できているかどうか */
  const isScreenAwake = ref(false);

  /**
   * 取得したロックの番人（WakeLockSentinel）。
   * テンプレートから参照しないため、リアクティブにせず素の変数で持つ
   */
  let sentinel = null;

  /**
   * ロックの取得を要求して、まだ結果が返っていないかどうか。
   * 取得は非同期で、解決するまで sentinel は null のままになる。
   * この間を見張らないと、二重に取ったロックや画面を離れた後に解決したロックが
   * 誰にも解放されないまま残り、リロードまで画面が消灯しなくなる
   */
  let isRequesting = false;

  /**
   * 取得の待ち合わせ中に解放を求められたかどうか。
   * 立っている場合、解決したロックは保持せずその場で捨てる
   */
  let isReleaseRequested = false;

  /**
   * @description 取得したロックを捨てる。
   * 解放の失敗はいずれも対処できないため、警告だけ残して先へ進む
   * @param {WakeLockSentinel} targetSentinel 解放するロックの番人
   * @returns {Promise<void>}
   */
  const releaseSentinel = async (targetSentinel) => {
    try {
      await targetSentinel.release();
    } catch (error) {
      // すでに自動解放されていた場合もここに来る。解放が目的なので支障はない
      console.warn('画面の消灯抑止を解放できませんでした', error);
    }
  };

  /**
   * @description 画面の消灯抑止を取得する。
   * ロックはページが非表示になると自動で解放されるため、復帰のたびに呼び直してよい。
   * 取得中の呼び出しは何もせず抜け、すでに有効なロックがあれば取り直さないため、
   * 呼び出し側で取得済みかどうかを見張る必要はない。
   * @returns {Promise<void>}
   */
  const requestScreenWakeLock = async () => {
    // 未対応のブラウザでは機能検出で抜ける。案内そのものは消灯抑止なしでも成立する
    if (!('wakeLock' in navigator)) {
      return;
    }

    // 取得の結果を待っている間は何もしない。重ねて要求すると、先に取ったロックの
    // 番人が上書きされて解放できなくなる
    if (isRequesting) {
      return;
    }

    // すでに有効なロックを持っていれば取り直さない
    if (sentinel !== null && !sentinel.released) {
      return;
    }

    isRequesting = true;
    isReleaseRequested = false;

    try {
      const requestedSentinel = await navigator.wakeLock.request('screen');

      // 待っている間に解放を求められた場合（案内画面を離れたなど）は保持しない。
      // ここで捨てないと、誰も参照していないロックが残り続ける
      if (isReleaseRequested) {
        await releaseSentinel(requestedSentinel);
        return;
      }

      sentinel = requestedSentinel;
      isScreenAwake.value = true;

      // 非表示などで自動解放されたときに状態を合わせる。
      // ここで sentinel を捨てることで、復帰時の呼び直しが取得へ進める
      sentinel.addEventListener('release', () => {
        isScreenAwake.value = false;
        sentinel = null;
      });
    } catch (error) {
      // 取得失敗は利用者に見せない。案内は続けられるため、知らせても対処できない。
      // 開発者が原因に気付けるようコンソールにだけ残す
      sentinel = null;
      isScreenAwake.value = false;
      console.warn('画面の消灯抑止を取得できませんでした', error);
    } finally {
      isRequesting = false;
    }
  };

  /**
   * @description 画面の消灯抑止を解放する
   * @returns {Promise<void>}
   */
  const releaseScreenWakeLock = async () => {
    // 取得の待ち合わせ中に呼ばれた場合は、解決後に捨てさせるため要求だけ残す。
    // この時点では解放する対象（sentinel）がまだ存在しない
    isReleaseRequested = true;

    if (sentinel === null) {
      return;
    }

    await releaseSentinel(sentinel);

    sentinel = null;
    isScreenAwake.value = false;
  };

  // コンポーネントの破棄時に必ず解放する。残すと案内画面を離れた後も消灯が止まる
  onBeforeUnmount(() => {
    releaseScreenWakeLock();
  });

  return {
    isScreenAwake,
    requestScreenWakeLock,
    releaseScreenWakeLock
  };
};
