<script setup>
import { computed } from 'vue';
import { DEFAULT_MASCOT_LEVEL, getMascotLevel } from '@/constants/mascotLevels';

/**
 * @description マスコット（案内役のフクロウ）の姿を表示する。
 * レベルから画像と名前を引くだけを担い、何を話すかは持たない。
 * 吹き出しと組み合わせる場合は MascotSpeechBubble を使う。
 */
const props = defineProps({
  /** マスコットのレベル。画像が未用意のレベルは用意済みの姿で代替する */
  level: {
    type: Number,
    default: DEFAULT_MASCOT_LEVEL
  },
  /** 表示サイズ */
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  /** `Lv.1 ミチのタマゴ` の表示を添えるかどうか */
  hasLevelLabel: {
    type: Boolean,
    default: false
  },
  /**
   * 装飾として置くかどうか。
   * 読み上げ範囲（role="status" など）の中に置く場合に真にして、
   * 本文が読み直されるたびに画像の説明が繰り返されるのを防ぐ。
   */
  isDecorative: {
    type: Boolean,
    default: false
  }
});

/** 表示するマスコットの定義（レベル・名前・画像） */
const mascot = computed(() => getMascotLevel(props.level));

/** レベルと名前を並べた表示名 */
const mascotLabel = computed(
  () => `Lv.${mascot.value.level} ${mascot.value.mascotName}`
);
</script>

<template>
  <div
    class="mascot-avatar"
    :class="`is-${size}`"
  >
    <span
      class="mascot-halo"
      aria-hidden="true"
    />
    <img
      class="mascot-image"
      :src="mascot.mascotImage"
      :alt="isDecorative ? '' : mascotLabel"
      :aria-hidden="isDecorative ? 'true' : undefined"
    >
    <span
      v-if="hasLevelLabel"
      class="mascot-level-label"
    >{{ mascotLabel }}</span>
  </div>
</template>

<style scoped>
/*
 * 画像の幅はサイズごとに --mascot-width で切り替える。
 * 画像は縦長（5:6）なので高さは自動にして比率を保つ。
 */
.mascot-avatar {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
}

.mascot-avatar.is-small {
  --mascot-width: 44px;
}

.mascot-avatar.is-medium {
  --mascot-width: 76px;
}

.mascot-avatar.is-large {
  --mascot-width: 128px;
}

.mascot-image {
  display: block;
  width: var(--mascot-width);
  height: auto;
  /* ふわりと浮いて見せる。地面の影は画像側に描いてある */
  animation: mascot-float 4.5s ease-in-out infinite;
}

/*
 * 背後のやわらかい光。ファンタジーの雰囲気づけなので
 * 画像より下に敷き、支援技術からは隠す。
 */
.mascot-halo {
  position: absolute;
  top: 50%;
  left: 50%;
  width: calc(var(--mascot-width) * 1.5);
  height: calc(var(--mascot-width) * 1.5);
  transform: translate(-50%, -50%);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(232, 200, 106, 0.38) 0%,
    rgba(232, 200, 106, 0.14) 45%,
    rgba(232, 200, 106, 0) 70%
  );
  animation: mascot-halo-breathe 4.5s ease-in-out infinite;
  pointer-events: none;
}

.mascot-level-label {
  position: relative;
  padding: 2px 10px;
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--primary-color);
  background: var(--surface);
  border: 1px solid var(--border-gold);
  border-radius: 999px;
  white-space: nowrap;
}

@keyframes mascot-float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-5px);
  }
}

@keyframes mascot-halo-breathe {
  0%,
  100% {
    opacity: 0.75;
    transform: translate(-50%, -50%) scale(0.94);
  }

  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.04);
  }
}

/* 動きを減らす設定の場合はアニメーションを無効にする */
@media (prefers-reduced-motion: reduce) {
  .mascot-image,
  .mascot-halo {
    animation: none;
  }
}
</style>
