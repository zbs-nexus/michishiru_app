<script setup>
/**
 * @description プロジェクト共通のボタン部品。
 * 見た目の種別のみを受け取り、動作は親がclickイベントで受け取る。
 */
defineProps({
  /** 見た目の種別 */
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary'].includes(value)
  },
  /** 画面下部に固定表示するかどうか */
  isFullWidth: {
    type: Boolean,
    default: false
  },
  /** 操作を無効にするかどうか */
  isDisabled: {
    type: Boolean,
    default: false
  }
});

defineEmits(['click']);
</script>

<template>
  <button
    :class="[
      variant === 'primary' ? 'primary-btn' : 'secondary-btn',
      { 'full-width': isFullWidth }
    ]"
    :disabled="isDisabled"
    type="button"
    @click="$emit('click')"
  >
    <slot />
  </button>
</template>
