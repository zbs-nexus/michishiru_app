<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { getMascotLevel } from '@/constants/mascotLevels';

/**
 * @description マスコットのレベルアップを全画面で祝う演出。
 *
 * 結果画面の上に重ねて「レベルアップ！」を見せ、閉じると下の結果画面に戻る。
 * 複数レベル上がった場合は、経由レベルを1段ずつ順に見せる（例: Lv.4 → Lv.5）。
 * 各段はタップ（クリック）・キー操作で次へ進め、最後の段で閉じると `close` を emit する。
 * 時間では進めない。利用者が押すまで同じ段を見せ続ける（レベルアップをしっかり味わえるように）。
 *
 * 画像は1枚絵のため中割り（コマ送り）はできない。旧→新の切り替えは
 * 「フェードアウト → 光 → フェードイン」で見せる。
 * 色・書体は global.css の :root 変数を使い、この部品には直書きしない。
 */
const props = defineProps({
  /**
   * 順に見せるレベルの一覧（経由レベルを含む昇順。例: [4, 5]）。
   * 開始レベルの次から到達レベルまでが入る。空の場合は何も見せない。
   */
  levels: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['close']);

/** 今見せている段の位置（levels の添字） */
const currentStepIndex = ref(0);

/** 画像の差し替え（フェード→光→フェード）を再生中かどうか。段が変わるたびに起こす */
const isTransitioning = ref(false);

/** オーバーレイ本体。閉じたときにフォーカスを戻すため、開いたときにここへ移す */
const overlayRef = ref(null);

/** 演出を開く前にフォーカスがあった要素。閉じたら戻す */
let previouslyFocusedElement = null;

/** 今見せているレベルの定義（画像・名前）。未用意のレベルは代替の姿が返る */
const currentMascot = computed(() =>
  getMascotLevel(props.levels[currentStepIndex.value])
);

/** 今の段が最後かどうか */
const isLastStep = computed(
  () => currentStepIndex.value >= props.levels.length - 1
);

/**
 * @description 画像差し替えの演出（フェード→光→フェード）を一度再生する。
 * 段が切り替わるたびに呼ぶ。動きを減らす設定では CSS 側でフェード・光を止めるため、
 * 旗を立てても静的に切り替わって見える。
 * @returns {void}
 */
const playTransition = () => {
  isTransitioning.value = true;
  // 次の描画で旗を下ろし、CSS のトランジションを1回だけ走らせる
  nextTick(() => {
    isTransitioning.value = false;
  });
};

/**
 * @description 次の段へ進める。最後の段なら閉じる。
 * タップ・キー操作・自動送りの共通の入口。
 * @returns {void}
 */
const handleAdvance = () => {
  if (isLastStep.value) {
    emit('close');

    return;
  }

  currentStepIndex.value += 1;
};

/**
 * @description キー操作での送り／閉じ。
 * Enter / Space で次へ、Esc で閉じる（最後まで見なくても抜けられるように）。
 * @param {KeyboardEvent} event 押されたキー
 * @returns {void}
 */
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    emit('close');

    return;
  }

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handleAdvance();
  }
};

// 段が変わるたびに、画像の差し替え演出を起こす
watch(currentStepIndex, () => {
  playTransition();
});

onMounted(() => {
  // 閉じたときに元の位置へフォーカスを戻せるよう、今の位置を控える
  previouslyFocusedElement =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  // キーで操作できるよう、オーバーレイへフォーカスを移す
  overlayRef.value?.focus();
  playTransition();
});

onBeforeUnmount(() => {
  // 演出を開く前にフォーカスがあった要素へ戻す（支援技術の利用者が迷子にならないように）
  previouslyFocusedElement?.focus();
});
</script>

