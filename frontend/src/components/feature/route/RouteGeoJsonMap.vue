<script setup>
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
// maplibre-gl 6系はdefaultエクスポートを持たないため、名前付きでimportする
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/**
 * @description バックエンドから受け取ったGeoJSONをそのまま地図へ描画する。
 * featureKindごとに描画を振り分けるだけで、座標の加工は行わない。
 *
 * 段階1aではベースマップを使わない。地図タイルの配信には認証が必要で、
 * ルート線とスポットの位置関係を確かめるだけなら不要なためである。
 */
const props = defineProps({
  /** 描画するGeoJSON（FeatureCollection） */
  geojson: {
    type: Object,
    required: true
  }
});

/** GeoJSONを登録するソースのID */
const SOURCE_ID = 'route-geojson';

/** 地図の初期表示位置（東京駅） */
const INITIAL_CENTER = [139.767125, 35.681236];

/** 地図の初期ズーム */
const INITIAL_ZOOM = 14;

/** ベースマップを持たない地図のスタイル定義 */
const BLANK_STYLE = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#eef3f6' }
    }
  ]
};

/** 地図を描画する要素 */
const mapContainer = ref(null);

/** MapLibreのインスタンス。テンプレートから参照しないためrefにしない */
let map = null;

/** 地図のスタイル読み込みが完了したかどうか */
let isStyleLoaded = false;

/** スポットに付けたDOMマーカー。GeoJSON更新時に作り直す */
let spotMarkers = [];

/**
 * @description FeatureCollectionに含まれる全座標を平坦な配列にする
 * @param {object} geojson FeatureCollection
 * @returns {number[][]} [経度, 緯度] の配列
 */
const collectPositions = (geojson) =>
  (geojson?.features ?? []).flatMap((feature) => {
    if (feature.geometry?.type === 'LineString') {
      return feature.geometry.coordinates;
    }

    if (feature.geometry?.type === 'Point') {
      return [feature.geometry.coordinates];
    }

    return [];
  });

/**
 * @description GeoJSON全体が収まるように表示範囲を合わせる
 * @param {object} geojson FeatureCollection
 * @returns {void}
 */
const fitToGeoJson = (geojson) => {
  const positions = collectPositions(geojson);

  if (positions.length === 0) {
    return;
  }

  const bounds = positions.reduce(
    (accumulated, position) => accumulated.extend(position),
    new LngLatBounds(positions[0], positions[0])
  );

  map.fitBounds(bounds, { padding: 48, duration: 0 });
};

/**
 * @description スポットの名前と立ち寄り順を示すDOMマーカーを作り直す。
 * 文字の描画にフォント（glyphs）の配信元が必要になるsymbolレイヤーを避けるため、
 * ラベルはDOM要素で表示する。
 * @param {object} geojson FeatureCollection
 * @returns {void}
 */
const renderSpotMarkers = (geojson) => {
  spotMarkers.forEach((marker) => marker.remove());
  spotMarkers = [];

  (geojson?.features ?? [])
    .filter((feature) => feature.properties?.featureKind === 'spot')
    .forEach((feature) => {
      const element = document.createElement('div');
      element.className = 'spot-label';
      element.textContent = `${feature.properties.visitOrder}. ${feature.properties.name}`;

      spotMarkers.push(
        new Marker({ element, anchor: 'bottom' })
          .setLngLat(feature.geometry.coordinates)
          .addTo(map)
      );
    });
};

/**
 * @description GeoJSONをソースへ登録し、featureKindごとのレイヤーを追加する
 * @param {object} geojson FeatureCollection
 * @returns {void}
 */
const addGeoJsonLayers = (geojson) => {
  map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });

  map.addLayer({
    id: 'route-line',
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['get', 'featureKind'], 'route'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#2f7d5b', 'line-width': 5, 'line-opacity': 0.9 }
  });

  map.addLayer({
    id: 'spot-circle',
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'featureKind'], 'spot'],
    paint: {
      'circle-radius': 9,
      'circle-color': '#ff8a3d',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3
    }
  });

  map.addLayer({
    id: 'origin-circle',
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'featureKind'], 'origin'],
    paint: {
      'circle-radius': 7,
      'circle-color': '#1b62c4',
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3
    }
  });
};

/**
 * @description 受け取ったGeoJSONを地図へ反映する。
 * 初回はレイヤーを追加し、2回目以降はソースのデータのみ差し替える。
 * @param {object} geojson FeatureCollection
 * @returns {void}
 */
const applyGeoJson = (geojson) => {
  if (!map || !isStyleLoaded || !geojson) {
    return;
  }

  // 地図ライブラリはGeoJSONをWeb Workerへ渡すため構造化複製が行われる。
  // リアクティブProxyのままでは DataCloneError で読み込みに失敗するため、素の値へ戻す。
  const rawGeoJson = toRaw(geojson);

  if (map.getSource(SOURCE_ID)) {
    map.getSource(SOURCE_ID).setData(rawGeoJson);
  } else {
    addGeoJsonLayers(rawGeoJson);
  }

  renderSpotMarkers(rawGeoJson);
  fitToGeoJson(rawGeoJson);
};

onMounted(() => {
  map = new MapLibreMap({
    container: mapContainer.value,
    style: BLANK_STYLE,
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    attributionControl: false
  });

  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

  // 地図側の失敗は例外にならずこのイベントへ流れる。放置すると無言で描画されないだけになる
  map.on('error', (event) => {
    console.error('地図の描画に失敗しました', event.error ?? event);
  });

  map.on('load', () => {
    isStyleLoaded = true;
    applyGeoJson(props.geojson);
  });
});

onBeforeUnmount(() => {
  spotMarkers.forEach((marker) => marker.remove());
  spotMarkers = [];
  map?.remove();
  map = null;
});

watch(
  () => props.geojson,
  (geojson) => applyGeoJson(geojson)
);
</script>

<template>
  <div
    ref="mapContainer"
    class="route-map"
    role="img"
    aria-label="生成されたルートの地図"
  />
</template>

<style scoped>
.route-map {
  width: 100%;
  height: 380px;
  border-radius: 12px;
  overflow: hidden;
}

.route-map :deep(.spot-label) {
  transform: translateY(-14px);
  padding: 2px 8px;
  border-radius: 10px;
  background: rgb(255 255 255 / 92%);
  box-shadow: 0 1px 4px rgb(0 0 0 / 25%);
  font-size: 12px;
  font-weight: 700;
  color: #333;
  white-space: nowrap;
  pointer-events: none;
}
</style>
