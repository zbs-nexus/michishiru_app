<script setup>
/**
 * @description ルートの名称・説明・所要時間を表示するカード。
 */
defineProps({
  /** ルート名 */
  routeName: {
    type: String,
    required: true
  },
  /** ルートの説明 */
  description: {
    type: String,
    default: ''
  },
  /** 所要時間（分） */
  duration: {
    type: Number,
    required: true
  }
});
</script>

<template>
  <div class="route-info-card">
    <div class="route-icon">
      🚶
    </div>
    <div class="route-details">
      <h3>{{ routeName }}</h3>
      <p v-if="description">
        {{ description }}
      </p>
      <p class="duration">
        ⏱️ 約{{ duration }}分
      </p>
    </div>
  </div>
</template>
