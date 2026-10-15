import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import BaseToast from '@/components/base/BaseToast.vue';
import WalkResultView from '@/views/WalkResultView.vue';
import { useRouteStore } from '@/stores/routeStore';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description 結果画面が実績の保存をどう起こし、失敗と計測状態をどう見せるかを
 * 確かめるテスト。
 *
 * 保存そのものの判断（退避するか捨てるか）は useWalkResultSave のテストで
 * 固定しているため、ここでは配線だけを見る。
 * 「保存が1回だけ起きるか」「失敗したときにトーストへ出るか」
 * 「計測状態ごとに注記を出し分けるか」の3点。
 *
 * 子コンポーネントは shallow で差し替える。レイアウトのスロットは
 * renderStubDefaultSlot で描画し、注記とトーストを読めるようにする。
 */

/** composable の差し替え先。vi.mock は巻き上げられるため hoisted で用意する */
const saveMocks = vi.hoisted(() => ({
  saveCurrentWalkResult: null,
  saveErrorMessage: { value: null }
}));

vi.mock('@/composables/useWalkResultSave', () => ({
  useWalkResultSave: () => ({
    isSaving: { value: false },
    saveErrorMessage: saveMocks.saveErrorMessage,
    saveCurrentWalkResult: saveMocks.saveCurrentWalkResult,
    flushPendingWalkResults: vi.fn()
  })
}));

// 遷移はホームへ戻る操作でしか使わないため、最小限の router を渡す
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}));

/**
 * @description 結果画面を shallow で描画する
 * @returns {object} マウントした wrapper
 */
const mountWalkResultView = () =>
  mount(WalkResultView, {
    shallow: true,
    global: { renderStubDefaultSlot: true }
  });

/**
 * @description 案内を終えた直後のストアの状態を作る
 * @param {object} [options] 計測の状況
 * @param {boolean} [options.hasLocationFix] 一度でも測位できたか
 * @param {boolean} [options.hasMeasurementGap] 計測の欠落を検知したか
 * @returns {void}
 */
const completeWalk = ({
  hasLocationFix = true,
  hasMeasurementGap = false
} = {}) => {
  const routeStore = useRouteStore();
  const walkStore = useWalkStore();

  routeStore.setCurrentRoute({ routeName: '公園めぐりコース' });

  walkStore.startWalk();

  if (hasLocationFix) {
    walkStore.markLocationFixed();
    walkStore.addDistanceM(1200);
  }

  if (hasMeasurementGap) {
    walkStore.markMeasurementGap();
  }

  walkStore.endWalk();
};

beforeEach(() => {
  setActivePinia(createPinia());
  saveMocks.saveErrorMessage.value = null;
  saveMocks.saveCurrentWalkResult = vi.fn(async () => true);
});

describe('WalkResultView の実績の保存', () => {
  test('描画された時点で保存を1回だけ起こす', async () => {
    completeWalk();

    mountWalkResultView();
    await flushPromises();

    // 案内画面ではなくこの画面で起こすため、遷移のたびに2回呼ばれてはいけない
    expect(saveMocks.saveCurrentWalkResult).toHaveBeenCalledTimes(1);
  });

  test('保存できた場合はトーストを出さない', async () => {
    completeWalk();

    const wrapper = mountWalkResultView();
    await flushPromises();

    expect(wrapper.findComponent(BaseToast).exists()).toBe(false);
  });

  test('保存に失敗した場合は失敗の文言をトーストで知らせる', async () => {
    completeWalk();
    saveMocks.saveCurrentWalkResult = vi.fn(async () => false);
    saveMocks.saveErrorMessage.value =
      '保存できませんでした。通信が回復したときに自動で保存します';

    const wrapper = mountWalkResultView();
    await flushPromises();

    expect(wrapper.findComponent(BaseToast).props('message')).toBe(
      '保存できませんでした。通信が回復したときに自動で保存します'
    );
  });
});

describe('WalkResultView の計測状態の注記', () => {
  test('完全に計測できた場合は注記を出さない', async () => {
    completeWalk();

    const wrapper = mountWalkResultView();
    await flushPromises();

    expect(wrapper.find('.hint').exists()).toBe(false);
  });

  test('一部を計測できなかった場合は短く出ている可能性を添える', async () => {
    completeWalk({ hasMeasurementGap: true });

    const wrapper = mountWalkResultView();
    await flushPromises();

    expect(wrapper.find('.hint').text()).toBe(
      '一部の区間を計測できなかったため、実際より短く表示されている可能性があります'
    );
  });

  test('一度も測位できなかった場合は計測できなかったことを伝える', async () => {
    completeWalk({ hasLocationFix: false });

    const wrapper = mountWalkResultView();
    await flushPromises();

    expect(wrapper.find('.hint').text()).toBe(
      '位置情報を取得できなかったため、実績を計測できませんでした'
    );
  });
});
