<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
// MapLibre GL v6 は名前付きエクスポートのみを提供する（既定エクスポートは無い）。
// 地図クラスは組み込みの Map と名前が衝突するため、別名の MapLibreMap を使う。
import { MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_ZOOM_LEVEL,
  MAP_FIT_PADDING_PX,
  MAP_STYLE,
  MAX_FIT_ZOOM_LEVEL,
  ROUTE_LINE_COLOR,
  ROUTE_LINE_OUTLINE_COLOR,
  ROUTE_LINE_OUTLINE_WIDTH_PX,
  ROUTE_LINE_WIDTH_PX
} from '@/constants/mapDefaults';
import { toCoordinateBounds } from '@/utils/geoBounds';

/**
 * @description 実地図の上にルートの線とスポットを描画する。
 * 経路の座標列（geometry）から線を引き、ルート全体が収まる位置まで地図を寄せる。
 *
 * 地図ライブラリはDOM要素を直接必要とするため、生成と破棄をこのコンポーネントが持つ。
 */
const props = defineProps({
  /** 経路の形（GeoJSONのLineString）。未取得の場合はnull */
  geometry: {
    type: Object,
    default: null
  },
  /** 地図に表示する立ち寄り先の一覧 */
  spots: {
    type: Array,
    default: () => []
  },
  /** 地図の操作（ドラッグ・ズーム）を許可するかどうか */
  isInteractive: {
    type: Boolean,
    default: true
  }
});

/** ルートの経路を保持するソースのID */
const ROUTE_SOURCE_ID = 'route';

/** ルートの線の縁取りを描くレイヤーのID */
const ROUTE_OUTLINE_LAYER_ID = 'route-line-outline';

/** ルートの線を描くレイヤーのID */
const ROUTE_LINE_LAYER_ID = 'route-line';

/** 地図を描画するDOM要素 */
const mapContainer = ref(null);

/** 経路が無く線を引けない状態かどうか */
const hasNoGeometry = ref(false);

/**
 * 地図のインスタンスとマーカー。
 * ライブラリが内部で持つ状態をVueに追跡させると不具合の原因になるため、
 * refではなく通常の変数で保持する。
 */
let map = null;
let markers = [];

/**
 * @description 座標列をGeoJSONのFeatureへ包む
 * @param {object|null} geometry 経路の形
 * @returns {object} ソースへ渡すGeoJSON
 */
const toRouteFeature = (geometry) => ({
  type: 'Feature',
  properties: {},
  geometry: geometry ?? { type: 'LineString', coordinates: [] }
});

/**
 * @description スポットの見出し要素を組み立てる。
 * ライブラリがマーカーをコンポーネントの外側へ挿入するため、
 * スタイルは global.css に置いている。
 * @param {number} order 巡る順序（1始まり）
 * @returns {HTMLElement} マーカーとして使う要素
 */
const createSpotMarkerElement = (order) => {
  const element = document.createElement('div');
  element.className = 'spot-marker';
  element.textContent = String(order);
  return element;
};

/**
 * @description ルート全体とスポットが収まる位置まで地図を寄せる
 * @returns {void}
 */
const fitToRoute = () => {
  const spotCoordinates = props.spots
    .filter((spot) => spot.lng !== null && spot.lat !== null)
    .map((spot) => [spot.lng, spot.lat]);

  const bounds = toCoordinateBounds([
    ...(props.geometry?.coordinates ?? []),
    ...spotCoordinates
  ]);

  if (bounds === null) {
    return;
  }

  map.fitBounds(bounds, {
    padding: MAP_FIT_PADDING_PX,
    maxZoom: MAX_FIT_ZOOM_LEVEL,
    animate: false
  });
};

/**
 * @description 経路の線を描き直す
 * @returns {void}
 */
const renderRouteLine = () => {
  hasNoGeometry.value = props.geometry === null;

  const source = map.getSource(ROUTE_SOURCE_ID);

  if (source) {
    source.setData(toRouteFeature(props.geometry));
    return;
  }

  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: toRouteFeature(props.geometry)
  });

  // 縁取りを先に敷いてから本体を重ね、地図の背景に紛れないようにする
  map.addLayer({
    id: ROUTE_OUTLINE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_LINE_OUTLINE_COLOR,
      'line-width': ROUTE_LINE_OUTLINE_WIDTH_PX
    }
  });

  map.addLayer({
    id: ROUTE_LINE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_LINE_COLOR,
      'line-width': ROUTE_LINE_WIDTH_PX
    }
  });
};

/**
 * @description スポットのマーカーを描き直す
 * @returns {void}
 */
const renderSpotMarkers = () => {
  markers.forEach((marker) => marker.remove());

  markers = props.spots
    .filter((spot) => spot.lng !== null && spot.lat !== null)
    .map((spot, index) =>
      new Marker({ element: createSpotMarkerElement(index + 1) })
        .setLngLat([spot.lng, spot.lat])
        .setPopup(new Popup({ offset: 16 }).setText(spot.name))
        .addTo(map)
    );
};

onMounted(() => {
  map = new MapLibreMap({
    container: mapContainer.value,
    style: MAP_STYLE,
    center: DEFAULT_MAP_CENTER,
    zoom: DEFAULT_ZOOM_LEVEL,
    interactive: props.isInteractive,
    attributionControl: { compact: true }
  });

  if (props.isInteractive) {
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  }

  // スタイルの読み込み完了前はソースを追加できないため、loadを待つ
  map.on('load', () => {
    renderRouteLine();
    renderSpotMarkers();
    fitToRoute();
  });
});

// 再作成で別のルートに差し替わった場合に描画を更新する
watch(
  () => [props.geometry, props.spots],
  () => {
    if (map === null || !map.isStyleLoaded()) {
      return;
    }

    renderRouteLine();
    renderSpotMarkers();
    fitToRoute();
  }
);

onBeforeUnmount(() => {
  markers.forEach((marker) => marker.remove());
  markers = [];
  map?.remove();
  map = null;
});
</script>

<template>
  <div class="route-map">
    <div
      ref="mapContainer"
      class="route-map-canvas"
    />
    <p
      v-if="hasNoGeometry"
      class="route-map-notice"
      role="status"
    >
      経路のデータが無いため、線を表示できません
    </p>
  </div>
</template>

<style scoped>
.route-map {
  position: relative;
  width: 100%;
  height: 100%;
}

.route-map-canvas {
  width: 100%;
  height: 100%;
}

.route-map-notice {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--white);
  box-shadow: var(--shadow);
  font-size: 12px;
  color: var(--text-gray);
  text-align: center;
}
</style>
