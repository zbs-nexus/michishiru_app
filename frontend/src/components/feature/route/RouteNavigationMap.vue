<script setup>
import RouteMap from '@/components/feature/route/RouteMap.vue';

/**
 * @description 案内中の経路を画面いっぱいの地図に表示する。
 * 現在地の追跡は親（View）が行い、ここでは受け取った値を地図へ渡すだけにする。
 * 同じ追跡状態をバナーと共有するため、watchPositionを二重に開始しない。
 */
defineProps({
  /** 経路の形（GeoJSONのLineString）。未取得の場合はnull */
  geometry: {
    type: Object,
    default: null
  },
  /** 表示する立ち寄り先の一覧 */
  spots: {
    type: Array,
    required: true
  },
  /** 現在地の座標 { lng, lat } */
  currentLocation: {
    type: Object,
    default: null
  },

  /** 位置情報の精度（メートル）。取得できない場合はnull */
  currentAccuracy: {
    type: Number,
    default: null
  },
  /** 現在地を追跡中かどうか */
  isTracking: {
    type: Boolean,
    default: false
  },
  /** 位置情報の取得に失敗した場合のメッセージ */
  trackingError: {
    type: String,
    default: null
  },
  /** 口コミ投稿のために地図の長押しを受け付けるかどうか */
  isLongPressEnabled: {
    type: Boolean,
    default: false
  },
  /** 地図の操作（ドラッグ・ズーム）を許可するかどうか。チュートリアル中は止める */
  isInteractive: {
    type: Boolean,
    default: true
  },
  /** 新規で口コミを投稿する場所に立てる赤いピンの座標 { lng, lat }。未設定の場合はnull */
  pinPosition: {
    type: Object,
    default: null
  },
  /** 見えている地図範囲の中央へ寄せる座標 { lng, lat }。未設定の場合はnull */
  focusPosition: {
    type: Object,
    default: null
  },
  /** 寄せるときの、地図中央からの縦のずれ（ピクセル）。下方向が正 */
  focusOffsetY: {
    type: Number,
    default: 0
  },
  /**
   * 拡大率を変えずにスムーズに見えている範囲の中央へ寄せる座標 { lng, lat }。未設定はnull。
   * チュートリアルで紫ピンへ案内するために使う
   */
  smoothCenterPosition: {
    type: Object,
    default: null
  },
  /** 自分が投稿した口コミの場所の一覧 */
  myReviewSpots: {
    type: Array,
    default: () => []
  },
  /** 自分の口コミのオレンジピンを表示するかどうか */
  showMyReviews: {
    type: Boolean,
    default: false
  },
  /** 他の人が投稿した口コミの場所の一覧 */
  otherReviewSpots: {
    type: Array,
    default: () => []
  },
  /** 他の人の口コミの紫ピンを表示するかどうか */
  showOtherReviews: {
    type: Boolean,
    default: false
  },
  /** 到達済みのスポットID。地図のマーカーをスタンプ表示にする */
  visitedSpotIds: {
    type: Array,
    default: () => []
  },
  /** 選択中の口コミの場所のID。該当するピンを大きく前面に出す */
  selectedReviewSpotId: {
    type: String,
    default: null
  },
  /** 区間の描き分け（歩き終えた・今・これからの区間）。null の場合は経路を1色で描く */
  legSections: {
    type: Object,
    default: null
  },
  /**
   * 地図のコントロール（現在地へ戻るボタン）を置く上端（ピクセル）。
   * 画面上部のバナー・前後のボタン・口コミの表示切り替えの下へ逃がす。
   * バナーは目的地の名前の長さで伸びるため、親が測って渡す
   */
  controlsTopPx: {
    type: Number,
    default: 124
  },
  /**
   * 地図の上端から、画面上部の操作で隠れている高さ（ピクセル）。
   * 案内開始時のスタート地点と、現在地へ戻るときの現在地を、見えている範囲の中央へ寄せるために使う
   */
  topInsetPx: {
    type: Number,
    default: 0
  },
  /** 地図の下端から、終了ボタンで隠れている高さ（ピクセル）。使い方は topInsetPx と同じ */
  bottomInsetPx: {
    type: Number,
    default: 0
  }
});

