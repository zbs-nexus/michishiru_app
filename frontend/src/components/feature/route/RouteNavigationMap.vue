<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import RouteMap from '@/components/feature/route/RouteMap.vue';
import { useLocationTracking } from '@/composables/useLocationTracking';

/**
 * @description 案内中の経路を画面いっぱいの地図に表示する。
 * リアルタイムで現在地を追跡し、Google Maps風のマーカーで表示する。
 * watchPosition を使用し、位置が変わるたびに自動で更新される。
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
  }
});

const {
  currentLocation,
  heading,
  accuracy,
  isTracking,
  trackingError,
  startTracking,
  stopTracking
} = useLocationTracking();

onMounted(() => {
  startTracking();
});

onBeforeUnmount(() => {
  stopTracking();
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
        :current-heading="heading"
        :current-accuracy="accuracy"
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
