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
/*
 * 地図の高さは固定せず、枠（.map-preview）の高さいっぱいに広げる。
 * 枠の高さは置き場所の画面が決める（提案画面では、紹介文とボタンを除いた残り）。
 * 低い端末で固定の高さのままだと、画面がスクロールしてボタンが隠れるため。
 */
.map-frame {
  height: 100%;
}
</style>
