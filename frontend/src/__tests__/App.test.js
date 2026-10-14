import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import App from '@/App.vue';
import { useAuthStore } from '@/stores/authStore';

/**
 * @description 退避した実績の再送が、どの合図で起きるかを確かめるテスト。
 *
 * 再送の中身（誰の分を送るか・何を捨てるか）は useWalkResultSave のテストで
 * 固定しているため、ここでは引き金の配線だけを見る。
 * 「サインイン済みで描画された場合」「描画後にサインインした場合」
 * 「通信が回復した場合」の3つで呼ばれ、画面を離れた後は呼ばれないこと。
 */

/** composable の差し替え先。vi.mock は巻き上げられるため hoisted で用意する */
const saveMocks = vi.hoisted(() => ({ flushPendingWalkResults: null }));

vi.mock('@/composables/useWalkResultSave', () => ({
  useWalkResultSave: () => ({
    isSaving: { value: false },
    saveErrorMessage: { value: null },
    saveCurrentWalkResult: vi.fn(),
    flushPendingWalkResults: saveMocks.flushPendingWalkResults
  })
}));

/**
 * @description ルートコンポーネントを描画する。
 * 表示中の画面はルーターが決めるため、RouterView は差し替える
 * @returns {object} マウントした wrapper
 */
const mountApp = () =>
  mount(App, {
    shallow: true,
    global: { stubs: { RouterView: true } }
  });

beforeEach(() => {
  setActivePinia(createPinia());
  saveMocks.flushPendingWalkResults = vi.fn();
});

describe('App の退避した実績の再送', () => {
  test('サインインしていない間は再送しない', async () => {
    mountApp();
    await nextTick();

    // 認可が必要なAPIのため、送っても通らない
    expect(saveMocks.flushPendingWalkResults).not.toHaveBeenCalled();
  });

  test('すでにサインイン済みで描画された場合も再送する', async () => {
    useAuthStore().username = 'walker-a';

    mountApp();
    await nextTick();

    // 再読み込み直後はセッションの復元が先に終わっているため、
    // 描画後の変化を待つ形（immediate なし）では取りこぼす
    expect(saveMocks.flushPendingWalkResults).toHaveBeenCalledTimes(1);
  });

  test('描画後にサインインした場合も再送する', async () => {
    const authStore = useAuthStore();

    mountApp();
    await nextTick();

    authStore.username = 'walker-a';
    await nextTick();

    expect(saveMocks.flushPendingWalkResults).toHaveBeenCalledTimes(1);
  });

  test('通信が回復したときに再送する', async () => {
    mountApp();
    await nextTick();

    window.dispatchEvent(new Event('online'));

    // 退避の原因は通信できなかったことなので、復帰も引き金に加える
    expect(saveMocks.flushPendingWalkResults).toHaveBeenCalledTimes(1);
  });

  test('画面を離れた後の通信の回復では再送しない', async () => {
    const wrapper = mountApp();
    await nextTick();

    wrapper.unmount();
    window.dispatchEvent(new Event('online'));

    // 購読を解除し忘れると、ストアを持たない状態で再送が走る
    expect(saveMocks.flushPendingWalkResults).not.toHaveBeenCalled();
  });
});
