<script setup>
import { computed } from 'vue';

/**
 * @description 下限から上限までの範囲で1つの値を選ぶスライダー部品。
 * 範囲・目盛りは親から受け取り、選択された値はemitで返す。
 */
const props = defineProps({
  /** 選択中の値 */
  modelValue: {
    type: Number,
    required: true
  },
  /** 選択できる値の下限 */
  minValue: {
    type: Number,
    required: true
  },
  /** 選択できる値の上限 */
  maxValue: {
    type: Number,
    required: true
  },
  /** 値の刻み幅 */
  stepValue: {
    type: Number,
    default: 1
  },
  /** 値に添える単位 */
  unit: {
    type: String,
    default: ''
  },
  /** 目盛りとして表示するラベル */
  scaleLabels: {
    type: Array,
    default: () => []
  },
  /** 読み上げ用のラベルを持つ要素のid */
  labelledBy: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:modelValue']);

/** 読み上げ用の文字列 */
const valueText = computed(() => `${props.modelValue} ${props.unit}`.trim());

/**
 * @description 入力された値を数値へ変換して親へ通知する
 * @param {Event} event inputイベント
 * @returns {void}
 */
const handleInput = (event) => {
  emit('update:modelValue', Number(event.target.value));
};
</script>

<template>
  <div class="slider-wrapper">
    <output class="distance-value">
      {{ modelValue }}<small v-if="unit">{{ unit }}</small>
    </output>
    <input
      class="distance-slider"
      type="range"
      :min="minValue"
      :max="maxValue"
      :step="stepValue"
      :value="modelValue"
      :aria-labelledby="labelledBy"
      :aria-valuetext="valueText"
      @input="handleInput"
    >
    <div
      v-if="scaleLabels.length > 0"
      class="slider-scale"
      aria-hidden="true"
    >
      <span
        v-for="label in scaleLabels"
        :key="label"
      >{{ label }}</span>
    </div>
  </div>
</template>
