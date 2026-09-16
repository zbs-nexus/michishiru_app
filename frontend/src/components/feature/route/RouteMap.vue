<script setup>
import { onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue';
// MapLibre GL v6 は名前付きエクスポートのみを提供する（既定エクスポートは無い）。
// 地図クラスは組み込みの Map と名前が衝突するため、別名の MapLibreMap を使う。
import { MapLibreMap, Marker, NavigationControl, Popup, setWorkerUrl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre v6 は geojson の処理を担うワーカーを別ファイルに分けており、
// その URL を `new URL(`./${変数}`, ...)` と動的に組み立てる。
// Vite は静的解析できずワーカーのファイルを出力しないため、実行時に
// /assets/maplibre-gl-worker.mjs が404となり（SPAフォールバックでindex.htmlが返る）
// ワーカーが起動せず、線が描かれない。
// ここで Vite にワーカーとしてバンドルさせ、その URL を明示的に渡す。
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
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

// 地図を生成する前に一度だけ設定する必要があるため、モジュールの読み込み時に実行する
setWorkerUrl(maplibreWorkerUrl);

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
  },
  /** 現在地を表示するかどうか（案内中のみ有効） */
  showCurrentLocation: {
    type: Boolean,
    default: false
  },
  /** 現在地の座標 { lng, lat } */
  currentLocation: {
    type: Object,
    default: null
  },
  /** 現在地の方向（度、北を0度として時計回り） */
  currentHeading: {
    type: Number,
    default: null
  },
  /** 現在地の精度（メートル） */
  currentAccuracy: {
    type: Number,
    default: null
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
let currentLocationMarker = null;

/**
 * @description 座標列をGeoJSONのFeatureへ包む。
 *
 * MapLibre は geojson のデータをワーカースレッドへ構造化複製で渡す。
 * Piniaのストア経由で受け取った値はリアクティブなProxyになっており、
 * そのまま渡すと複製に失敗して線が描かれない。失敗はワーカー側で起きるため
 * 画面には何も出ず、線だけが静かに欠ける。
 * ここで素の数値の配列へ作り直してから渡すこと。
 * @param {object|null} geometry 経路の形
 * @returns {object} ソースへ渡すGeoJSON
 */
const toRouteFeature = (geometry) => {
  const rawGeometry = geometry === null ? null : toRaw(geometry);

  const coordinates = (rawGeometry?.coordinates ?? []).map((position) => [
    Number(position[0]),
    Number(position[1])
  ]);

  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'LineString', coordinates }
  };
};

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
 * @description 現在地マーカーのDOM要素を作成する。
 * Google Maps風の青い円と方向を示す矢印で構成される。
 * @returns {HTMLElement} 現在地マーカー要素
 */
const createCurrentLocationElement = () => {
  const container = document.createElement('div');
  container.className = 'current-location-marker';

  // 外側の円（精度を示す）
  const accuracyCircle = document.createElement('div');
  accuracyCircle.className = 'current-location-accuracy';
  container.appendChild(accuracyCircle);

  // 内側の青い円
  const innerCircle = document.createElement('div');
  innerCircle.className = 'current-location-dot';
  container.appendChild(innerCircle);

  // 方向を示す矢印
  const arrow = document.createElement('div');
  arrow.className = 'current-location-arrow';
  container.appendChild(arrow);

  return container;
};

/**
 * @description 現在地マーカーの方向を更新する
 * @param {number|null} heading 方向（度）
 * @returns {void}
 */
const updateCurrentLocationHeading = (heading) => {
  if (currentLocationMarker === null) {
    return;
  }

  const element = currentLocationMarker.getElement();
  const arrow = element.querySelector('.current-location-arrow');

  if (arrow === null) {
    return;
  }

  if (heading === null) {
    arrow.style.display = 'none';
  } else {
    arrow.style.display = 'block';
    arrow.style.transform = `rotate(${heading}deg)`;
  }
};

/**
 * @description 現在地マーカーを描画または更新する
 * @returns {void}
 */
const renderCurrentLocationMarker = () => {
  if (!props.showCurrentLocation || props.currentLocation === null) {
    // 現在地表示が無効または座標がない場合は削除
    if (currentLocationMarker !== null) {
      currentLocationMarker.remove();
      currentLocationMarker = null;
    }
    return;
  }

  const lngLat = [props.currentLocation.lng, props.currentLocation.lat];

  if (currentLocationMarker === null) {
    // 初回作成
    currentLocationMarker = new Marker({
      element: createCurrentLocationElement(),
      anchor: 'center'
    })
      .setLngLat(lngLat)
      .addTo(map);
  } else {
    // 位置のみ更新
    currentLocationMarker.setLngLat(lngLat);
  }

  // 方向を更新
  updateCurrentLocationHeading(props.currentHeading);
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
  const routeFeature = toRouteFeature(props.geometry);

  // 1点だけでは線にならないため、実際に線を引ける座標数で判定する
  hasNoGeometry.value = routeFeature.geometry.coordinates.length < 2;

  const source = map.getSource(ROUTE_SOURCE_ID);

  if (source) {
    source.setData(routeFeature);
    return;
  }

  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: routeFeature
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

  // ソースやタイルの失敗はワーカースレッドで起きるため、
  // ここで拾わないと画面には何も出ずに描画だけが欠ける
  map.on('error', (event) => {
    console.error('地図の描画に失敗しました', event.error ?? event);
  });

  if (props.isInteractive) {
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  }

  // スタイルの読み込み完了前はソースを追加できないため、loadを待つ
  map.on('load', () => {
    renderRouteLine();
    renderSpotMarkers();
    renderCurrentLocationMarker();
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

// 現在地が更新されたらマーカーを更新する
watch(
  () => [props.currentLocation, props.currentHeading, props.showCurrentLocation],
  () => {
    if (map === null || !map.isStyleLoaded()) {
      return;
    }

    renderCurrentLocationMarker();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  markers.forEach((marker) => marker.remove());
  markers = [];
  if (currentLocationMarker !== null) {
    currentLocationMarker.remove();
    currentLocationMarker = null;
  }
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
