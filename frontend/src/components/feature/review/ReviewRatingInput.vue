<script setup>
/**
 * @description 5段階の星評価を選ぶ入力部品。
 * 星を押すとその数が評価値になる（1〜5の整数）。
 * 選択中の値は親からmodelValueで受け取り、変更はupdate:modelValueで返す。
 */
defineProps({
  /** 選択中の評価（0は未選択） */
  modelValue: {
    type: Number,
    required: true
  }
});

const emit = defineEmits(['update:modelValue']);

/** 星の値の一覧（1〜5） */
const ratingValues = [1, 2, 3, 4, 5];

/**
 * @description 押された星の値を評価として親へ通知する
 * @param {number} value 押された星の値（1〜5）
 * @returns {void}
 */
const handleSelect = (value) => {
  emit('update:modelValue', value);
};
</script>

<template>
  <div
    class="rating-input"
    role="radiogroup"
    aria-label="5段階評価"
  >
    <button
      v-for="value in ratingValues"
      :key="value"
      class="rating-star"
      :class="{ 'is-filled': value <= modelValue }"
      type="button"
      role="radio"
      :aria-checked="value === modelValue"
      :aria-label="`星${value}つ`"
      @click="handleSelect(value)"
    >
      ★
    </button>
  </div>
</template>

<style scoped>
.rating-input {
  display: flex;
  gap: 4px;
}

.rating-star {
  padding: 2px;
  font-size: 32px;
  line-height: 1;
  color: #D8DEE4;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: color 0.15s, transform 0.1s;
}

.rating-star:hover {
  transform: scale(1.1);
}

.rating-star.is-filled {
  color: #F5B301;
}

.rating-star:focus-visible {
  outline: 2px solid var(--route-blue);
  outline-offset: 2px;
  border-radius: 6px;
}
</style>
