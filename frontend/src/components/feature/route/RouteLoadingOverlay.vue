<script setup>
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';

/**
 * @description ルート作成中に表示する待機画面。
 * 進行状況の判定は行わず、表示のみを担当する。
 * 待っている間の案内はマスコットが吹き出しで話す。
 */
</script>

<template>
  <div class="screen is-loading">
    <div
      class="loading-bg"
      aria-hidden="true"
    />
    <div class="loading-content">
      <h2>ミチシル</h2>

      <MascotSpeechBubble
        placement="stacked"
        size="large"
      >
        <h3 class="loading-text">
          ルートを作成中...
        </h3>
        <p class="loading-subtext">
          あなたにぴったりの<br>お散歩ルートを考えています
        </p>
      </MascotSpeechBubble>

      <div
        class="loading-dots"
        aria-hidden="true"
      >
        <span /><span /><span /><span /><span />
      </div>
    </div>
  </div>
</template>
