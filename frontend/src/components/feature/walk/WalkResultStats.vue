<script setup>
/**
 * @description 散歩結果の集計値を表示する。
 */
defineProps({
  /** 総距離（km） */
  distance: {
    type: Number,
    required: true
  },
  /** 巡った経由地の数 */
  waypointCount: {
    type: Number,
    required: true
  },
  /** 所要時間（分） */
  duration: {
    type: Number,
    required: true
  }
});
</script>

<template>
  <div class="result-stats">
    <div class="stat-item">
      <span class="stat-label">総距離</span>
      <span class="stat-value">{{ distance }} km</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">巡ったスポット</span>
      <span class="stat-value">{{ waypointCount }} 箇所</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">所要時間</span>
      <span class="stat-value">{{ duration }} 分</span>
    </div>
  </div>
</template>
