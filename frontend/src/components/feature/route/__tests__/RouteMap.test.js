import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

/**
 * @description 地図のスポットマーカーのテスト。
 * ルートで巡る口コミの場所は口コミのピンと同じ色の番号の丸で描き（他の人の口コミは紫、
 * 自分の口コミはオレンジの is-mine）、押すと口コミを開くこと、
 * 同じ場所の口コミのピンは重ねて描かないことを確かめる。
 *
 * jsdom では地図を描けないため、MapLibre を差し替え、作られたマーカーの要素を記録する。
 */

/** 作られたマーカー（要素と座標）の記録 */
const createdMarkers = [];

/** 地図のイベントの購読。load を手動で発火させるために持つ */
let mapHandlers = {};

/** 追加されたソース（ID → { data, setData }）の記録 */
const createdSources = new Map();

/** 追加されたレイヤーの記録（追加した順） */
const addedLayers = [];

/** 地図へ追加されたコントロールの記録（追加した順） */
const addedControls = [];

/** fitBounds に渡された引数（[bounds, options]）の記録 */
const fitBoundsCalls = [];

/** easeTo に渡されたオプションの記録 */
const easeToCalls = [];

vi.mock('maplibre-gl', () => {
  class FakeMarker {
    constructor(options = {}) {
      this.element = options.element ?? document.createElement('div');
      this.anchor = options.anchor ?? 'center';
      this.hasPopup = false;
      createdMarkers.push(this);
    }

    setLngLat(lngLat) {
      this.lngLat = lngLat;
      return this;
    }

    setPopup() {
      this.hasPopup = true;
      return this;
    }

    addTo() {
      return this;
    }

    remove() {}

    getElement() {
      return this.element;
    }
  }

  class FakePopup {
    setText() {
      return this;
    }
  }

  class FakeMap {
    constructor() {
      mapHandlers = {};
    }

    on(event, handler) {
      (mapHandlers[event] ??= []).push(handler);
    }

    off() {}

    isStyleLoaded() {
      return true;
    }

    getSource(id) {
      return createdSources.get(id) ?? null;
    }

    addSource(id, spec) {
      const source = {
        data: spec.data,
        setData: vi.fn((data) => {
          source.data = data;
        })
      };
      createdSources.set(id, source);
    }

    addLayer(layer) {
      addedLayers.push(layer);
    }

    addControl(control) {
      addedControls.push(control);
    }

    fitBounds(bounds, options) {
      fitBoundsCalls.push([bounds, options]);
    }

    getZoom() {
      return 15;
    }

    easeTo(options) {
      easeToCalls.push(options);
    }

    remove() {}
  }

  return {
    MapLibreMap: FakeMap,
    Marker: FakeMarker,
    Popup: FakePopup,
    setWorkerUrl: () => {}
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '' }));

const { default: RouteMap } = await import('@/components/feature/route/RouteMap.vue');
const {
  MAP_FIT_PADDING_PX,
  MAX_FIT_ZOOM_LEVEL,
  NAVIGATION_ZOOM_LEVEL,
  ROUTE_CURRENT_LEG_CASING_WIDTH_PX,
  ROUTE_CURRENT_LEG_COLOR,
  ROUTE_CURRENT_LEG_WIDTH_PX,
  ROUTE_LINE_COLOR,
  ROUTE_LINE_OUTLINE_COLOR,
  ROUTE_WALKED_LEG_COLOR,
  ROUTE_WALKED_LEG_WIDTH_PX
} = await import('@/constants/mapDefaults');

/**
 * 口コミの場所1つと通常のスポット1つのルート。
 * 口コミの場所は、案内に使う座標（経路へ寄せた座標）と、口コミのピンの位置（元の座標）を別に持つ
 */
const spots = [
  {
    spotId: 'spot-1',
    name: '口コミの場所',
    lng: 139.7046,
    lat: 35.6872,
    isReviewSpot: true,
    reviewSpotId: 'review-1',
    reviewPosition: { lng: 139.7045, lat: 35.6873 }
  },
  {
    spotId: 'spot-2',
    name: '公園',
    lng: 139.703,
    lat: 35.686,
    isReviewSpot: false,
    reviewSpotId: null,
    reviewPosition: null
  }
];

const geometry = {
  type: 'LineString',
  coordinates: [
    [139.7036, 35.6862],
    [139.7045, 35.6872]
  ]
};

/**
 * @description 地図を描き、スタイルの読み込み完了（load）まで進める
 * @param {object} [props] 追加の props
 * @returns {object} マウントしたラッパー
 */
