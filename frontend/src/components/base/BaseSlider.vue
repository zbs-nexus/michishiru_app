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
  /** 選択できる値の上限（スライダーの可動域・目盛りの上限） */
  maxValue: {
    type: Number,
    required: true
  },
  /**
   * 選べる値の頭打ち（km等）。目盛りや可動域（maxValue）は変えずに、
   * 実際に選べる値だけをこの値で止めたいときに渡す。
   * ドラッグし続けてもこれを超える値は発行せず、つまみもここで止まる。null のときは頭打ちしない。
   * チュートリアルで上限10kmのまま5kmまでしか選ばせない用途で使う。
   */
  valueMaxValue: {
    type: Number,
    default: null
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

/**
 * @description 値を頭打ち（valueMaxValue）で抑える。
 * 頭打ちが指定されていない場合はそのまま返す。
 * @param {number} value 抑える前の値
 * @returns {number} 頭打ち後の値
 */
const clampValue = (value) => {
  if (props.valueMaxValue !== null && value > props.valueMaxValue) {
    return props.valueMaxValue;
  }

  return value;
};

/**
 * つまみと目盛りに反映する表示値。頭打ちを効かせた値にする。
 * 親から渡る modelValue が頭打ちを超えていても、つまみは頭打ちの位置で止まる。
 */
const displayValue = computed(() => clampValue(props.modelValue));

/** 読み上げ用の文字列 */
const valueText = computed(() => `${displayValue.value} ${props.unit}`.trim());

/**
 * @description 入力された値を頭打ちで抑えてから親へ通知する。
 *
 * range入力はドラッグ中もinputを発行するため、ここで頭打ちを超える値を切り落とす。
 * ネイティブのつまみはドラッグ中に内部状態で動き、modelValueの再束縛だけでは
 * 頭打ちの位置へ戻りきらない端末があるため、input要素のvalueも頭打ちの値へ書き戻して
 * つまみそのものを押し戻す。
 * @param {Event} event inputイベント
 * @returns {void}
 */
const handleInput = (event) => {
  const clamped = clampValue(Number(event.target.value));

  // つまみを頭打ちの位置へ戻す（ドラッグし続けても超えて見えないようにする）
  if (Number(event.target.value) !== clamped) {
    event.target.value = String(clamped);
  }

  emit('update:modelValue', clamped);
};
</script>

<template>
  <div class="slider-wrapper">
    <output class="distance-value">
      {{ displayValue }}<small v-if="unit">{{ unit }}</small>
    </output>
    <input
      class="distance-slider"
      type="range"
      :min="minValue"
      :max="maxValue"
      :step="stepValue"
      :value="displayValue"
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
