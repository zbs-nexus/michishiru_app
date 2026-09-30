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
  }
});
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

.tracking-error {
  position: absolute;
  bottom: 80px;
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