const mountAndLoad = (props = {}) => {
  const wrapper = mount(RouteMap, { props: { geometry, spots, ...props } });
  (mapHandlers.load ?? []).forEach((handler) => handler());
  return wrapper;
};

/**
 * @description 作られたスポットのマーカー要素を、巡る順に取り出す
 * @returns {HTMLElement[]} スポットのマーカー要素
 */
const spotMarkerElements = () =>
  createdMarkers
    .map((marker) => marker.element)
    .filter((element) => element.classList.contains('spot-marker'));

/**
 * @description ルートで巡る口コミの場所の番号の丸（マーカー）を取り出す
 * @returns {object[]} マーカー
 */
const routeReviewSpotMarkers = () =>
  createdMarkers.filter((marker) => marker.element.classList.contains('is-review'));

/**
 * @description 通常のスポット（青の番号の丸）の要素を取り出す
 * @returns {HTMLElement[]} 要素
 */
const normalSpotElements = () =>
  spotMarkerElements().filter((element) => !element.classList.contains('is-review'));

/**
 * @description 口コミの一覧から描いた口コミのピンを取り出す
 * @returns {HTMLElement[]} ピンの要素
 */
const layerReviewPinElements = () =>
  createdMarkers
    .map((marker) => marker.element)
    .filter((element) => element.classList.contains('review-pin'));