defineEmits(['longPressMap', 'selectReviewSpot']);
</script>

<template>
  <div
    class="navigation-map"
    :style="{ '--map-controls-top': `${controlsTopPx}px` }"
  >
    <div class="map-full">
      <RouteMap
        :geometry="geometry"
        :spots="spots"
        :is-interactive="isInteractive"
        :show-current-location="isTracking"
        :current-location="currentLocation"
        :current-accuracy="currentAccuracy"
        :is-long-press-enabled="isLongPressEnabled"
        :pin-position="pinPosition"
        :focus-position="focusPosition"
        :focus-offset-y="focusOffsetY"
        :smooth-center-position="smoothCenterPosition"
        :my-review-spots="myReviewSpots"
        :show-my-reviews="showMyReviews"
        :other-review-spots="otherReviewSpots"
        :show-other-reviews="showOtherReviews"
        :visited-spot-ids="visitedSpotIds"
        :selected-review-spot-id="selectedReviewSpotId"
        :leg-sections="legSections"
        :top-inset-px="topInsetPx"
        :bottom-inset-px="bottomInsetPx"
        should-center-on-origin
        @long-press-map="$emit('longPressMap', $event)"
        @select-review-spot="$emit('selectReviewSpot', $event)"
      />
    </div>
    <div
      v-if="trackingError"
      class="tracking-error"
      role="alert"
    >
      {{ trackingError }}
    </div>
  </div>
</template>

<style scoped>
.navigation-map {
  position: relative;
  width: 100%;
  height: 100%;
}

.map-full {
  width: 100%;
  height: 100%;
}

/*
 * 現在地へ戻るボタンが、次の目的地バナー・「次の目的地へ」ボタン・その下の
 * 口コミの表示切り替え（右寄せ）に隠れて押せなくなるため、この画面だけコントロールを下へ寄せる。
 * バナーは目的地の名前の長さで伸びるため、位置は親が測った値（controlsTopPx）に従う。
 */
.navigation-map :deep(.maplibregl-ctrl-top-right) {
  margin-top: var(--map-controls-top);
}

/*
 * MapLibre はコントロールに既定で margin: 10px 10px 0 0 を付ける。
 * そのままだと、親が測った位置（口コミの札の下端＋余白）よりさらに 10px 下がり、
 * 札との間だけ他の段より広く空く。右も 10px のため、画面上部の段（右端から12px）より 2px はみ出す。
 * 上は 0 にして親の値だけで位置を決め、右は画面上部の段と同じ 12px に揃える。
 */
.navigation-map :deep(.maplibregl-ctrl-top-right .maplibregl-ctrl) {
  margin: 0 12px 0 0;
}

/*
 * 現在地へ戻るボタンの大きさを、前後のボタンの高さ（枠込み 32px）に揃える。
 * ライブラリの既定は 29px で、枠（--pixel-frame-width × 2）を足すと約39pxになり、
 * 上の操作より一回り大きく見えるため。中身は 32px − 枠 10px = 22px。
 */
.navigation-map :deep(.maplibregl-ctrl-group .recenter-btn) {
  width: 22px;
  height: 22px;
}

/* 中身が小さくなる分、アイコン（global.css の .recenter-btn::after）も 18px から 16px にする */
.navigation-map :deep(.recenter-btn::after) {
  width: 16px;
  height: 16px;
}

/*
 * 終了ボタン（bottom: 44px、高さ約51px）の上に置く。
 * ボタンの上端は約95pxなので、重ならない位置まで上げる。
 */
.tracking-error {
  position: absolute;
  bottom: 108px;
  left: 12px;
  right: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(234, 67, 53, 0.9);
  color: white;
  font-size: 12px;
  text-align: center;
}
</style>