<template>
  <div
    ref="overlayRef"
    class="level-up-overlay"
    role="dialog"
    aria-modal="true"
    aria-labelledby="level-up-heading"
    tabindex="-1"
    @click="handleAdvance"
    @keydown="handleKeydown"
  >
    <!-- 後光。背後からあふれる光でレベルアップの高揚感を出す。装飾なので読み上げない -->
    <div
      class="level-up-glow"
      aria-hidden="true"
    />

    <!-- 紙吹雪。CSSだけで降らせる。装飾なので読み上げない -->
    <div
      class="level-up-confetti"
      aria-hidden="true"
    >
      <span
        v-for="index in 14"
        :key="index"
        class="confetti-piece"
      />
    </div>

    <div class="level-up-content">
      <h2
        id="level-up-heading"
        class="level-up-title"
      >
        レベルアップ！
      </h2>

      <!--
        マスコットの姿。1枚絵のため、段が変わるたびに
        フェードアウト → 光 → フェードインで差し替える（is-transitioning 中は隠れる）。
        MascotAvatar は float アニメーションを持ち演出と喧嘩するため、ここでは画像を直接出す。
      -->
      <div class="level-up-mascot">
        <span
          class="mascot-flash"
          :class="{ 'is-flashing': isTransitioning }"
          aria-hidden="true"
        />
        <img
          class="mascot-image"
          :class="{ 'is-transitioning': isTransitioning }"
          :src="currentMascot.mascotImage"
          :alt="`Lv.${currentMascot.level} ${currentMascot.mascotName}`"
        >
      </div>

      <p class="level-up-level">
        Lv.{{ currentMascot.level }}
      </p>
      <p class="level-up-name">
        {{ currentMascot.mascotName }}
      </p>

      <!-- タップでもキーでも進めることを伝える案内 -->
      <p class="level-up-hint">
        {{ isLastStep ? 'タップで閉じる' : 'タップで次へ' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/*
 * 全画面オーバーレイ。トースト（z-index 200）やポップアップ（100）より手前に出し、
 * レベルアップの間は他の操作に目が行かないようにする。
 * 地色は羊皮紙を濃くしたもの（--bg-deep）に紫のインクの膜を重ね、
 * 祝祭の場として他の画面と区別する。
 */
.level-up-overlay {
  position: fixed;
  inset: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 430px;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 38%, rgba(95, 76, 145, 0.35) 0%, rgba(69, 53, 107, 0.6) 60%, rgba(58, 46, 80, 0.82) 100%),
    var(--bg-deep);
  cursor: pointer;
  /* オーバーレイにフォーカスを移してもブラウザ既定の枠は出さない（装飾で代替する） */
  outline: none;
}

/* 後光。金の光が背後からゆっくり脈打つ */
.level-up-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  background: radial-gradient(
    circle,
    rgba(232, 200, 106, 0.5) 0%,
    rgba(232, 200, 106, 0.18) 35%,
    rgba(232, 200, 106, 0) 65%
  );
  animation: level-up-glow-pulse 2.4s ease-in-out infinite;
  pointer-events: none;
}

.level-up-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 24px;
  /* クリックはオーバーレイで受けるので、中身は素通しにして全面どこでも反応させる */
  pointer-events: none;
}

/* 「レベルアップ！」。金の縁取りで浮かせ、弾んで現れる */
.level-up-title {
  font-family: var(--font-display);
  font-size: calc(30px + var(--fit) * 10);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent-gold);
  text-shadow:
    2px 2px 0 var(--border-ink),
    0 0 12px rgba(232, 200, 106, 0.7);
  margin-bottom: calc(14px + var(--fit) * 14);
  animation: level-up-title-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

/* マスコットの姿を置く枠。光（mascot-flash）を画像の後ろに重ねる */
.level-up-mascot {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: calc(10px + var(--fit) * 12);
}

.mascot-image {
  display: block;
  width: calc(120px + var(--fit) * 70);
  height: auto;
  /* ドット絵なので補間を切り、拡大しても輪郭を濁らせない（MascotAvatar と揃える） */
  image-rendering: pixelated;
  /* フェードで差し替えるため、透明度と拡大を同時に戻す */
  transition: opacity 0.35s ease-out, transform 0.35s ease-out;
}

/* 差し替え中は一瞬消して光を見せ、戻るときにフェードインする */
.mascot-image.is-transitioning {
  opacity: 0;
  transform: scale(0.82);
}

/* 差し替えの瞬間に走る光。画像の後ろで白く弾けて切り替わりを強調する */
.mascot-flash {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 130%;
  aspect-ratio: 1;
  transform: translate(-50%, -50%) scale(0.4);
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(255, 255, 255, 0.95) 0%,
    rgba(255, 246, 214, 0.5) 40%,
    rgba(255, 246, 214, 0) 70%
  );
  opacity: 0;
  pointer-events: none;
}

.mascot-flash.is-flashing {
  animation: level-up-flash 0.5s ease-out;
}

.level-up-level {
  font-family: var(--font-display);
  font-size: calc(24px + var(--fit) * 8);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--white);
  text-shadow: 2px 2px 0 var(--border-ink);
}

.level-up-name {
  font-family: var(--font-display);
  font-size: calc(16px + var(--fit) * 4);
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--border-gold);
  text-shadow: 1px 1px 0 var(--border-ink);
  margin-top: 4px;
}

