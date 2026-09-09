<script setup>
/**
 * @description 散歩結果の集計値を表示する。
 */
defineProps({
  /** 総距離（km） */
  distanceKm: {
    type: Number,
    required: true
  },
  /** 巡ったスポットの数 */
  spotCount: {
    type: Number,
    required: true
  },
  /** 所要時間（分） */
  durationMinutes: {
    type: Number,
    required: true
  }
});
</script>

<template>
  <div class="result-stats">
    <div class="stat-item">
      <span class="stat-label">総距離</span>
      <span class="stat-value">{{ distanceKm.toFixed(1) }} km</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">巡ったスポット</span>
      <span class="stat-value">{{ spotCount }} 箇所</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">所要時間</span>
      <span class="stat-value">{{ durationMinutes }} 分</span>
    </div>
  </div>
</template>
