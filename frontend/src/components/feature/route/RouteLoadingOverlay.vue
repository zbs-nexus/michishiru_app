<script setup>
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';
import { DEFAULT_MASCOT_LEVEL } from '@/constants/mascotLevels';

/**
 * @description ルート作成中に表示する待機画面。
 * 進行状況の判定は行わず、表示のみを担当する。
 * 待っている間の案内はマスコットが吹き出しで話す。
 *
 * レベルと経験値バーは親から受け取る（この部品は実績を取得しない）。
 * どちらも省略できるため、デザイン確認用の画面からは引数なしで呼べる。
 */
defineProps({
  /** マスコットのレベル。実績を取得できていない場合は既定（Lv.1）のまま */
  mascotLevel: {
    type: Number,
    default: DEFAULT_MASCOT_LEVEL
  }
});
</script>

<template>
  <div class="screen is-loading">
    <!-- 他の画面と同じ古地図の地 -->
    <div
      class="paper-map-bg"
      aria-hidden="true"
    />
    <div class="loading-content">
      <h2>ミチシル</h2>

      <MascotSpeechBubble
        :level="mascotLevel"
        placement="stacked"
        size="large"
      >
        <h3 class="loading-text">
          ルートを作成中...
        </h3>
        <p class="loading-subtext">
          あなたにぴったりの<br>お散歩ルートを考えています
        </p>

        <!-- 経験値バーは親が渡したときだけマスコットの下に出る -->
        <template #experience>
          <slot name="experience" />
        </template>
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
