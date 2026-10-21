<script setup>
import { computed } from 'vue';
import BaseSlider from '@/components/base/BaseSlider.vue';

/**
 * @description ルート作成条件（ジャンル・距離）の入力フォーム。
 * 選択肢は親から受け取り、表示と入力のみを担当する。
 * 値の保持はストア側で行う。
 */
const props = defineProps({
  /** 選択中のジャンル */
  genre: {
    type: String,
    default: null
  },
  /** 選択中の距離（km） */
  distanceKm: {
    type: Number,
    required: true
  },
  /** ジャンルのおまかせ機能が有効か */
  isGenreRandom: {
    type: Boolean,
    required: true
  },
  /** 距離のおまかせ機能が有効か */
  isDistanceRandom: {
    type: Boolean,
    required: true
  },
  /** ジャンルの選択肢 */
  genreOptions: {
    type: Array,
    required: true
  },
  /** 距離の選択範囲 */
  distanceRange: {
    type: Object,
    required: true
  }
});

defineEmits(['selectGenre', 'selectDistance', 'toggleGenreRandom', 'toggleDistanceRandom']);

/** 距離スライダーの目盛り。下限と上限のラベルを表示する */
const distanceScaleLabels = computed(() => [
  props.distanceRange.minLabel,
  props.distanceRange.maxLabel
]);
</script>

<template>
  <div>
    <div class="input-section">
      <div class="section-header">
        <h3>ジャンル</h3>
        <button
          class="random-icon-btn"
          :class="{ selected: isGenreRandom }"
          type="button"
          :aria-pressed="isGenreRandom"
          aria-label="ジャンルをおまかせで選ぶ"
          @click="$emit('toggleGenreRandom')"
        >
          ？
        </button>
      </div>
      <div
        v-if="!isGenreRandom"
        class="button-grid"
      >
        <button
          v-for="option in genreOptions"
          :key="option.value"
          class="select-btn"
          :class="{ selected: genre === option.value }"
          type="button"
          :aria-pressed="genre === option.value"
          @click="$emit('selectGenre', option.value)"
        >
          <span class="btn-icon">{{ option.icon }}</span>
          <span>{{ option.label }}</span>
        </button>
      </div>
      <p
        v-else
        class="hint random-message"
      >
        おまかせでジャンルを選択します
      </p>
    </div>

    <div class="input-section">
      <div class="section-header">
        <h3 id="distance-label">
          距離
        </h3>
        <button
          class="random-icon-btn"
          :class="{ selected: isDistanceRandom }"
          type="button"
          :aria-pressed="isDistanceRandom"
          aria-label="距離をおまかせで選ぶ"
          @click="$emit('toggleDistanceRandom')"
        >
          ？
        </button>
      </div>
      <template v-if="!isDistanceRandom">
        <BaseSlider
          :model-value="distanceKm"
          :min-value="distanceRange.minKm"
          :max-value="distanceRange.maxKm"
          :scale-labels="distanceScaleLabels"
          unit="km"
          labelled-by="distance-label"
          @update:model-value="$emit('selectDistance', $event)"
        />
        <p class="hint">
          {{ distanceRange.minLabel }} 〜 {{ distanceRange.maxLabel }} の範囲で選べます
        </p>
      </template>
      <p
        v-else
        class="hint random-message"
      >
        おまかせで距離を選択します
      </p>
    </div>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 12px;
}

/* 見出しの下余白は .section-header が持つため、横並びの中央揃えを崩さないよう消す */
.section-header h3 {
  margin-bottom: 0;
}

/* おまかせの札。選ぶと紫のインクで塗られる */
.random-icon-btn {
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--border-gold);
  border-radius: 50%;
  background-color: var(--surface);
  color: var(--text-gray);
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.random-icon-btn:hover {
  border-color: var(--accent-gold);
  background-color: var(--bg-deep);
}

.random-icon-btn.selected {
  border-color: var(--accent-gold);
  background-color: var(--primary-color);
  color: var(--white);
}

.random-message {
  color: var(--primary-color);
  font-weight: bold;
}
</style>
