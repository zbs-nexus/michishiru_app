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
import { useMapLongPress } from '@/composables/useMapLongPress';

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

  /** 現在地の精度（メートル） */
  currentAccuracy: {
    type: Number,
    default: null
  },
  /** 地図の長押しを検出して通知するかどうか */
  isLongPressEnabled: {
    type: Boolean,
    default: false
  },
  /** 長押しで立てる赤いピンの座標 { lng, lat }。未設定の場合はnull */
  pinPosition: {
    type: Object,
    default: null
  },
  /**
   * ピンを中央へ寄せるときの、地図中央からの縦のずれ（ピクセル）。
   * 画面上部のバナーや下部のフォームで地図が隠れる場合に、
   * 見えている範囲の中央へピンが来るよう親が指定する。下方向が正。
   */
  pinOffsetY: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['longPressMap']);

/** ルートの経路を保持するソースのID */
const ROUTE_SOURCE_ID = 'route';

/** ルートの線の縁取りを描くレイヤーのID */
const ROUTE_OUTLINE_LAYER_ID = 'route-line-outline';

/** ルートの線を描くレイヤーのID */
const ROUTE_LINE_LAYER_ID = 'route-line';

/** 開始地点のマーカーに表示する文字（Start の頭文字） */
const ORIGIN_MARKER_LABEL = 'S';

/** 現在地へ戻るボタンの読み上げ用の名前 */
const RECENTER_BUTTON_LABEL = '現在地へ戻る';

/** 開始地点のマーカーを押したときに出す文言 */
const ORIGIN_POPUP_TEXT = 'スタート地点';

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
let originMarker = null;
let currentLocationMarker = null;
let pinMarker = null;
let recenterControl = null;

/**
 * 初期表示の拡大率。
 * ルート全体を収めた直後の値を覚えておき、現在地へ戻るときに復元する。
 * 地図の生成時の値を初期値とし、ルートを収められない場合もこの値を使う。
 */
let initialZoomLevel = DEFAULT_ZOOM_LEVEL;

// 長押しの検出。地図の生成後にattachし、座標を親へ通知する
const { attach: attachLongPress } = useMapLongPress({
  onLongPress: (position) => emit('longPressMap', position)
});

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
 * @description 経路の先頭の座標を取り出す。
 * ルート生成時に現在地を出発地として送っているため、経路の先頭が開始地点になる。
 * @param {object|null} geometry 経路の形
 * @returns {number[]|null} [経度, 緯度]。取り出せない場合はnull
 */
const toOriginPosition = (geometry) => {
  const rawGeometry = geometry === null ? null : toRaw(geometry);
  const firstPosition = rawGeometry?.coordinates?.[0];

  if (!Array.isArray(firstPosition)) {
    return null;
  }

  const lng = Number(firstPosition[0]);
  const lat = Number(firstPosition[1]);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return [lng, lat];
};

/**
 * @description 開始地点の目印となる要素を組み立てる。
 * スポットのマーカー（青い丸に巡る順の番号）と見分けられるよう、
 * 色と表示する文字を変えている。
 * @returns {HTMLElement} マーカーとして使う要素
 */
const createOriginMarkerElement = () => {
  const element = document.createElement('div');
  element.className = 'origin-marker';
  element.textContent = ORIGIN_MARKER_LABEL;
  return element;
};

/**
 * @description 開始地点のマーカーを描き直す。
 * 経路が無い場合は目印も消す。
 * @returns {void}
 */
const renderOriginMarker = () => {
  const originPosition = toOriginPosition(props.geometry);

  if (originPosition === null) {
    originMarker?.remove();
    originMarker = null;
    return;
  }

  if (originMarker === null) {
    originMarker = new Marker({ element: createOriginMarkerElement() })
      .setLngLat(originPosition)
      .setPopup(new Popup({ offset: 16 }).setText(ORIGIN_POPUP_TEXT))
      .addTo(map);
    return;
  }

  // 再作成で別のルートに差し替わった場合は位置だけ更新する
  originMarker.setLngLat(originPosition);
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
 * 精度を示す外円と、現在地を示す青い円で構成される。
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

  return container;
};

/**
 * @description 地図の中心を現在地へ寄せ、拡大率を初期表示と同じに戻す。
 * @returns {void}
 */
const centerOnCurrentLocation = () => {
  if (map === null || props.currentLocation === null) {
    return;
  }

  map.easeTo({
    center: [props.currentLocation.lng, props.currentLocation.lat],
    zoom: initialZoomLevel
  });
};

/**
 * @description 現在地へ戻るコントロールを組み立てる。
 * MapLibreのコントロールとして追加することで、ズームボタンと同じ枠に
 * 同じ見た目で並ぶ（後から追加したものが下に来る）。
 * @returns {object} MapLibreのIControlを満たすオブジェクト
 */
