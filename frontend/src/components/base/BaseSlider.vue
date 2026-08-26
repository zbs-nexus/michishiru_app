<script setup>
import { computed } from 'vue';

/**
 * @description 決まった選択肢から1つを選ぶスライダー部品。
 * スライダー自身は選択肢の並び順を扱い、実際の値は親へemitで返す。
 */
const props = defineProps({
  /** 選択中の値 */
  modelValue: {
    type: Number,
    required: true
  },
  /** 選択できる値の一覧 */
  options: {
    type: Array,
    required: true
  },
  /** 値に添える単位 */
  unit: {
    type: String,
    default: ''
  },
  /** 読み上げ用のラベルを持つ要素のid */
  labelledBy: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['update:modelValue']);

/** 選択中の値に対応するつまみ位置 */
const selectedIndex = computed(() => {
  const index = props.options.indexOf(props.modelValue);
  return index === -1 ? 0 : index;
});

/** 読み上げ用の文字列 */
const valueText = computed(() => `${props.modelValue} ${props.unit}`.trim());

/**
 * @description つまみ位置を値へ変換して親へ通知する
 * @param {Event} event inputイベント
 * @returns {void}
 */
const handleInput = (event) => {
  const index = Number.parseInt(event.target.value, 10);
  emit('update:modelValue', props.options[index]);
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
      min="0"
      :max="options.length - 1"
      step="1"
      :value="selectedIndex"
      :aria-labelledby="labelledBy"
      :aria-valuetext="valueText"
      @input="handleInput"
    >
    <div
      class="slider-scale"
      aria-hidden="true"
    >
      <span
        v-for="option in options"
        :key="option"
      >{{ option }}</span>
    </div>
  </div>
</template>
