<script setup>
import RouteMap from '@/components/feature/route/RouteMap.vue';

/**
 * @description 提案ルートの全体像を地図上に表示する。
 * 確認用の概略表示のため、地図の操作は受け付けない。
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
  <div class="map-preview">
    <div class="map-frame">
      <RouteMap
        :geometry="geometry"
        :spots="spots"
        :is-interactive="false"
      />
    </div>
  </div>
</template>

<style scoped>
.map-frame {
  height: 280px;
}
</style>
