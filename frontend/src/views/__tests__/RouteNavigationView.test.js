import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import RouteNavigationView from '@/views/RouteNavigationView.vue';
import RouteNextSpotBanner from '@/components/feature/route/RouteNextSpotBanner.vue';
import RouteNavigationMap from '@/components/feature/route/RouteNavigationMap.vue';
import ReviewPostForm from '@/components/feature/review/ReviewPostForm.vue';
import BaseProcessingOverlay from '@/components/base/BaseProcessingOverlay.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import { postReview } from '@/services/reviewService';
import { useRouteStore } from '@/stores/routeStore';
import { useTutorialStore } from '@/stores/tutorialStore';
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

// 口コミの通信は認証と fetch を伴うため差し替える。
// 場所の解決は「未投稿の場所」、一覧は空で返し、投稿はテストごとに結果を決める
vi.mock('@/services/reviewService', () => ({
  resolveSpot: vi.fn(async () => ({ exists: false })),
  fetchMyReviews: vi.fn(async () => []),
  fetchReviewSpots: vi.fn(async () => []),
  postReview: vi.fn(async () => ({})),
  fetchPhotoUploadUrls: vi.fn(async () => []),
  uploadPhoto: vi.fn(async () => {})
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

/** 案内に使う3スポット。巡る順に並べる */
const NAVIGATION_SPOTS = [
  { spotId: 'spot-1', name: 'A', lat: 35.69, lng: 139.7 },
  { spotId: 'spot-2', name: 'B', lat: 35.691, lng: 139.701 },
  { spotId: 'spot-3', name: 'C', lat: 35.692, lng: 139.702 }
];

/**
 * @description ルートを用意して案内画面を shallow で描画する。
 * shallow のままでは DefaultLayout のスロットが描画されず画面内のボタンを押せないため、
 * スロットだけを描画するスタブに差し替える
 * @param {object[]} [legs] 区間ごとの線。既定は区間なし（従来の応答）
 * @returns {object} マウントした wrapper
 */
const mountNavigationViewWithRoute = (legs) => {
  useRouteStore().setCurrentRoute({
    spots: NAVIGATION_SPOTS,
    geometry: null,
    ...(legs === undefined ? {} : { legs })
  });

  return mount(RouteNavigationView, {
    shallow: true,
    global: {
      stubs: {
        DefaultLayout: { template: '<div><slot /><slot name="footer" /></div>' },
        // 「次の目的地へ」はチュートリアルの包みの中にあるため、中身を描くスタブにする
        TutorialSpotlight: { template: '<slot />' }
      }
    }
  });
};

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

describe('RouteNavigationView の前の目的地に戻るボタン', () => {
  test('開始直後（1スポット目）は戻るボタンを出さない', () => {
    const wrapper = mountNavigationViewWithRoute();

    expect(wrapper.find('.previous-spot-btn').exists()).toBe(false);
    expect(wrapper.find('.next-spot-btn').exists()).toBe(true);
  });

  test('進めると戻るボタンが出て、押すと1つ前の目的地に戻り足跡の元データも消える', async () => {
    const walkStore = useWalkStore();
    const wrapper = mountNavigationViewWithRoute();

    await wrapper.find('.next-spot-btn').trigger('click');

    expect(wrapper.find('.previous-spot-btn').exists()).toBe(true);
    expect(walkStore.visitedSpotIds).toEqual(['spot-1']);
    expect(wrapper.findComponent(RouteNextSpotBanner).props('spotName')).toBe('B');

    await wrapper.find('.previous-spot-btn').trigger('click');

    expect(wrapper.find('.previous-spot-btn').exists()).toBe(false);
    expect(walkStore.visitedSpotIds).toEqual([]);
    expect(wrapper.findComponent(RouteNextSpotBanner).props('spotName')).toBe('A');
  });

  test('すべて巡った後も戻るボタンを出し、押すと最後のスポットの案内に戻る', async () => {
    const wrapper = mountNavigationViewWithRoute();

    for (let count = 0; count < NAVIGATION_SPOTS.length; count += 1) {
      await wrapper.find('.next-spot-btn').trigger('click');
    }

    expect(wrapper.find('.next-spot-btn').exists()).toBe(false);
    expect(wrapper.find('.previous-spot-btn').exists()).toBe(true);

    await wrapper.find('.previous-spot-btn').trigger('click');

    expect(wrapper.find('.next-spot-btn').exists()).toBe(true);
    expect(wrapper.findComponent(RouteNextSpotBanner).props('spotName')).toBe('C');
  });

  test('1本にまとめた口コミの切り替えが、それぞれの表示状態を持つ', async () => {
    const wrapper = mountNavigationViewWithRoute();
    const mineToggle = wrapper.find('.review-toggle-mine');
    const otherToggle = wrapper.find('.review-toggle-other');

    await mineToggle.trigger('click');

    expect(mineToggle.attributes('aria-pressed')).toBe('true');
    expect(mineToggle.classes()).toContain('is-on');
    expect(otherToggle.attributes('aria-pressed')).toBe('false');

    await mineToggle.trigger('click');

    expect(mineToggle.attributes('aria-pressed')).toBe('false');
    expect(mineToggle.classes()).not.toContain('is-on');
  });
});

describe('RouteNavigationView の口コミのピンの初期表示', () => {
  test('開いた直後は自分・みんなの口コミのピンをどちらも出さない', () => {
    const wrapper = mountNavigationViewWithRoute();
    const map = wrapper.findComponent(RouteNavigationMap);

    // ピンが経路に重なって巡る道筋が見にくくなるため、既定は非表示
    expect(map.props('showMyReviews')).toBe(false);
    expect(map.props('showOtherReviews')).toBe(false);
    expect(wrapper.find('.review-toggle-mine').attributes('aria-pressed')).toBe('false');
    expect(wrapper.find('.review-toggle-other').attributes('aria-pressed')).toBe('false');
  });

  test('札を押すと、その種類のピンだけが出る', async () => {
    const wrapper = mountNavigationViewWithRoute();

    await wrapper.find('.review-toggle-other').trigger('click');

    const map = wrapper.findComponent(RouteNavigationMap);
    expect(map.props('showOtherReviews')).toBe(true);
    expect(map.props('showMyReviews')).toBe(false);
  });

  test('チュートリアル中は、紫のピンをタップさせるため「みんな」だけを出して始める', () => {
    useTutorialStore().start();

    const wrapper = mountNavigationViewWithRoute();
    const map = wrapper.findComponent(RouteNavigationMap);

    expect(map.props('showOtherReviews')).toBe(true);
    expect(map.props('showMyReviews')).toBe(false);
    expect(wrapper.find('.review-toggle-other').attributes('aria-pressed')).toBe('true');
  });
});

describe('RouteNavigationView の区間の描き分け', () => {
  /** 4区間（開始→A、A→B、B→C、C→開始） */
  const NAVIGATION_LEGS = [0, 1, 2, 3].map((index) => ({
    geometry: {
      type: 'LineString',
      coordinates: [
        [139.7 + index * 0.001, 35.69],
        [139.7 + (index + 1) * 0.001, 35.69]
      ]
    }
  }));

  /** 各区間の線 */
  const legGeometries = NAVIGATION_LEGS.map((leg) => leg.geometry);

  /**
   * @description 地図へ渡した区間の描き分けを取り出す
   * @param {object} wrapper マウントした wrapper
   * @returns {object|null} 区間の描き分け
   */
  const legSectionsOf = (wrapper) =>
    wrapper.findComponent(RouteNavigationMap).props('legSections');

  test('開始直後は開始地点→1スポット目が今の区間で、歩き終えた区間は無い', () => {
    const wrapper = mountNavigationViewWithRoute(NAVIGATION_LEGS);

    expect(legSectionsOf(wrapper)).toEqual({
      walkedLegs: [],
      currentLeg: legGeometries[0],
      upcomingLegs: [legGeometries[1], legGeometries[2], legGeometries[3]]
    });
  });

  test('次の目的地へ進めると今の区間が切り替わり、戻すと元に戻る', async () => {
    const wrapper = mountNavigationViewWithRoute(NAVIGATION_LEGS);

    await wrapper.find('.next-spot-btn').trigger('click');

    expect(legSectionsOf(wrapper).currentLeg).toEqual(legGeometries[1]);
    expect(legSectionsOf(wrapper).walkedLegs).toEqual([legGeometries[0]]);

    await wrapper.find('.previous-spot-btn').trigger('click');

    expect(legSectionsOf(wrapper).currentLeg).toEqual(legGeometries[0]);
    expect(legSectionsOf(wrapper).walkedLegs).toEqual([]);
  });

  test('すべて巡ると最終スポット→開始地点の帰り道が今の区間になる', async () => {
    const wrapper = mountNavigationViewWithRoute(NAVIGATION_LEGS);

    for (let count = 0; count < NAVIGATION_SPOTS.length; count += 1) {
      await wrapper.find('.next-spot-btn').trigger('click');
    }

    expect(legSectionsOf(wrapper)).toEqual({
      walkedLegs: [legGeometries[0], legGeometries[1], legGeometries[2]],
      currentLeg: legGeometries[3],
      upcomingLegs: []
    });
  });

  test('区間を持たないルートでは描き分けず、経路を1色で描く（null を渡す）', () => {
    const wrapper = mountNavigationViewWithRoute();

    expect(legSectionsOf(wrapper)).toBeNull();
  });
});

describe('RouteNavigationView の画面上部の並び', () => {
  test('バナー・前後のボタン・口コミの表示切り替えを1つの入れ物に上から順に積む', async () => {
    const wrapper = mountNavigationViewWithRoute();

    // 前の目的地も出るよう、1つ進めておく
    await wrapper.find('.next-spot-btn').trigger('click');

    const top = wrapper.find('.navigation-top');
    const bannerEl = wrapper.findComponent(RouteNextSpotBanner).element;
    const rowEl = wrapper.find('.spot-step-row').element;
    const togglesEl = wrapper.find('.review-toggles').element;

    // 固定の top で個別に置くと、名前でバナーが伸びたときに重なるため、同じ入れ物で積む
    expect([...top.element.children]).toEqual([bannerEl, rowEl, togglesEl]);

    // 前後のボタンは同じ段に並べる（前が左、次が右）
    const rowButtons = [...rowEl.querySelectorAll('button')].map((button) => button.className);
    expect(rowButtons).toEqual(['previous-spot-btn', 'next-spot-btn']);

    // 前の目的地のボタンは矢印を付けず、「次の目的地へ」と文言を揃える
    expect(wrapper.find('.previous-spot-btn').text()).toBe('前の目的地へ');
  });

  test('口コミの表示切り替えは、見出しの下に自分・みんなを縦に並べる', () => {
    const wrapper = mountNavigationViewWithRoute();
    const togglesEl = wrapper.find('.review-toggles').element;

    const children = [...togglesEl.children].map((child) => child.className);
    expect(children).toEqual([
      'review-toggles-label',
      'review-toggle review-toggle-mine',
      'review-toggle review-toggle-other'
    ]);
  });

  test('地図の現在地へ戻るボタンは、口コミの表示切り替えの札の下端＋余白に置く', async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ bottom: 150.2 });

    const wrapper = mountNavigationViewWithRoute();
    // 描画後に測るため、測った値が地図へ渡るのは次の描画
    await nextTick();

    // 151（切り上げ）+ 余白8
    expect(wrapper.findComponent(RouteNavigationMap).props('controlsTopPx')).toBe(159);
    // 測ったのは口コミの表示切り替えの札
    expect(rectSpy.mock.contexts).toContain(wrapper.find('.review-toggles').element);
  });

  test('地図の上下が画面の操作で隠れる高さ（上部の操作の下端・終了ボタンの上端から下）を地図へ渡す', async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ bottom: 236.4, top: 700 });

    const wrapper = mountNavigationViewWithRoute();
    await nextTick();

    const map = wrapper.findComponent(RouteNavigationMap);

    // 上は画面上部の操作の入れ物の下端（切り上げ）
    expect(map.props('topInsetPx')).toBe(237);
    expect(rectSpy.mock.contexts).toContain(wrapper.find('.navigation-top').element);
    // 下は画面の下端から終了ボタンの上端まで（jsdom の innerHeight は 768）
    expect(map.props('bottomInsetPx')).toBe(window.innerHeight - 700);
  });

  test('バナーの高さが変わったら、現在地へ戻るボタンの位置を測り直し、画面を離れたら見張りをやめる', async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ bottom: 130 });
    const observed = [];
    const disconnect = vi.fn();
    let resizeCallback = null;

    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback) {
          resizeCallback = callback;
        }

        observe(element) {
          observed.push(element);
        }

        disconnect() {
          disconnect();
        }
      }
    );

    try {
      const wrapper = mountNavigationViewWithRoute();
      const map = () => wrapper.findComponent(RouteNavigationMap);
      await nextTick();

      expect(observed).toEqual([wrapper.findComponent(RouteNextSpotBanner).element]);
      expect(map().props('controlsTopPx')).toBe(138);

      // 長い名前でバナーが伸び、口コミの表示切り替えの札が下がった
      rectSpy.mockReturnValue({ bottom: 170 });
      resizeCallback();
      await nextTick();

      expect(map().props('controlsTopPx')).toBe(178);

      wrapper.unmount();
      expect(disconnect).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('RouteNavigationView の口コミ投稿中の表示', () => {
  /** 「投稿中…」を出し続ける最短の時間（ミリ秒）。View 側の MIN_REVIEW_SUBMITTING_DURATION_MS と揃える */
  const MIN_REVIEW_SUBMITTING_DURATION_MS = 500;

  /** 投稿する内容（評価のみ） */
  const REVIEW = {
    spotName: null,
    genreId: null,
    genreName: null,
    rating: 4,
    photos: [],
    keptPhotoKeys: []
  };

  beforeEach(() => {
    // 送信の回数を数えるテストがあるため、前のテストの呼び出しを残さない
    postReview.mockClear();
  });

  /**
   * @description 地図を長押しして口コミ投稿フォームを開く
   * @param {object} wrapper マウントした wrapper
   * @returns {Promise<void>}
   */
  const openReviewForm = async (wrapper) => {
    wrapper.findComponent(RouteNavigationMap).vm.$emit('longPressMap', { lng: 139.7, lat: 35.69 });
    await vi.advanceTimersByTimeAsync(MIN_REVIEW_SUBMITTING_DURATION_MS);
  };

  /**
   * @description 「投稿中…」の全画面表示を探す（「記録中…」と区別する）
   * @param {object} wrapper マウントした wrapper
   * @returns {object|undefined} 見つかった全画面表示
   */
  const findSubmittingOverlay = (wrapper) =>
    wrapper
      .findAllComponents(BaseProcessingOverlay)
      .find((overlay) => overlay.props('message') === '投稿中…');

  /**
   * @description 投稿フォームから投稿を送る
   * @param {object} wrapper マウントした wrapper
   * @returns {Promise<void>}
   */
  const submitReview = async (wrapper) => {
    wrapper.findComponent(ReviewPostForm).vm.$emit('submitReview', REVIEW);
    await nextTick();
  };

  test('投稿を押すと「投稿中…」を全画面に出し、完了したら閉じて地図に戻る', async () => {
    let finishPost = null;
    postReview.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPost = resolve;
        })
    );

    const wrapper = mountNavigationViewWithRoute();
    await openReviewForm(wrapper);
    await submitReview(wrapper);

    // 通信中は全画面表示を出し、投稿ボタンも「投稿中…」にする
    expect(findSubmittingOverlay(wrapper)).toBeDefined();
    expect(wrapper.findComponent(ReviewPostForm).props('isPosting')).toBe(true);

    // 最短の表示時間を過ぎても、通信が終わるまでは出し続ける
    await vi.advanceTimersByTimeAsync(MIN_REVIEW_SUBMITTING_DURATION_MS * 4);
    expect(findSubmittingOverlay(wrapper)).toBeDefined();

    finishPost({});
    await vi.advanceTimersByTimeAsync(MIN_REVIEW_SUBMITTING_DURATION_MS);

    // 完了したら全画面表示とフォームを閉じ、成功を知らせる
    expect(findSubmittingOverlay(wrapper)).toBeUndefined();
    expect(wrapper.findComponent(ReviewPostForm).exists()).toBe(false);
    expect(wrapper.findComponent(BaseToast).props('message')).toBe('口コミを投稿しました');
  });

  test('通信がすぐ終わっても、最短の表示時間は「投稿中…」を出し続ける', async () => {
    const wrapper = mountNavigationViewWithRoute();
    await openReviewForm(wrapper);
    await submitReview(wrapper);

    // 通信は既に終わっているが、一瞬で消えるとチラつくため残す
    await vi.advanceTimersByTimeAsync(MIN_REVIEW_SUBMITTING_DURATION_MS - 1);
    expect(findSubmittingOverlay(wrapper)).toBeDefined();

    await vi.advanceTimersByTimeAsync(1);

    expect(findSubmittingOverlay(wrapper)).toBeUndefined();
    expect(wrapper.findComponent(ReviewPostForm).exists()).toBe(false);
  });

  test('投稿に失敗したら「投稿中…」だけを閉じ、入力を残したフォームとエラーを見せる', async () => {
    postReview.mockRejectedValueOnce(new Error('口コミの投稿に失敗しました（テスト）'));

    const wrapper = mountNavigationViewWithRoute();
    await openReviewForm(wrapper);
    await submitReview(wrapper);
    await vi.advanceTimersByTimeAsync(MIN_REVIEW_SUBMITTING_DURATION_MS);

    expect(findSubmittingOverlay(wrapper)).toBeUndefined();
    // フォームを閉じないことで、入力をやり直さずに再送できる
    expect(wrapper.findComponent(ReviewPostForm).exists()).toBe(true);
    expect(wrapper.findComponent(ReviewPostForm).props('isPosting')).toBe(false);
    expect(wrapper.findComponent(BaseToast).props('message')).toBe(
      '口コミの投稿に失敗しました（テスト）'
    );
  });

  test('「投稿中…」の間に届いた二度目の送信は受け付けない', async () => {
    const wrapper = mountNavigationViewWithRoute();
    await openReviewForm(wrapper);

    await submitReview(wrapper);
    await submitReview(wrapper);
    await vi.advanceTimersByTimeAsync(MIN_REVIEW_SUBMITTING_DURATION_MS);

    expect(postReview).toHaveBeenCalledTimes(1);
  });
});
