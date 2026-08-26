<script setup>
/**
 * @description 各画面の外枠を提供するレイアウト。
 * 画面全体の高さ確保と縦並びの配置のみを担当する。
 */
defineProps({
  /** 内側に余白付きのコンテンツ領域を設けるかどうか */
  hasContentPadding: {
    type: Boolean,
    default: true
  }
});
</script>

<template>
  <div class="screen">
    <slot name="background" />
    <div
      v-if="hasContentPadding"
      class="content"
    >
      <slot />
    </div>
    <slot v-else />
    <slot name="footer" />
  </div>
</template>
