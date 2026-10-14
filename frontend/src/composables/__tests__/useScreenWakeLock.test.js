import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useScreenWakeLock } from '@/composables/useScreenWakeLock';

/**
 * @description composable を component の中で呼び、戻り値を取り出す。
 * onBeforeUnmount を含むため、component のライフサイクルの中で実行する必要がある
 * @returns {{screenWakeLock: object, wrapper: object}} composable の戻り値とマウントした wrapper
 */
const callInComponent = () => {
  let screenWakeLock = null;

  const wrapper = mount({
    setup() {
      screenWakeLock = useScreenWakeLock();
      return () => null;
    }
  });

  return { screenWakeLock, wrapper };
};

/**
 * @description 取得の完了を任意のタイミングで起こせる Screen Wake Lock を用意する。
 * 取得は非同期のため、待ち合わせ中に別の呼び出しやアンマウントが入る状況を再現する
 * @returns {object} ロックの番人と、取得を完了させる関数
 */
const stubDeferredWakeLock = () => {
  const releasedSentinels = [];

  /**
   * @description 取得できたことにする番人を作る
   * @returns {object} WakeLockSentinel を模した番人
   */
  const createSentinel = () => {
    const sentinel = {
      released: false,
      addEventListener: vi.fn(),
      release: vi.fn(async () => {
        sentinel.released = true;
        releasedSentinels.push(sentinel);
      })
    };

    return sentinel;
  };

  const pendingResolvers = [];
  const requestedSentinels = [];

  const request = vi.fn(
    () =>
      new Promise((resolve) => {
        pendingResolvers.push(resolve);
      })
  );

  Object.defineProperty(navigator, 'wakeLock', {
    value: { request },
    configurable: true
  });

  return {
    request,
    requestedSentinels,
    releasedSentinels,
    /**
     * @description 待ち合わせ中の取得を1件完了させる
     * @returns {Promise<void>}
     */
    resolveRequest: async () => {
      const sentinel = createSentinel();
      requestedSentinels.push(sentinel);
      pendingResolvers.shift()(sentinel);
      // 取得後の処理（保持するか捨てるか）が走り切るのを待つ
      await flushPromises();
    }
  };
};

afterEach(() => {
  // 既定の jsdom と同じ「未対応の環境」へ戻す
  Reflect.deleteProperty(navigator, 'wakeLock');
  vi.restoreAllMocks();
});

describe('useScreenWakeLock', () => {
  // jsdom に navigator.wakeLock は無いため、未対応環境と同じ条件になる
  test('Screen Wake Lock に未対応の環境でも失敗せず、抑止なしのまま進む', async () => {
    const { screenWakeLock } = callInComponent();
    const { isScreenAwake, requestScreenWakeLock, releaseScreenWakeLock } = screenWakeLock;

    await expect(requestScreenWakeLock()).resolves.toBeUndefined();
    await expect(releaseScreenWakeLock()).resolves.toBeUndefined();

    expect(isScreenAwake.value).toBe(false);
  });

  test('ロックを取得できた場合は抑止中として扱う', async () => {
    const wakeLock = stubDeferredWakeLock();
    const { screenWakeLock } = callInComponent();

    screenWakeLock.requestScreenWakeLock();
    await wakeLock.resolveRequest();

    expect(screenWakeLock.isScreenAwake.value).toBe(true);
    expect(wakeLock.releasedSentinels).toHaveLength(0);
  });

  test('取得の待ち合わせ中に呼び直されても二重にロックを取らない', async () => {
    const wakeLock = stubDeferredWakeLock();
    const { screenWakeLock } = callInComponent();

    screenWakeLock.requestScreenWakeLock();
    screenWakeLock.requestScreenWakeLock();

    expect(wakeLock.request).toHaveBeenCalledTimes(1);

    await wakeLock.resolveRequest();

    expect(screenWakeLock.isScreenAwake.value).toBe(true);
  });

  test('取得の待ち合わせ中にアンマウントされた場合も、解決したロックを解放する', async () => {
    const wakeLock = stubDeferredWakeLock();
    const { screenWakeLock, wrapper } = callInComponent();

    screenWakeLock.requestScreenWakeLock();
    // 取得が解決する前に案内画面を離れる
    wrapper.unmount();

    await wakeLock.resolveRequest();

    // 解放し損ねると、案内画面を離れた後もリロードまで画面が消灯しなくなる
    expect(wakeLock.releasedSentinels).toHaveLength(1);
    expect(screenWakeLock.isScreenAwake.value).toBe(false);
  });

  test('取得済みのロックはアンマウントで解放される', async () => {
    const wakeLock = stubDeferredWakeLock();
    const { screenWakeLock, wrapper } = callInComponent();

    screenWakeLock.requestScreenWakeLock();
    await wakeLock.resolveRequest();

    wrapper.unmount();
    // 解放は非同期のため、onBeforeUnmount が始めた処理が終わるのを待つ
    await flushPromises();

    expect(wakeLock.releasedSentinels).toHaveLength(1);
    expect(screenWakeLock.isScreenAwake.value).toBe(false);
  });
});
