<script setup>
/**
 * @description 決定したルートの経路を地図風に表示する。
 * 出発地から目的地までの経由地を、並び順に応じた位置へ配置する。
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
  { top: '80%', left: '20%' },
  { top: '55%', left: '45%' },
  { top: '35%', left: '60%' }
];

/** 目的地の表示位置 */
const DESTINATION_POSITION = { top: '15%', left: '75%' };

/**
 * @description 並び順に対応する表示位置を返す
 * @param {number} index 経由地の並び順
 * @returns {object} styleバインド用のオブジェクト
 */
const resolvePosition = (index) => WAYPOINT_POSITIONS[index % WAYPOINT_POSITIONS.length];
</script>

<template>
  <div class="map-display">
    <div class="map-placeholder large">
      <div class="route-line detailed" />
      <div
        v-for="(waypoint, index) in waypoints.slice(0, WAYPOINT_POSITIONS.length)"
        :key="waypoint.waypointId"
        class="waypoint"
        :style="resolvePosition(index)"
      />
      <div
        class="destination"
        :style="DESTINATION_POSITION"
      >
        📍
      </div>
    </div>
  </div>
</template>
