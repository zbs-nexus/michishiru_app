<script setup>
/**
 * @description 案内中の経路と現在地を地図風に表示する。
 * 位置情報は未導入のため、現在地と進行方向は固定表示となる。
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
  { top: '15%', left: '30%' },
  { top: '40%', left: '20%' },
  { top: '55%', left: '75%' }
];

/**
 * @description 並び順に対応する表示位置を返す
 * @param {number} index 経由地の並び順
 * @returns {object} styleバインド用のオブジェクト
 */
const resolvePosition = (index) => WAYPOINT_POSITIONS[index % WAYPOINT_POSITIONS.length];
</script>

<template>
  <div class="navigation-map">
    <div class="map-full">
      <div class="current-location" />
      <div class="nav-route" />
      <div
        v-for="(waypoint, index) in waypoints.slice(0, WAYPOINT_POSITIONS.length)"
        :key="waypoint.waypointId"
        class="nav-waypoint"
        :style="resolvePosition(index)"
      >
        <span
          class="nav-icon"
          :class="waypoint.type"
        >{{ waypoint.icon }}</span>
        <span>{{ waypoint.name }}</span>
      </div>
      <div class="turn-indicator">
        <span class="turn-icon">↱</span>
      </div>
    </div>
  </div>
</template>
