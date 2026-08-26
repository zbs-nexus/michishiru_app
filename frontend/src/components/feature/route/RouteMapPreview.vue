<script setup>
/**
 * @description 提案ルートの概略を地図風に表示する。
 * 実地図は未導入のため、経由地の並び順から表示位置を割り当てる。
 */
defineProps({
  /** 表示する経由地の一覧 */
  waypoints: {
    type: Array,
    required: true
  }
});

/** 経由地の表示位置（実地図導入までの暫定配置） */
const WAYPOINT_POSITIONS = [
  { top: '20%', left: '25%' },
  { top: '15%', left: '70%' },
  { top: '45%', left: '80%' },
  { top: '70%', left: '50%' }
];

/**
 * @description 並び順に対応する表示位置を返す
 * @param {number} index 経由地の並び順
 * @returns {object} styleバインド用のオブジェクト
 */
const resolvePosition = (index) => WAYPOINT_POSITIONS[index % WAYPOINT_POSITIONS.length];
</script>

<template>
  <div class="map-preview">
    <div class="map-placeholder">
      <div class="route-line" />
      <div
        v-for="(waypoint, index) in waypoints"
        :key="waypoint.waypointId"
        class="waypoint-marker"
        :style="resolvePosition(index)"
      >
        <span class="waypoint-icon">{{ waypoint.icon }}</span>
        <span class="waypoint-name">{{ waypoint.name }}</span>
      </div>
      <div
        class="origin"
        :style="{ top: '85%', left: '30%' }"
      />
    </div>
  </div>
</template>
