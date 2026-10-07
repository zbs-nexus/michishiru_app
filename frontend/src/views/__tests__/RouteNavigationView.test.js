import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import RouteNavigationView from '@/views/RouteNavigationView.vue';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description 案内画面が計測の欠落をどこで記録するかを確かめるテスト。
 * 判定そのものは walkStore 側のテストで固定しているため、ここでは
 * 「欠落を記録する引き金が配線されているか」「しきい値未満の中断では記録しないか」
 * 「画面を離れた後に引き金が残らないか」を見る。
 *
 * 子コンポーネント（地図など）は shallow で差し替える。地図の描画は
 * jsdom では動かず、ここで確かめたいことでもない。
 */

/** 欠落と判断するしきい値（ミリ秒）。View 側の MEASUREMENT_GAP_THRESHOLD_MS と揃える */
const MEASUREMENT_GAP_THRESHOLD_MS = 60000;

// 画面遷移は終了ボタン側の処理でしか使わないため、最小限の router を渡す
vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() })
}));

// ジャンルの取得は通信を伴うため、空の選択肢を返して通信させない
vi.mock('@/services/conditionService', () => ({
  fetchConditionOptions: vi.fn(async () => ({
    genreOptions: [],
    distanceRange: {}
  }))
}));

/** watchPosition が受け取ったコールバック。測位の成否をテストから起こすために持つ */
let positionCallbacks = null;

/**
 * @description 画面の表示状態を差し替える。
 * jsdom の document.visibilityState は読み取り専用のため、定義し直して切り替える
 * @param {string} visibilityState 差し替える表示状態（'visible' / 'hidden'）
 * @returns {void}
 */
const setVisibilityState = (visibilityState) => {
  Object.defineProperty(document, 'visibilityState', {
    value: visibilityState,
    configurable: true
  });
};

/**
 * @description 表示状態を切り替えて visibilitychange を発火させる
 * @param {string} visibilityState 切り替える表示状態（'visible' / 'hidden'）
 * @returns {Promise<void>}
 */
const changeVisibilityTo = async (visibilityState) => {
  setVisibilityState(visibilityState);
  document.dispatchEvent(new Event('visibilitychange'));
  await nextTick();
};

/**
 * @description 測位が失敗した状態にする（タイムアウト）
 * @returns {Promise<void>}
 */
const raiseTrackingError = async () => {
  positionCallbacks.onError({
    code: 3,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3
  });
  await nextTick();
};

/**
 * @description 測位が届いた状態にする
 * @param {number} [accuracy] 測位の精度（メートル）
 * @returns {Promise<void>}
 */
const receivePosition = async (accuracy = 10) => {
  positionCallbacks.onUpdate({
    coords: { longitude: 139.7, latitude: 35.69, accuracy }
  });
  await nextTick();
};

/**
 * @description 測位が復帰した状態にする
 * @returns {Promise<void>}
 */
const recoverTracking = () => receivePosition();

/**
 * @description 案内画面を shallow で描画する
 * @returns {object} マウントした wrapper
 */
const mountNavigationView = () => mount(RouteNavigationView, { shallow: true });

beforeEach(() => {
  setActivePinia(createPinia());
  setVisibilityState('visible');
  // 中断の長さで判定するため、時間を操作できるようにする
  vi.useFakeTimers();

  positionCallbacks = null;

  // 測位の成否をテストから起こせるよう、コールバックを受け取って保持する
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      watchPosition: vi.fn((onUpdate, onError) => {
        positionCallbacks = { onUpdate, onError };
        return 1;
      }),
      clearWatch: vi.fn()
    },
    configurable: true
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('RouteNavigationView の測位エラーによる欠落の記録', () => {
  test('測位が途切れたまましきい値を超えたら欠落を記録する', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    await raiseTrackingError();

    // しきい値の手前では、まだ失われたものがないため記録しない
    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS - 1);
    expect(walkStore.hasMeasurementGap).toBe(false);

    vi.advanceTimersByTime(1);

    expect(walkStore.hasMeasurementGap).toBe(true);
  });

  test('しきい値の前に測位が復帰したら欠落を記録しない', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    await raiseTrackingError();
    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS / 2);
    await recoverTracking();

    // 復帰でタイマーを捨てているため、この後いくら時間が進んでも記録されない
    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS);

    expect(walkStore.hasMeasurementGap).toBe(false);
  });

  test('案内画面を離れた後はタイマーが発火しない', async () => {
    const walkStore = useWalkStore();
    const wrapper = mountNavigationView();

    await raiseTrackingError();
    wrapper.unmount();

    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS);

    // 破棄し忘れると、次の散歩の実績へ欠落が書き込まれてしまう
    expect(walkStore.hasMeasurementGap).toBe(false);
  });
});

