<script setup>
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';

/**
 * @description ルートの名称・説明・所要時間を、マスコットが紹介する形で表示する。
 * 提案画面の「いま表示しているコメント」はこのルートの紹介文なので、
 * 案内役の吹き出しの中に置いている。
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
  durationMinutes: {
    type: Number,
    required: true
  }
});
</script>

<template>
  <MascotSpeechBubble
    placement="side"
    size="medium"
  >
    <h3 class="route-name">
      {{ routeName }}
    </h3>
    <p
      v-if="description"
      class="route-description"
    >
      {{ description }}
    </p>
    <p class="route-duration">
      約{{ durationMinutes }}分の道のり
    </p>
  </MascotSpeechBubble>
</template>

<style scoped>
.route-name {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.5;
  color: var(--primary-color);
  margin-bottom: 6px;
}

.route-description {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.8;
  color: var(--text-dark);
}

/* 所要時間は添え書きなので、説明より一段弱く見せる */
.route-duration {
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-gray);
}

.route-duration::before {
  content: '⏱';
  margin-right: 5px;
  color: var(--accent-gold);
}
</style>