const createRecenterControl = () => {
  const container = document.createElement('div');
  container.className = 'maplibregl-ctrl maplibregl-ctrl-group';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'recenter-btn';
  // アイコンのみのボタンなので、読み上げ用の名前を付ける
  button.setAttribute('aria-label', RECENTER_BUTTON_LABEL);
  button.title = RECENTER_BUTTON_LABEL;
  button.addEventListener('click', centerOnCurrentLocation);

  container.appendChild(button);

  return {
    onAdd: () => container,
    onRemove: () => {
      button.removeEventListener('click', centerOnCurrentLocation);
      container.remove();
    }
  };
};

/**
 * @description 現在地へ戻るコントロールを必要になった時点で追加する。
 *
 * 追跡の開始は親（View）のonMountedで行われ、子のonMountedより後になる。
 * 地図の生成時には現在地の表示が無効のままなので、ここで追加する。
 * @returns {void}
 */
const ensureRecenterControl = () => {
  if (
    recenterControl !== null ||
    map === null ||
    !props.isInteractive ||
    !props.showCurrentLocation
  ) {
    return;
  }

  recenterControl = createRecenterControl();
  map.addControl(recenterControl, 'top-right');
};

/**
 * @description 現在地マーカーを描画または更新する
 * @returns {void}
 */
const renderCurrentLocationMarker = () => {
  ensureRecenterControl();

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
    return;
  }

  // 位置のみ更新
  currentLocationMarker.setLngLat(lngLat);
};

/**
 * @description 長押しで立てる赤いピンのDOM要素を作成する。
 * スポット（青い丸）や開始地点（緑の丸）と見分けられるよう、しずく型の赤いピンにする。
 * @returns {HTMLElement} ピンとして使う要素
 */
const createPinElement = () => {
  // 外枠はMapLibreが位置決めに使うため素のままにし、回転は内側の要素で行う
  // （MapLibreが外枠へ付けるtransformと回転が競合するのを避ける）
  const container = document.createElement('div');
  container.className = 'location-pin';

  const head = document.createElement('div');
  head.className = 'location-pin-head';
  container.appendChild(head);

  return container;
};

/**
 * @description 長押しで立てる赤いピンを描き直す。
 * 座標が無い場合はピンを消す。
 * @returns {void}
 */
const renderPinMarker = () => {
  if (props.pinPosition === null) {
    pinMarker?.remove();
    pinMarker = null;
    return;
  }

  const lngLat = [props.pinPosition.lng, props.pinPosition.lat];

  if (pinMarker === null) {
    // ピンの先端が座標を指すよう、下端を基準にする
    pinMarker = new Marker({ element: createPinElement(), anchor: 'bottom' })
      .setLngLat(lngLat)
      .addTo(map);
  } else {
    pinMarker.setLngLat(lngLat);
  }

  // 立てたピンが、見えている地図範囲の中央に来るように寄せる。
  // offsetは地図中央からのずれ（上部バナー・下部フォームの分だけ親が指定する）
  map.easeTo({ center: lngLat, offset: [0, props.pinOffsetY] });
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

  // 現在地へ戻るときに初期表示と同じ倍率へ復元できるよう、この時点の倍率を覚えておく。
  // animate: false のため、ここでは寄せ終わった後の値が取れる
  initialZoomLevel = map.getZoom();
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

  if (props.isLongPressEnabled) {
    attachLongPress(map);
  }

  // スタイルの読み込み完了前はソースを追加できないため、loadを待つ
  map.on('load', () => {
    renderRouteLine();
    renderOriginMarker();
    renderSpotMarkers();
    renderCurrentLocationMarker();
    renderPinMarker();
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
    renderOriginMarker();
    renderSpotMarkers();
    fitToRoute();
  }
);

// 現在地が更新されたらマーカーを更新する
watch(
  () => [props.currentLocation, props.showCurrentLocation],
  () => {
    if (map === null || !map.isStyleLoaded()) {
      return;
    }

    renderCurrentLocationMarker();
  },
  { deep: true }
);

// 長押しのピンが更新されたら描き直す
watch(
  () => props.pinPosition,
  () => {
    if (map === null || !map.isStyleLoaded()) {
      return;
    }

    renderPinMarker();
  },
  { deep: true }
);

onBeforeUnmount(() => {
  markers.forEach((marker) => marker.remove());
  markers = [];
  originMarker?.remove();
  originMarker = null;
  if (currentLocationMarker !== null) {
    currentLocationMarker.remove();
    currentLocationMarker = null;
  }
  pinMarker?.remove();
  pinMarker = null;
  // コントロールは map.remove() で破棄されるため、参照だけ落とす
  recenterControl = null;
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

/*
 * 右端は地図の帰属表示（iマーク）を覆わないよう空けておく。
 * 帰属表示は利用規約上、隠してはいけない。
 */
.route-map-notice {
  position: absolute;
  bottom: 12px;
  left: 12px;
  right: 52px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--white);
  box-shadow: var(--shadow);
  font-size: 12px;
  color: var(--text-gray);
  text-align: center;
}
</style>