describe('RouteNavigationView の計測の中断の累積による欠落の記録', () => {
  test('精度が悪い測位が届き続けた場合も欠落を記録する', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    // 測位そのものは届いているため trackingError は立たないが、
    // この精度では useWalkRecord が距離を積めず、実質的に計測できていない
    await receivePosition(150);

    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS - 1);
    expect(walkStore.hasMeasurementGap).toBe(false);

    vi.advanceTimersByTime(1);

    expect(walkStore.hasMeasurementGap).toBe(true);
  });

  test('しきい値未満の中断を繰り返して合計がしきい値を超えたら欠落を記録する', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    // 1回目の中断は35秒で、単独ではしきい値に届かない
    await raiseTrackingError();
    vi.advanceTimersByTime(35000);
    await recoverTracking();

    expect(walkStore.hasMeasurementGap).toBe(false);

    // 2回目の中断は残り25秒で判定される。復帰のたびに判定を捨てる形では、
    // この断続的な不調は永久に検知できなかった
    await raiseTrackingError();
    vi.advanceTimersByTime(25000);

    expect(walkStore.hasMeasurementGap).toBe(true);
  });
});

describe('RouteNavigationView の画面の切り替えによる欠落の記録', () => {
  test('しきい値以上画面を隠した後に戻ったら欠落を記録する', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    await changeVisibilityTo('hidden');
    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS);
    await changeVisibilityTo('visible');

    expect(walkStore.hasMeasurementGap).toBe(true);
  });

  test('短時間だけ画面を隠した場合は欠落を記録しない', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    await changeVisibilityTo('hidden');
    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS / 2);
    await changeVisibilityTo('visible');

    expect(walkStore.hasMeasurementGap).toBe(false);
  });

  test('画面を隠している間の測位の中断を二重に数えない', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    // 測位が途切れたまま画面を隠し、しきい値未満の時間だけ経ってから戻る
    await raiseTrackingError();
    await changeVisibilityTo('hidden');
    vi.advanceTimersByTime(40000);
    await changeVisibilityTo('visible');
    await recoverTracking();

    // 非表示と測位の中断の両方で同じ40秒を積むと、合計80秒で欠落と判定されてしまう
    expect(walkStore.hasMeasurementGap).toBe(false);
  });

  test('画面を隠している間に測位が途切れたままなら、戻った後も中断として数え続ける', async () => {
    const walkStore = useWalkStore();
    mountNavigationView();

    await raiseTrackingError();
    await changeVisibilityTo('hidden');
    vi.advanceTimersByTime(40000);
    await changeVisibilityTo('visible');

    // 残り20秒。戻った時点で測位側の中断として数え直すため、復帰しなければ記録する
    vi.advanceTimersByTime(19999);
    expect(walkStore.hasMeasurementGap).toBe(false);

    vi.advanceTimersByTime(1);

    expect(walkStore.hasMeasurementGap).toBe(true);
  });

  test('案内画面を離れた後の画面の切り替えでは欠落を記録しない', async () => {
    const walkStore = useWalkStore();
    const wrapper = mountNavigationView();

    wrapper.unmount();

    await changeVisibilityTo('hidden');
    vi.advanceTimersByTime(MEASUREMENT_GAP_THRESHOLD_MS);
    await changeVisibilityTo('visible');

    // 購読が残っていると、案内していない間の画面の切り替えで欠落が記録される
    expect(walkStore.hasMeasurementGap).toBe(false);
  });
});
