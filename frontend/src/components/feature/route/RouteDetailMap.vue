<script setup>
import RouteMap from '@/components/feature/route/RouteMap.vue';

/**
 * @description 決定したルートの経路を地図上に表示する。
 * 出発地から目的地までを確認できるよう、地図の操作を許可する。
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
</script>

<template>
  <div class="map-display">
    <div class="map-frame">
      <RouteMap
        :geometry="geometry"
        :spots="spots"
      />
    </div>
  </div>
</template>

<style scoped>
.map-frame {
  height: 380px;
}
</style>
