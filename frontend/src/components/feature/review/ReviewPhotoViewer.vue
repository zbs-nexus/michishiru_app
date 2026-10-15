<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/**
 * @description 口コミの写真を全画面で拡大表示する。
 * 1か所に複数枚ある場合は、左右のスワイプ・矢印ボタン・キーボードで切り替えられる。
 * 表示する写真は親が持ち、ここでは今どれを見ているかだけを扱う。
 */
const props = defineProps({
  /** 表示する写真のURLの一覧 */
  photoUrls: {
    type: Array,
    required: true
  },
  /** 最初に表示する写真の位置 */
  startIndex: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['close']);

/** 送りと判定する最小の横移動量（ピクセル）。これ未満はタップとみなす */
const SWIPE_THRESHOLD_PX = 40;

/** 今見ている写真の位置 */
const viewerIndex = ref(props.startIndex);

/** スワイプの開始位置（画面のX座標）。触れていないときはnull */
let swipeStartX = null;

/** 直前の操作がスワイプだったか。touchendに続くclickで閉じないための目印 */
let hasSwiped = false;

/** 表示できる写真が複数あるか（1枚なら送りのUIを出さない） */
const hasMultiplePhotos = computed(() => props.photoUrls.length > 1);

/** 今見ている写真のURL */
const currentPhotoUrl = computed(() => props.photoUrls[viewerIndex.value] ?? '');

// 別の写真から開き直されたら、その位置から見せる
watch(
  () => [props.photoUrls, props.startIndex],
  () => {
    viewerIndex.value = props.startIndex;
  }
);

/**
 * @description 指定の方向へ写真を送る。端では止まらず反対側へ回る
 * @param {number} step 進める枚数（前へ戻る場合は負の数）
 * @returns {void}
 */
const movePhoto = (step) => {
  const count = props.photoUrls.length;

  if (count === 0) {
    return;
  }

  // 剰余が負にならないよう count を足してから割る
  viewerIndex.value = (viewerIndex.value + step + count) % count;
};

/**
 * @description スワイプの開始位置を覚える
 * @param {TouchEvent} event タッチイベント
 * @returns {void}
 */
const handleSwipeStart = (event) => {
  swipeStartX = event.touches[0].clientX;
  hasSwiped = false;
};

/**
 * @description 指を離した位置から、横スワイプなら写真を送る
 * @param {TouchEvent} event タッチイベント
 * @returns {void}
 */
const handleSwipeEnd = (event) => {
  if (swipeStartX === null) {
    return;
  }

  const movedX = event.changedTouches[0].clientX - swipeStartX;
  swipeStartX = null;

  if (Math.abs(movedX) < SWIPE_THRESHOLD_PX) {
    return;
  }

  // 続いて発火するclickで閉じてしまわないよう、ここで打ち切る
  hasSwiped = true;
  event.preventDefault();

  // 左へ払ったら次の写真へ進む
  movePhoto(movedX < 0 ? 1 : -1);
};

/**
 * @description 背景のタップで閉じる。スワイプ直後は閉じない
 * @returns {void}
 */
const handleBackdropClick = () => {
  if (hasSwiped) {
    hasSwiped = false;
    return;
  }

  emit('close');
};

/**
 * @description キーボードでも送りと終了ができるようにする
 * @param {KeyboardEvent} event キーイベント
 * @returns {void}
 */
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    emit('close');
    return;
  }

  if (event.key === 'ArrowRight') {
    movePhoto(1);
    return;
  }

  if (event.key === 'ArrowLeft') {
    movePhoto(-1);
  }
};

// 全画面表示の間だけ、画面全体のキー操作を受ける
onMounted(() => {
  window.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <!--
    body へ出す。
    投稿フォーム（.review-form）は translateX(-50%) で中央寄せしており、
    transform を持つ要素は position: fixed の子孫の基準（包含ブロック）になる。
    フォームの中に置くと inset: 0 がフォームの矩形を指してしまい、
    画面全体に広がらず、上部の案内要素にもかぶらない。
  -->
  <Teleport to="body">
    <div
      class="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="写真の拡大表示"
      @touchstart="handleSwipeStart"
      @touchend="handleSwipeEnd"
      @click="handleBackdropClick"
    >
      <!-- 画像自体のタップでは閉じない（送りの操作と区別するため） -->
      <img
        :src="currentPhotoUrl"
        alt=""
        class="photo-viewer-image"
        @click.stop
      >

      <button
        class="photo-viewer-close"
        type="button"
        aria-label="閉じる"
        @click.stop="$emit('close')"
      >
        ×
      </button>

      <template v-if="hasMultiplePhotos">
        <button
          class="photo-viewer-nav is-prev"
          type="button"
          aria-label="前の写真"
          @click.stop="movePhoto(-1)"
        >
          ‹
        </button>
        <button
          class="photo-viewer-nav is-next"
          type="button"
          aria-label="次の写真"
          @click.stop="movePhoto(1)"
        >
          ›
        </button>

        <p
          class="photo-viewer-count"
          role="status"
        >
          {{ viewerIndex + 1 }} / {{ photoUrls.length }}
        </p>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
/*
 * 画面全体に広げる。body へ出しているため inset: 0 がビューポートを指す。
 * z-index は投稿フォーム（150）と上部の案内要素（40）より手前にする。
 */
.photo-viewer {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.85);
  cursor: zoom-out;
  /* 横スワイプをブラウザのジェスチャに取られないようにする */
  touch-action: none;
}

.photo-viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  cursor: default;
}

.photo-viewer-close {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 24px;
  line-height: 1;
  color: var(--white);
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

/* 送りのボタン。指が届きやすいよう画面の左右端に大きく置く */
.photo-viewer-nav {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  padding: 0;
  font-size: 32px;
  line-height: 1;
  color: var(--white);
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.photo-viewer-nav.is-prev {
  left: 12px;
}

.photo-viewer-nav.is-next {
  right: 12px;
}

.photo-viewer-count {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--white);
  background: rgba(0, 0, 0, 0.5);
  border-radius: 999px;
}
</style>
