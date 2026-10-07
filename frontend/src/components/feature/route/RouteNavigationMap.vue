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
  /** 長押しで立てる赤いピンの座標 { lng, lat }。未設定の場合はnull */
  pinPosition: {
    type: Object,
    default: null
  },
  /** ピンを中央へ寄せるときの、地図中央からの縦のずれ（ピクセル）。下方向が正 */
  pinOffsetY: {
    type: Number,
    default: 0
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
  }
});

defineEmits(['longPressMap', 'selectMyReview']);
</script>

<template>
  <div class="navigation-map">
    <div class="map-full">
      <RouteMap
        :geometry="geometry"
        :spots="spots"
        :show-current-location="isTracking"
        :current-location="currentLocation"
        :current-accuracy="currentAccuracy"
        :is-long-press-enabled="isLongPressEnabled"
        :pin-position="pinPosition"
        :pin-offset-y="pinOffsetY"
        :my-review-spots="myReviewSpots"
        :show-my-reviews="showMyReviews"
        @long-press-map="$emit('longPressMap', $event)"
        @select-my-review="$emit('selectMyReview', $event)"
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
 * ズームボタンが次の目的地バナー（top: 12px、高さ約60px）の下に隠れて
 * 押せなくなるため、この画面だけコントロールを下へ寄せる。
 */
.navigation-map :deep(.maplibregl-ctrl-top-right) {
  margin-top: 84px;
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
