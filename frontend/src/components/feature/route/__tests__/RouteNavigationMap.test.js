import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';

/**
 * @description 案内画面の地図が、案内開始時にスタート地点を中央へ置く設定で地図を描くかのテスト。
 * 寄せ方そのものは RouteMap のテストで確かめるため、ここでは RouteMap へ渡す値だけを見る。
 *
 * RouteMap は MapLibre を読み込むため、jsdom で読めるよう差し替える。
 */
vi.mock('maplibre-gl', () => ({
  MapLibreMap: class {},
  Marker: class {},
  Popup: class {},
  setWorkerUrl: () => {}
}));
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}));
vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({ default: '' }));

const { default: RouteNavigationMap } = await import(
  '@/components/feature/route/RouteNavigationMap.vue'
);
const { default: RouteMap } = await import('@/components/feature/route/RouteMap.vue');

describe('RouteNavigationMap', () => {
  test('スタート地点を中央に置く設定と、地図の上下が隠れる高さを RouteMap へ渡す', () => {
    const wrapper = mount(RouteNavigationMap, {
      shallow: true,
      props: { spots: [], topInsetPx: 237, bottomInsetPx: 68 }
    });

    const map = wrapper.findComponent(RouteMap);

    expect(map.props('shouldCenterOnOrigin')).toBe(true);
    expect(map.props('topInsetPx')).toBe(237);
    expect(map.props('bottomInsetPx')).toBe(68);
  });
});