describe('RouteMap（ルートで巡る口コミの場所）', () => {
  beforeEach(() => {
    createdMarkers.length = 0;
    createdSources.clear();
    addedLayers.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('口コミの場所は紫の番号の丸（is-review）で描き、通常のスポットは青の番号の丸のまま', () => {
    mountAndLoad();

    const [reviewSpot] = routeReviewSpotMarkers();
    const [normalSpot] = normalSpotElements();

    expect(routeReviewSpotMarkers()).toHaveLength(1);
    expect(reviewSpot.element.className).toBe('spot-marker is-review');
    expect(reviewSpot.element.textContent).toBe('1');
    // 口コミのピンの形にはしない
    expect(reviewSpot.element.querySelector('.review-pin-head')).toBeNull();
    expect(normalSpot.className).toBe('spot-marker');
    expect(normalSpot.textContent).toBe('2');
  });

  test('番号の丸は通常のスポットと同じく経路へ寄せた座標の中心に置き、名前のポップアップは付けない', () => {
    mountAndLoad();

    const [reviewSpot] = routeReviewSpotMarkers();

    expect(reviewSpot.anchor).toBe('center');
    expect(reviewSpot.lngLat).toEqual([139.7046, 35.6872]);
    expect(reviewSpot.hasPopup).toBe(false);
  });

  test('押せることを伝えるためボタンにし、押すと口コミの場所のIDと元の座標を通知する', () => {
    const wrapper = mountAndLoad();
    const [reviewSpot] = routeReviewSpotMarkers();

    expect(reviewSpot.element.tagName).toBe('BUTTON');
    expect(reviewSpot.element.type).toBe('button');

    reviewSpot.element.click();

    // 口コミの解決（半径40m）には、経路へ寄せた座標ではなく元の座標を渡す
    expect(wrapper.emitted('selectReviewSpot')).toEqual([
      [{ spotId: 'review-1', position: { lng: 139.7045, lat: 35.6873 } }]
    ]);
  });

  test('通常のスポットを押しても口コミは開かない（名前のポップアップのまま）', () => {
    const wrapper = mountAndLoad();

    normalSpotElements()[0].click();

    expect(wrapper.emitted('selectReviewSpot')).toBeUndefined();
    expect(createdMarkers.find((marker) => marker.element === normalSpotElements()[0]).hasPopup).toBe(true);
  });

  test('紫（他の人の口コミの場所）と押せることは見た目だけでは伝わらないため、読み上げで補う', () => {
    mountAndLoad();

    expect(routeReviewSpotMarkers()[0].element.getAttribute('aria-label')).toBe(
      '1番目のスポット（他の人の口コミの場所）：口コミの場所の口コミを見る'
    );
  });

  test('巡る口コミの場所は、口コミのピンの一覧からは描かない（番号の丸と重ねない）', () => {
    mountAndLoad({
      otherReviewSpots: [
        { spotId: 'review-1', spotName: '口コミの場所', position: { lng: 139.7045, lat: 35.6873 } },
        { spotId: 'review-2', spotName: 'ほかの口コミ', position: { lng: 139.71, lat: 35.69 } }
      ],
      showOtherReviews: true
    });

    expect(layerReviewPinElements().map((element) => element.getAttribute('aria-label'))).toEqual([
      'ほかの口コミの口コミを見る'
    ]);
  });

  test('ルートが変わって口コミの場所を通らなくなったら、口コミのピンの一覧に戻す', async () => {
    const wrapper = mountAndLoad({
      otherReviewSpots: [
        { spotId: 'review-1', spotName: '口コミの場所', position: { lng: 139.7045, lat: 35.6873 } }
      ],
      showOtherReviews: true
    });

    expect(layerReviewPinElements()).toHaveLength(0);

    createdMarkers.length = 0;
    await wrapper.setProps({ spots: [spots[1]] });
    await nextTick();

    expect(layerReviewPinElements()).toHaveLength(1);
    expect(routeReviewSpotMarkers()).toHaveLength(0);
  });

  test('選択中は輪を付けて前面に出す目印（is-selected）を付け、選択状態を読み上げに伝える', async () => {
    const wrapper = mountAndLoad();

    await wrapper.setProps({ selectedReviewSpotId: 'review-1' });
    await nextTick();

    const { element } = routeReviewSpotMarkers()[0];
    expect(element.classList.contains('is-selected')).toBe(true);
    expect(element.getAttribute('aria-pressed')).toBe('true');
  });

  test('到達済みになると足跡のスタンプにし、番号を消して読み上げに到達済みを足す', async () => {
    const wrapper = mountAndLoad();

    await wrapper.setProps({ visitedSpotIds: ['spot-1'] });
    await nextTick();

    const { element } = routeReviewSpotMarkers()[0];
    expect(element.classList.contains('is-visited')).toBe(true);
    expect(element.textContent).toBe('');
    expect(element.getAttribute('aria-label')).toBe(
      '1番目のスポット（到達済み・他の人の口コミの場所）：口コミの場所の口コミを見る'
    );
    // 通常のスポットは影響を受けない
    expect(normalSpotElements()[0].classList.contains('is-visited')).toBe(false);
  });

  test('口コミの場所のIDや元の座標が欠けている（古い応答など）場合は、押しても開けないため青の番号の丸で描く', () => {
    mountAndLoad({
      spots: [
        { spotId: 'spot-1', name: '古い応答', lng: 139.703, lat: 35.686, isReviewSpot: true },
        {
          spotId: 'spot-2',
          name: '座標なし',
          lng: 139.704,
          lat: 35.687,
          isReviewSpot: true,
          reviewSpotId: 'review-9',
          reviewPosition: null
        }
      ]
    });

    expect(routeReviewSpotMarkers()).toHaveLength(0);
    expect(normalSpotElements().map((element) => element.textContent)).toEqual(['1', '2']);
  });

  test('口コミのピンの一覧（オレンジ・紫）は従来の見た目のまま', () => {
    mountAndLoad({
      myReviewSpots: [{ spotId: 'r-1', spotName: '自分の口コミ', position: { lng: 139.7, lat: 35.68 } }],
      showMyReviews: true,
      otherReviewSpots: [
        { spotId: 'r-2', spotName: '他の人の口コミ', position: { lng: 139.71, lat: 35.69 } }
      ],
      showOtherReviews: true
    });

    expect(layerReviewPinElements().map((element) => element.className)).toEqual([
      'review-pin review-pin-mine',
      'review-pin review-pin-other'
    ]);
  });
});

describe('RouteMap（自分の口コミの場所の番号の丸）', () => {
  /** 自分の口コミの場所・他の人の口コミの場所・通常のスポットを1つずつ巡るルート */
  const spotsWithMyReview = [
    {
      spotId: 'spot-mine',
      name: '自分の口コミの場所',
      lng: 139.7046,
      lat: 35.6872,
      isReviewSpot: true,
      isMyReviewSpot: true,
      reviewSpotId: 'review-mine',
      reviewPosition: { lng: 139.7045, lat: 35.6873 }
    },
    {
      spotId: 'spot-other',
      name: '他の人の口コミの場所',
      lng: 139.706,
      lat: 35.688,
      isReviewSpot: true,
      isMyReviewSpot: false,
      reviewSpotId: 'review-other',
      reviewPosition: { lng: 139.7061, lat: 35.6881 }
    },
    {
      spotId: 'spot-normal',
      name: '公園',
      lng: 139.703,
      lat: 35.686,
      isReviewSpot: false,
      isMyReviewSpot: false,
      reviewSpotId: null,
      reviewPosition: null
    }
  ];

  beforeEach(() => {
    createdMarkers.length = 0;
    createdSources.clear();
    addedLayers.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('自分の口コミの場所はオレンジの目印（is-mine）を足し、他の人の口コミの場所は紫のまま', () => {
    mountAndLoad({ spots: spotsWithMyReview });

    const [myMarker, otherMarker, normalMarker] = spotMarkerElements();

    expect(myMarker.className).toBe('spot-marker is-review is-mine');
    expect(otherMarker.className).toBe('spot-marker is-review');
    expect(normalMarker.className).toBe('spot-marker');
    // 番号は色に関わらず巡る順のまま
    expect([myMarker, otherMarker, normalMarker].map((marker) => marker.textContent)).toEqual([
      '1',
      '2',
      '3'
    ]);
  });

  test('オレンジと紫の意味も色だけでは伝わらないため、誰の口コミの場所かを読み上げで補う', () => {
    mountAndLoad({ spots: spotsWithMyReview });

    const [myMarker, otherMarker, normalMarker] = spotMarkerElements();

    expect(myMarker.getAttribute('aria-label')).toBe(
      '1番目のスポット（自分の口コミの場所）：自分の口コミの場所の口コミを見る'
    );
    expect(otherMarker.getAttribute('aria-label')).toBe(
      '2番目のスポット（他の人の口コミの場所）：他の人の口コミの場所の口コミを見る'
    );
    expect(normalMarker.getAttribute('aria-label')).toBe('3番目のスポット');
  });

  test('自分の口コミの場所も、押すと口コミの場所のIDと元の座標を通知する', () => {
    const wrapper = mountAndLoad({ spots: spotsWithMyReview });

    spotMarkerElements()[0].click();

    expect(wrapper.emitted('selectReviewSpot')).toEqual([
      [{ spotId: 'review-mine', position: { lng: 139.7045, lat: 35.6873 } }]
    ]);
  });

  test('到達済み・選択中になっても、自分の口コミの場所の目印と読み上げは保つ', async () => {
    const wrapper = mountAndLoad({ spots: spotsWithMyReview });

    await wrapper.setProps({ visitedSpotIds: ['spot-mine'], selectedReviewSpotId: 'review-mine' });
    await nextTick();

    const [myMarker] = spotMarkerElements();

    expect(myMarker.classList.contains('is-mine')).toBe(true);
    expect(myMarker.classList.contains('is-visited')).toBe(true);
    expect(myMarker.classList.contains('is-selected')).toBe(true);
    expect(myMarker.textContent).toBe('');
    expect(myMarker.getAttribute('aria-label')).toBe(
      '1番目のスポット（到達済み・自分の口コミの場所）：自分の口コミの場所の口コミを見る'
    );
  });

  test('口コミの場所でない・口コミを開けないスポットは、isMyReviewSpot が真でもオレンジにしない', () => {
    mountAndLoad({
      spots: [
        { ...spotsWithMyReview[2], isMyReviewSpot: true },
        // 口コミの場所のIDを持たない（古い応答など）。押しても開けないため青の番号の丸で描く
        {
          spotId: 'spot-old',
          name: '古い応答',
          lng: 139.704,
          lat: 35.687,
          isReviewSpot: true,
          isMyReviewSpot: true,
          reviewSpotId: null,
          reviewPosition: null
        }
      ]
    });

    expect(spotMarkerElements().map((element) => element.className)).toEqual([
      'spot-marker',
      'spot-marker'
    ]);
  });
});

describe('RouteMap（区間ごとの描き分け）', () => {
  /**
   * @description 見分けの付く区間の線を作る
   * @param {number} index 区間の番号
   * @returns {object} 区間の線
   */
  const createLegGeometry = (index) => ({
    type: 'LineString',
    coordinates: [
      [139.7 + index * 0.001, 35.686],
      [139.7 + (index + 1) * 0.001, 35.686]
    ]
  });

  const legGeometries = [0, 1, 2].map(createLegGeometry);

  /** 1スポット目へ向かう間の区分 */
  const firstSections = {
    walkedLegs: [],
    currentLeg: legGeometries[0],
    upcomingLegs: [legGeometries[1], legGeometries[2]]
  };

  /** 2スポット目へ向かう間の区分 */
  const secondSections = {
    walkedLegs: [legGeometries[0]],
    currentLeg: legGeometries[1],
    upcomingLegs: [legGeometries[2]]
  };

  /**
   * @description ソースが持つ線の座標列を取り出す
   * @param {string} id ソースのID
   * @returns {number[][][]} 線ごとの座標列
   */
  const linesOf = (id) => {
    const { data } = createdSources.get(id);
    return data.type === 'Feature'
      ? [data.geometry.coordinates]
      : data.features.map((feature) => feature.geometry.coordinates);
  };

  /**
   * @description IDでレイヤーを引く
   * @param {string} id レイヤーのID
   * @returns {object} レイヤー
   */
  const layerOf = (id) => addedLayers.find((layer) => layer.id === id);

  beforeEach(() => {
    createdMarkers.length = 0;
    createdSources.clear();
    addedLayers.length = 0;
  });

  test('区分が無い場合は全体を1本で描き、区間のソースは空にする', () => {
    mountAndLoad();

    expect(createdSources.get('route').data.type).toBe('Feature');
    expect(linesOf('route')).toEqual([geometry.coordinates]);
    expect(linesOf('route-walked-legs')).toEqual([]);
    expect(linesOf('route-current-leg')).toEqual([]);
  });

  test('区分がある場合は、これから・歩き終えた・今の区間をそれぞれのソースに入れる', () => {
    mountAndLoad({ legSections: secondSections });

    expect(linesOf('route')).toEqual([legGeometries[2].coordinates]);
    expect(linesOf('route-walked-legs')).toEqual([legGeometries[0].coordinates]);
    expect(linesOf('route-current-leg')).toEqual([legGeometries[1].coordinates]);
  });

  test('今の区間を最前面に、白い縁取りの上へ緑の太線で描き、歩き終えた区間は灰の破線にする', () => {
    mountAndLoad({ legSections: firstSections });

    expect(addedLayers.map((layer) => layer.id)).toEqual([
      'route-line-outline',
      'route-line',
      'route-walked-leg-line',
      'route-current-leg-casing',
      'route-current-leg-line'
    ]);
    expect(layerOf('route-current-leg-casing').paint).toEqual({
      'line-color': ROUTE_LINE_OUTLINE_COLOR,
      'line-width': ROUTE_CURRENT_LEG_CASING_WIDTH_PX
    });
    expect(ROUTE_CURRENT_LEG_CASING_WIDTH_PX).toBe(12);
    expect(layerOf('route-current-leg-line').paint).toEqual({
      'line-color': ROUTE_CURRENT_LEG_COLOR,
      'line-width': ROUTE_CURRENT_LEG_WIDTH_PX
    });
    expect(ROUTE_CURRENT_LEG_WIDTH_PX).toBe(7);

    const walkedPaint = layerOf('route-walked-leg-line').paint;
    expect(walkedPaint['line-color']).toBe(ROUTE_WALKED_LEG_COLOR);
    expect(walkedPaint['line-width']).toBe(ROUTE_WALKED_LEG_WIDTH_PX);
    expect(ROUTE_WALKED_LEG_WIDTH_PX).toBe(4);
    expect(walkedPaint['line-dasharray']).toEqual(expect.any(Array));
    // これからの区間は従来の青のまま
    expect(layerOf('route-line').paint['line-color']).toBe(ROUTE_LINE_COLOR);
  });

  test('区分が変わると各ソースを新しい区間で更新し、レイヤーは増やさない', async () => {
    const wrapper = mountAndLoad({ legSections: firstSections });
    const layerCount = addedLayers.length;

    await wrapper.setProps({ legSections: secondSections });
    await nextTick();

    expect(createdSources.get('route').setData).toHaveBeenCalled();
    expect(createdSources.get('route-walked-legs').setData).toHaveBeenCalled();
    expect(createdSources.get('route-current-leg').setData).toHaveBeenCalled();
    expect(linesOf('route-current-leg')).toEqual([legGeometries[1].coordinates]);
    expect(linesOf('route-walked-legs')).toEqual([legGeometries[0].coordinates]);
    expect(addedLayers.length).toBe(layerCount);
  });

  test('区分が null に戻ると全体を1本で描き、区間のソースを空にする', async () => {
    const wrapper = mountAndLoad({ legSections: firstSections });

    await wrapper.setProps({ legSections: null });
    await nextTick();

    expect(linesOf('route')).toEqual([geometry.coordinates]);
    expect(linesOf('route-walked-legs')).toEqual([]);
    expect(linesOf('route-current-leg')).toEqual([]);
  });
});

describe('RouteMap（地図のコントロール）', () => {
  beforeEach(() => {
    createdMarkers.length = 0;
    createdSources.clear();
    addedLayers.length = 0;
    addedControls.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('拡大・縮小のボタンは置かず、現在地へ戻るボタンだけを置く', () => {
    mountAndLoad({
      showCurrentLocation: true,
      currentLocation: { lng: 139.7036, lat: 35.6862 }
    });

    const containers = addedControls.map((control) => control.onAdd());

    // 拡大・縮小のボタンを置くと、地図の右上が埋まり見づらくなる
    expect(containers).toHaveLength(1);
    expect(containers[0].querySelector('.recenter-btn')).not.toBeNull();
    expect(containers[0].querySelector('.maplibregl-ctrl-zoom-in')).toBeNull();
  });
});

describe('RouteMap（初期表示の位置と現在地へ戻るときの位置）', () => {
  /** スタート地点（経路の先頭） */
  const origin = [139.7036, 35.6862];

  /** 最初の区間（スタート地点→1スポット目） */
  const firstLeg = {
    type: 'LineString',
    coordinates: [origin, [139.7046, 35.6872]]
  };

  /** 2つ目の区間。最初の区間から遠くへ延びる */
  const secondLeg = {
    type: 'LineString',
    coordinates: [[139.7046, 35.6872], [139.72, 35.7]]
  };

  /** 経路全体（最初の区間より広い） */
  const wholeGeometry = {
    type: 'LineString',
    coordinates: [...firstLeg.coordinates, [139.72, 35.7]]
  };

  /** 案内開始直後の区間の描き分け */
  const startSections = { walkedLegs: [], currentLeg: firstLeg, upcomingLegs: [secondLeg] };

  /**
   * @description 囲む矩形の中心を求める
   * @param {number[][]} bounds [[南西], [北東]]
   * @returns {number[]} [経度, 緯度]
   */
  const centerOf = ([[west, south], [east, north]]) => [(west + east) / 2, (south + north) / 2];

  /** 地図の枠の高さ。jsdom は配置を計算せず 0 になるため差し替える */
  let clientHeightSpy = null;

  /**
   * @description 地図の枠の高さを差し替える
   * @param {number} heightPx 高さ（ピクセル）
   * @returns {void}
   */
  const setMapHeight = (heightPx) => {
    clientHeightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(heightPx);
  };

  beforeEach(() => {
    createdMarkers.length = 0;
    createdSources.clear();
    addedLayers.length = 0;
    addedControls.length = 0;
    fitBoundsCalls.length = 0;
    easeToCalls.length = 0;
  });

  afterEach(() => {
    clientHeightSpy?.mockRestore();
    clientHeightSpy = null;
    vi.clearAllMocks();
  });

  test('案内画面では、スタート地点を中央にしたまま最初の区間が収まる範囲に寄せる', () => {
    setMapHeight(800);

    mountAndLoad({
      geometry: wholeGeometry,
      legSections: startSections,
      shouldCenterOnOrigin: true,
      topInsetPx: 236,
      bottomInsetPx: 100
    });

    expect(fitBoundsCalls).toHaveLength(1);
    const [bounds, options] = fitBoundsCalls[0];
    const [centerLng, centerLat] = centerOf(bounds);

    // 矩形の中心がスタート地点になる
    expect(centerLng).toBeCloseTo(origin[0], 10);
    expect(centerLat).toBeCloseTo(origin[1], 10);
    // 最初の区間の終点（1スポット目）が収まる
    expect(bounds[1][0]).toBeCloseTo(139.7046, 10);
    expect(bounds[1][1]).toBeCloseTo(35.6872, 10);
    // 経路全体（遠くへ延びる2つ目の区間）までは収めない
    expect(bounds[1][0]).toBeLessThan(139.72);
    // 上下は画面の操作で隠れる高さを足し、見えている範囲の中央に置く
    expect(options).toEqual({
      padding: {
        top: 236 + MAP_FIT_PADDING_PX,
        bottom: 100 + MAP_FIT_PADDING_PX,
        left: MAP_FIT_PADDING_PX,
        right: MAP_FIT_PADDING_PX
      },
      maxZoom: MAX_FIT_ZOOM_LEVEL,
      animate: false
    });
  });

  test('1スポット目へ進めた後に読み込みが終わっても、最初の区間（歩き終えた区間の先頭）を使う', () => {
    setMapHeight(800);

    mountAndLoad({
      geometry: wholeGeometry,
      legSections: { walkedLegs: [firstLeg], currentLeg: secondLeg, upcomingLegs: [] },
      shouldCenterOnOrigin: true
    });

    const [bounds] = fitBoundsCalls[0];

    expect(bounds[1][0]).toBeCloseTo(139.7046, 10);
    expect(centerOf(bounds)[0]).toBeCloseTo(origin[0], 10);
  });

  test('区間の描き分けが無いルートでは、1スポット目の座標で最初の区間の代わりにする', () => {
    setMapHeight(800);

    mountAndLoad({
      geometry: wholeGeometry,
      spots: [{ ...spots[1], lng: 139.705, lat: 35.688 }],
      shouldCenterOnOrigin: true
    });

    const [bounds] = fitBoundsCalls[0];
    const [centerLng, centerLat] = centerOf(bounds);

    expect(centerLng).toBeCloseTo(origin[0], 10);
    expect(centerLat).toBeCloseTo(origin[1], 10);
    expect(bounds[1][0]).toBeCloseTo(139.705, 10);
    expect(bounds[1][1]).toBeCloseTo(35.688, 10);
  });

  test('隠れる高さが地図の高さを超えて収められないときは、固定の倍率でスタート地点を中央に置く', () => {
    setMapHeight(300);

    mountAndLoad({
      geometry: wholeGeometry,
      legSections: startSections,
      shouldCenterOnOrigin: true,
      topInsetPx: 236,
      bottomInsetPx: 100
    });

    expect(fitBoundsCalls).toHaveLength(0);
    expect(easeToCalls).toEqual([
      { center: origin, zoom: NAVIGATION_ZOOM_LEVEL, offset: [0, (236 - 100) / 2], duration: 0 }
    ]);
  });

  test('提案画面（shouldCenterOnOrigin が偽）は従来どおりルート全体を収める', () => {
    setMapHeight(800);

    mountAndLoad({ geometry: wholeGeometry, spots: [], legSections: startSections });

    expect(fitBoundsCalls).toEqual([
      [
        [
          [139.7036, 35.6862],
          [139.72, 35.7]
        ],
        { padding: MAP_FIT_PADDING_PX, maxZoom: MAX_FIT_ZOOM_LEVEL, animate: false }
      ]
    ]);
  });

  test('現在地へ戻るボタンは、押した時点の倍率のまま現在地を見えている範囲の中央に置く', () => {
    setMapHeight(800);

    mountAndLoad({
      geometry: wholeGeometry,
      legSections: startSections,
      shouldCenterOnOrigin: true,
      showCurrentLocation: true,
      currentLocation: { lng: 139.71, lat: 35.69 },
      topInsetPx: 236,
      bottomInsetPx: 100
    });

    const button = addedControls[0].onAdd().querySelector('.recenter-btn');
    button.click();

    // zoom を渡さないことで、利用者が合わせた縮尺のまま位置だけを戻す
    expect(easeToCalls).toEqual([
      { center: [139.71, 35.69], offset: [0, (236 - 100) / 2] }
    ]);
    expect(easeToCalls[0]).not.toHaveProperty('zoom');
  });
});

describe('global.css（区間の色）', () => {
  const css = readFileSync(resolve(process.cwd(), 'src/assets/styles/global.css'), 'utf8');

  /**
   * @description :root で宣言した CSS 変数の値を取り出す
   * @param {string} name 変数名（-- から）
   * @returns {string|undefined} 値
   */
  const variableOf = (name) =>
    css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim();

  test('歩き終えた区間の灰は ROUTE_WALKED_LEG_COLOR と同じ値にする', () => {
    expect(variableOf('--route-walked-leg')?.toUpperCase()).toBe(ROUTE_WALKED_LEG_COLOR);
  });

  test('今の区間はトーストの左枠と同じ緑（--accent-green）で、ROUTE_CURRENT_LEG_COLOR と同じ値にする', () => {
    expect(variableOf('--route-current-leg')).toBe('var(--accent-green)');
    expect(variableOf('--accent-green')?.toUpperCase()).toBe(ROUTE_CURRENT_LEG_COLOR);
  });
});

describe('global.css（巡る口コミの場所の番号の丸）', () => {
  /**
   * 全画面共通のスタイル。jsdom では描画した色を確かめられないため、宣言を読んで確かめる。
   * jsdom 環境では import.meta.url が file: にならないため、実行ディレクトリ（frontend）から引く
   */
  const css = readFileSync(resolve(process.cwd(), 'src/assets/styles/global.css'), 'utf8');

  /**
   * @description 指定したセレクタ単独の宣言ブロックを取り出す。
   * `a,\nb { ... }` のように複数のセレクタで共有するブロックは対象にしない
   * （直前の行がカンマで終わるものは共有ブロックの一部のため除く）。
   * @param {string} selector セレクタ
   * @returns {string} 宣言ブロックの中身。見つからなければ空文字
   */
  const blockOf = (selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'g');

    for (const match of css.matchAll(pattern)) {
      const before = css.slice(0, match.index).trimEnd();

      if (!before.endsWith(',')) {
        return match[2];
      }
    }

    return '';
  };

  test('巡る口コミの場所は色だけを紫にし、形・番号・大きさは通常のスポットのまま', () => {
    const block = blockOf('.spot-marker.is-review');

    expect(block).toMatch(/background:\s*var\(--review-purple\)/);
    // 丸の形・大きさ・番号の文字は .spot-marker のまま変えない
    expect(block).not.toMatch(
      /(^|[\s;])(width|height|border|border-radius|font-size|font-weight|color)\s*:/
    );
    expect(blockOf('.spot-marker')).toMatch(/border-radius:\s*50%/);
    // 通常のスポットは青の丸のまま
    expect(blockOf('.spot-marker')).toMatch(/background:\s*var\(--route-blue\)/);
  });

  test('ボタンにした番号の丸は、ボタンの既定の余白と書体を打ち消す', () => {
    const block = blockOf('.spot-marker.is-review');

    expect(block).toMatch(/padding:\s*0/);
    expect(block).toMatch(/font-family:\s*inherit/);
  });

  test('到達済みは紫・オレンジを残さず、通常のスポットと同じ足跡のスタンプにする', () => {
    expect(blockOf('.spot-marker.is-review.is-visited')).toMatch(
      /background:\s*url\('\.\.\/images\/spot-visited-stamp\.png'\)/
    );
  });

  test('自分の口コミの場所はオレンジにし、白では読めない番号だけ墨にする（形・大きさは通常のスポットのまま）', () => {
    const block = blockOf('.spot-marker.is-review.is-mine');

    expect(block).toMatch(/background:\s*var\(--review-orange\)/);
    // オレンジ（#F39C12）の上の白い文字はコントラスト約2.2:1で読めないため、墨（約6:1）にする
    expect(block).toMatch(/(^|[\s;])color:\s*var\(--text-dark\)/);
    expect(block).not.toMatch(
      /(^|[\s;])(width|height|border|border-radius|font-size|font-weight)\s*:/
    );
  });

  test('到達済みの指定は自分の口コミの場所の色より後ろに置く（詳細度が同じため、後ろが勝つ）', () => {
    const myReviewIndex = css.indexOf('\n.spot-marker.is-review.is-mine {');
    const visitedIndex = css.indexOf('\n.spot-marker.is-review.is-visited {');

    expect(myReviewIndex).toBeGreaterThan(-1);
    expect(visitedIndex).toBeGreaterThan(myReviewIndex);
  });

  test('自分の口コミの場所を選択中は、輪も丸と同じオレンジにする（大きさは変えない）', () => {
    const block = blockOf('.spot-marker.is-review.is-mine.is-selected');

    expect(block).toMatch(/box-shadow:[^;]*var\(--review-orange\)/);
    expect(block).not.toMatch(/var\(--review-purple\)/);
    expect(block).not.toMatch(/(^|[\s;])(width|height)\s*:/);
  });

  test('選択中は大きさを変えず（中心が座標のため）、輪と前面への移動で目立たせる', () => {
    const block = blockOf('.spot-marker.is-review.is-selected');

    expect(block).toMatch(/z-index:\s*1/);
    expect(block).toMatch(/box-shadow:/);
    expect(block).not.toMatch(/(^|[\s;])(width|height)\s*:/);
  });

  test('口コミのピン（オレンジ・紫）の見た目は変えていない', () => {
    // ピンを描き分けていた前回の指定・星の指定が残っていない
    expect(css).not.toMatch(/\.review-pin\.is-route-spot/);
    expect(css).not.toMatch(/(^|[\s;])mask:\s*url\(/);
    expect(blockOf('.review-pin-other .review-pin-head')).toMatch(
      /background:\s*var\(--review-purple\)/
    );
    // オレンジはルートの自分の口コミの場所と同じ変数にまとめた（値は従来の #F39C12 のまま）
    expect(blockOf('.review-pin-mine .review-pin-head')).toMatch(
      /background:\s*var\(--review-orange\)/
    );
    expect(css).toMatch(/--review-orange:\s*#F39C12;/);
  });
});
