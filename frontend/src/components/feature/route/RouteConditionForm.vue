<script setup>
import { computed } from 'vue';
import BaseSlider from '@/components/base/BaseSlider.vue';

/**
 * @description ルート作成条件（目的・ジャンル・距離）の入力フォーム。
 * 選択肢は親から受け取り、表示と入力のみを担当する。
 * 値の保持はストア側で行う。
 */
const props = defineProps({
  /** 選択中の目的 */
  purpose: {
    type: String,
    default: null
  },
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
  /** 目的の選択肢 */
  purposeOptions: {
    type: Array,
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

defineEmits(['selectPurpose', 'selectGenre', 'selectDistance']);

/** 距離スライダーの目盛り。下限と上限のラベルを表示する */
const distanceScaleLabels = computed(() => [
  props.distanceRange.minLabel,
  props.distanceRange.maxLabel
]);
</script>

<template>
  <div>
    <div class="input-section">
      <h3>目的</h3>
      <div class="button-grid">
        <button
          v-for="option in purposeOptions"
          :key="option.value"
          class="select-btn"
          :class="{ selected: purpose === option.value }"
          type="button"
          :aria-pressed="purpose === option.value"
          @click="$emit('selectPurpose', option.value)"
        >
          <span class="btn-icon">{{ option.icon }}</span>
          <span>{{ option.label }}</span>
        </button>
      </div>
    </div>

    <div class="input-section">
      <h3>ジャンル</h3>
      <div class="button-grid">
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
    </div>

    <div class="input-section">
      <h3 id="distance-label">
        距離
      </h3>
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
    </div>
  </div>
</template>
