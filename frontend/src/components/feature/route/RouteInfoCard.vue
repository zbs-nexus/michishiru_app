<script setup>
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';

/**
 * @description ルートの名称・説明・所要時間を、マスコットが紹介する形で表示する。
 * 提案画面の「いま表示しているコメント」はこのルートの紹介文なので、
 * 案内役の吹き出しの中に置いている。
 */
defineProps({
  /** ルート名 */
  routeName: {
    type: String,
    required: true
  },
  /** ルートの説明 */
  description: {
    type: String,
    default: ''
  },
  /** 所要時間（分） */
  durationMinutes: {
    type: Number,
    required: true
  }
});
</script>

<template>
  <MascotSpeechBubble
    class="route-info-card"
    placement="side"
    size="medium"
  >
    <h3 class="route-name">
      {{ routeName }}
    </h3>
    <!--
      説明文はAIが生成するため長さが決まらない。
      置き場所の高さに収まらない分だけ、この中でスクロールさせる。
      キーボードでもスクロールできるよう tabindex を付ける。
    -->
    <p
      v-if="description"
      class="route-description"
      tabindex="0"
    >
      {{ description }}
    </p>
    <p class="route-duration">
      約{{ durationMinutes }}分の道のり
    </p>
  </MascotSpeechBubble>
</template>

<style scoped>
/*
 * 置き場所（提案画面）が高さを決めている場合に、吹き出しごと縮められるようにする。
 * 縮むのは説明文だけで、ルート名と所要時間は常に見せる。
 * 吹き出しの枠は MascotSpeechBubble が持つため、:deep で高さの上限と並べ方だけを足す。
 * 高さが決まっていない置き方では max-height: 100% は効かず、見た目は変わらない。
 */
.route-info-card {
  min-height: 0;
}

.route-info-card :deep(.speech-bubble) {
  display: flex;
  flex-direction: column;
  max-height: 100%;
}

/*
 * 横向きなど、極端に低い画面では縮めずに本来の高さで並べる。
 * 縮めるとルート名と所要時間だけで吹き出しの高さを超え、文字が枠からはみ出すため。
 * 収まらない分は、画面の本文（global.css の .content）の中でスクロールさせる。
 * 460px は、ルート名が3行になっても説明文の1行目まで吹き出しに入る高さから決めた。
 */
@media (max-height: 460px) {
  .route-info-card {
    min-height: auto;
  }
}

/* 文字と余白は画面の高さ（global.css の --fit）に合わせて詰める */
.route-name {
  font-family: var(--font-display);
  font-size: calc(15px + var(--fit) * 2);
  font-weight: 700;
  letter-spacing: 0.02em;
  line-height: 1.45;
  color: var(--primary-color);
  margin-bottom: calc(2px + var(--fit) * 4);
}

/*
 * 説明文。吹き出しの中で縮められる唯一の部分にする。
 * 行間は低い画面で詰める（13px の文字に対して 1.55〜1.8 倍）。
 */
.route-description {
  flex: 0 1 auto;
  min-height: 0;
  overflow-y: auto;
  font-size: 13px;
  font-weight: 500;
  line-height: calc(20px + var(--fit) * 3.4);
  color: var(--text-dark);
}

.route-description:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
  border-radius: 4px;
}

/* 所要時間は添え書きなので、説明より一段弱く見せる */
.route-duration {
  margin-top: calc(4px + var(--fit) * 4);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-gray);
}

.route-duration::before {
  content: '⏱';
  margin-right: 5px;
  color: var(--accent-gold);
}
</style>
