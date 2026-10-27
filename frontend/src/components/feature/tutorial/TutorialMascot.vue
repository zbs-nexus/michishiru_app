<script setup>
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';
import { DEFAULT_MASCOT_LEVEL } from '@/constants/mascotLevels';

/**
 * @description チュートリアル中に、画面の下部へ固定して案内役（マスコット）に
 * 今のステップの文言を話させる吹き出し。1画面に1体だけ置く。
 *
 * 既存の MascotSpeechBubble を流用し、置き場所（下部固定・前面）だけをこの部品が担う。
 * ハイライトした要素より手前に出すが、操作の邪魔をしないよう画面の最下部に寄せる。
 */
defineProps({
  /** 案内役が話す文言 */
  message: {
    type: String,
    required: true
  },
  /** マスコットのレベル。チュートリアルでは既定のレベルで出す */
  level: {
    type: Number,
    default: DEFAULT_MASCOT_LEVEL
  }
});
</script>

<template>
  <div class="tutorial-mascot">
    <MascotSpeechBubble
      :message="message"
      :level="level"
      placement="side"
      size="small"
    />
  </div>
</template>

<style scoped>
/*
 * 画面の下部中央に固定する。
 * ハイライトした要素（z-index 60）より手前に出して、案内を常に読めるようにする。
 * 幅は画面に合わせ、左右に余白を取る。
 */
.tutorial-mascot {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 70;
  width: calc(100% - 24px);
  max-width: 406px;
  padding: 10px 12px;
  border: var(--pixel-frame-width) solid var(--border-ink);
  border-image: var(--pixel-frame-ink);
  background: var(--surface);
  background-clip: padding-box;
  box-shadow: var(--shadow);
  pointer-events: none;
}
</style>