/* 操作の案内。控えめに点滅させて「触れる」ことを伝える */
.level-up-hint {
  margin-top: calc(18px + var(--fit) * 16);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: rgba(255, 252, 244, 0.85);
  animation: level-up-hint-blink 1.8s ease-in-out infinite;
}

/*
 * 紙吹雪。14片を画面の上から降らせる。
 * 一片ずつ横位置・色・落ちる速さ・回り方をずらして、同じ動きに見えないようにする。
 */
.level-up-confetti {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.confetti-piece {
  position: absolute;
  top: -24px;
  width: 10px;
  height: 14px;
  opacity: 0;
  animation: level-up-confetti-fall 2.8s linear infinite;
}

/* 配色はアプリの金・紫・緑で揃える。位置と間（遅延）をばらして自然に降らせる */
.confetti-piece:nth-child(3n + 1) { background: var(--accent-gold); }
.confetti-piece:nth-child(3n + 2) { background: var(--primary-light); }
.confetti-piece:nth-child(3n + 3) { background: var(--accent-green); }

.confetti-piece:nth-child(1) { left: 6%; animation-delay: 0s; animation-duration: 2.6s; }
.confetti-piece:nth-child(2) { left: 14%; animation-delay: 0.5s; animation-duration: 3.1s; }
.confetti-piece:nth-child(3) { left: 23%; animation-delay: 1.1s; animation-duration: 2.4s; }
.confetti-piece:nth-child(4) { left: 31%; animation-delay: 0.3s; animation-duration: 2.9s; }
.confetti-piece:nth-child(5) { left: 39%; animation-delay: 1.5s; animation-duration: 3.3s; }
.confetti-piece:nth-child(6) { left: 47%; animation-delay: 0.8s; animation-duration: 2.5s; }
.confetti-piece:nth-child(7) { left: 55%; animation-delay: 1.9s; animation-duration: 3s; }
.confetti-piece:nth-child(8) { left: 63%; animation-delay: 0.2s; animation-duration: 2.7s; }
.confetti-piece:nth-child(9) { left: 71%; animation-delay: 1.3s; animation-duration: 3.2s; }
.confetti-piece:nth-child(10) { left: 78%; animation-delay: 0.6s; animation-duration: 2.4s; }
.confetti-piece:nth-child(11) { left: 85%; animation-delay: 1.7s; animation-duration: 2.9s; }
.confetti-piece:nth-child(12) { left: 91%; animation-delay: 1s; animation-duration: 3.1s; }
.confetti-piece:nth-child(13) { left: 96%; animation-delay: 0.4s; animation-duration: 2.6s; }
.confetti-piece:nth-child(14) { left: 50%; animation-delay: 2.1s; animation-duration: 2.8s; }

@keyframes level-up-glow-pulse {
  0%,
  100% {
    opacity: 0.7;
    transform: translate(-50%, -50%) scale(0.92);
  }

  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.06);
  }
}

@keyframes level-up-title-pop {
  from {
    opacity: 0;
    transform: scale(0.6) translateY(16px);
  }

  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes level-up-flash {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.4);
  }

  45% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.05);
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.3);
  }
}

@keyframes level-up-hint-blink {
  0%,
  100% {
    opacity: 0.4;
  }

  50% {
    opacity: 0.95;
  }
}

@keyframes level-up-confetti-fall {
  0% {
    opacity: 0;
    transform: translateY(0) rotate(0deg);
  }

  10% {
    opacity: 1;
  }

  100% {
    opacity: 0.9;
    transform: translateY(105vh) rotate(540deg);
  }
}

/*
 * 動きを減らす設定の場合は、エフェクト（紙吹雪・光の脈動・フェード・弾み・点滅）を
 * すべて止める。ただし「経由レベルを順に見せる」仕様は JavaScript 側で保つため、
 * 段送りそのものは残り、各段の最終的な姿が静止画として見える。
 */
@media (prefers-reduced-motion: reduce) {
  .level-up-glow,
  .level-up-title,
  .level-up-hint,
  .confetti-piece,
  .mascot-flash,
  .mascot-flash.is-flashing {
    animation: none;
  }

  .mascot-image {
    transition: none;
  }

  /* フェードの途中状態（透明・縮小）で固まらないよう、常に表示の姿へ戻す */
  .mascot-image.is-transitioning {
    opacity: 1;
    transform: none;
  }

  /* 紙吹雪は動かさないなら見せない（降らない紙片が散らばって見えるのを防ぐ） */
  .confetti-piece {
    opacity: 0;
  }

  /* 後光は動かさずとも祝祭の地として薄く残す */
  .level-up-glow {
    opacity: 0.8;
  }
}
</style>
