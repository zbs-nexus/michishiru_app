import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

/**
 * @description 地図のスポットマーカーのテスト。
 * 口コミの場所だけが紫の目印（is-review）を持ち、番号・到達済みの表示・読み上げは
 * 他のスポットと同じ仕組みで動くことを確かめる。
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
      createdMarkers.push(this);
    }

    setLngLat(lngLat) {
      this.lngLat = lngLat;
      return this;
    }

    setPopup() {
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

/** 口コミの場所1つと通常のスポット1つのルート */
const spots = [
  { spotId: 'spot-1', name: '口コミの場所', lng: 139.7045, lat: 35.6872, isReviewSpot: true },
  { spotId: 'spot-2', name: '公園', lng: 139.703, lat: 35.686, isReviewSpot: false }
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

describe('RouteMap（口コミの場所のスポットマーカー）', () => {
  beforeEach(() => {
    createdMarkers.length = 0;
    createdSources.clear();
    addedLayers.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('口コミの場所だけに紫の目印を付け、番号は他のスポットと同じに出す', () => {
    mountAndLoad();

    const [reviewMarker, normalMarker] = spotMarkerElements();

    expect(reviewMarker.className).toBe('spot-marker is-review');
    expect(reviewMarker.textContent).toBe('1');
    expect(normalMarker.className).toBe('spot-marker');
    expect(normalMarker.textContent).toBe('2');
  });

  test('紫の色だけでは意味が伝わらないため、読み上げで口コミの場所だと補う', () => {
    mountAndLoad();

    const [reviewMarker, normalMarker] = spotMarkerElements();

    expect(reviewMarker.getAttribute('aria-label')).toBe('1番目のスポット（口コミの場所）');
    expect(normalMarker.getAttribute('aria-label')).toBe('2番目のスポット');
  });

  test('到達済みになると口コミの場所も足跡のスタンプになり、目印と読み上げは保つ', async () => {
    const wrapper = mountAndLoad();

    await wrapper.setProps({ visitedSpotIds: ['spot-1'] });
    await nextTick();

    const [reviewMarker, normalMarker] = spotMarkerElements();

    expect(reviewMarker.classList.contains('is-review')).toBe(true);
    expect(reviewMarker.classList.contains('is-visited')).toBe(true);
    expect(reviewMarker.textContent).toBe('');
    expect(reviewMarker.getAttribute('aria-label')).toBe(
      '1番目のスポット（到達済み・口コミの場所）'
    );
    // 通常のスポットは影響を受けない
    expect(normalMarker.classList.contains('is-visited')).toBe(false);
  });

  test('isReviewSpot を持たないスポット（古い応答）は紫にしない', () => {
    mountAndLoad({
      spots: [{ spotId: 'spot-1', name: '公園', lng: 139.703, lat: 35.686 }]
    });

    const [marker] = spotMarkerElements();

    expect(marker.classList.contains('is-review')).toBe(false);
  });

  test('口コミのピン（オレンジ・紫）はスポットの目印を持たず、従来の見た目のまま', () => {
    mountAndLoad({
      myReviewSpots: [{ spotId: 'r-1', spotName: '自分の口コミ', position: { lng: 139.7, lat: 35.68 } }],
      showMyReviews: true,
      otherReviewSpots: [
        { spotId: 'r-2', spotName: '他の人の口コミ', position: { lng: 139.71, lat: 35.69 } }
      ],
      showOtherReviews: true
    });

    const reviewPins = createdMarkers
      .map((marker) => marker.element)
      .filter((element) => element.classList.contains('review-pin'));

    expect(reviewPins.map((element) => element.className)).toEqual([
      'review-pin review-pin-mine',
      'review-pin review-pin-other'
    ]);
    expect(reviewPins.some((element) => element.classList.contains('is-review'))).toBe(false);
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

describe('global.css（口コミの場所のスポットの色）', () => {
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

  test('口コミの場所のスポットは色だけを紫にし、形・文字・大きさは通常のスポットのまま', () => {
    const block = blockOf('.spot-marker.is-review');

    expect(block).toMatch(/background:\s*var\(--review-purple\)/);
    // 丸の形・大きさ・番号の文字は .spot-marker のまま変えない
    expect(block).not.toMatch(
      /(^|[\s;])(width|height|border|border-radius|font-size|font-weight|color)\s*:/
    );
    expect(blockOf('.spot-marker')).toMatch(/border-radius:\s*50%/);
  });

  test('紫は口コミのピン（他の人の口コミ）と同じ変数を使い、通常のスポットは青のまま', () => {
    expect(css).toMatch(/--review-purple:\s*#8E44AD;/);
    expect(blockOf('.review-pin-other .review-pin-head')).toMatch(
      /background:\s*var\(--review-purple\)/
    );
    expect(blockOf('.spot-marker')).toMatch(/background:\s*var\(--route-blue\)/);
  });

  test('星の形の指定（擬似要素・mask）は残っていない', () => {
    expect(css).not.toMatch(/\.spot-marker\.is-review::(before|after)/);
    expect(css).not.toMatch(/(^|[\s;])mask:\s*url\(/);
  });

  test('到達済みは口コミの場所も足跡のスタンプになり、紫を残さない', () => {
    expect(blockOf('.spot-marker.is-review.is-visited')).toMatch(
      /background:\s*url\('\.\.\/images\/spot-visited-stamp\.png'\)/
    );
  });
});
