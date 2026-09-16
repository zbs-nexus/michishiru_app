<script setup>
import RouteMap from '@/components/feature/route/RouteMap.vue';

/**
 * @description 案内中の経路を画面いっぱいの地図に表示する。
 * 現在地の追従は未導入のため、ルート全体を収めた状態で表示する。
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
  <div class="navigation-map">
    <div class="map-full">
      <RouteMap
        :geometry="geometry"
        :spots="spots"
      />
    </div>
  </div>
</template>
