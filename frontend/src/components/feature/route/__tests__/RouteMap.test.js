import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

/**
 * @description 地図のスポットマーカーのテスト。
 * ルートで巡る口コミの場所は口コミのピンと同じ形で描き、押すと口コミを開くこと、
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

    addControl() {}

    fitBounds() {}

    getZoom() {
      return 15;
    }

    easeTo() {}

    remove() {}
  }

  return {
    MapLibreMap: FakeMap,
    Marker: FakeMarker,
    Popup: FakePopup,
    NavigationControl: class {},
    setWorkerUrl: () => {}
  };
});

vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '' }));

const { default: RouteMap } = await import('@/components/feature/route/RouteMap.vue');
const {
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

  test('紫と押せることは見た目だけでは伝わらないため、読み上げで補う', () => {
    mountAndLoad();

    expect(routeReviewSpotMarkers()[0].element.getAttribute('aria-label')).toBe(
      '1番目のスポット（口コミの場所）：口コミの場所の口コミを見る'
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
      '1番目のスポット（到達済み・口コミの場所）：口コミの場所の口コミを見る'
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

  test('到達済みは紫を残さず、通常のスポットと同じ足跡のスタンプにする', () => {
    expect(blockOf('.spot-marker.is-review.is-visited')).toMatch(
      /background:\s*url\('\.\.\/images\/spot-visited-stamp\.png'\)/
    );
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
    expect(blockOf('.review-pin-mine .review-pin-head')).toMatch(/background:\s*#F39C12/);
  });
});
