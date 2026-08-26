<script setup>
import BaseSlider from '@/components/base/BaseSlider.vue';
import {
  CATEGORY_OPTIONS,
  DISTANCE_OPTIONS_KM,
  PURPOSE_OPTIONS
} from '@/constants/routeConditions';

/**
 * @description ルート作成条件（目的・カテゴリ・距離）の入力フォーム。
 * 表示と入力のみを担当し、値の保持はストア側で行う。
 */
defineProps({
  /** 選択中の目的 */
  purpose: {
    type: String,
    default: null
  },
  /** 選択中のカテゴリ */
  category: {
    type: String,
    default: null
  },
  /** 選択中の距離（km） */
  distance: {
    type: Number,
    required: true
  }
});

defineEmits(['selectPurpose', 'selectCategory', 'selectDistance']);
</script>

<template>
  <div>
    <div class="input-section">
      <h3>目的</h3>
      <div class="button-grid">
        <button
          v-for="option in PURPOSE_OPTIONS"
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
      <h3>カテゴリ</h3>
      <div class="button-grid">
        <button
          v-for="option in CATEGORY_OPTIONS"
          :key="option.value"
          class="select-btn"
          :class="{ selected: category === option.value }"
          type="button"
          :aria-pressed="category === option.value"
          @click="$emit('selectCategory', option.value)"
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
        :model-value="distance"
        :options="DISTANCE_OPTIONS_KM"
        unit="km"
        labelled-by="distance-label"
        @update:model-value="$emit('selectDistance', $event)"
      />
      <p class="hint">
        選択肢: 1 km / 3 km / 5 km / 8 km
      </p>
    </div>
  </div>
</template>
