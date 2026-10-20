<script setup>
import { computed } from 'vue';
import logoImage from '@/assets/images/logo.png';

/**
 * @description 画面上部に一時的なメッセージを表示するポップアップ部品。
 * 表示の可否は親が制御し、閉じる操作はemitで通知する。
 * 種類（variant）でデザインと読み上げの優先度を切り替える。
 */
const props = defineProps({
  /** 表示するメッセージ */
  message: {
    type: String,
    required: true
  },
  /**
   * メッセージの種類。
   * error: エラーや入力不足の通知（既定）
   * omakase: おまかせで選ばれた条件のお知らせ（ポップなデザイン）
   * success: 操作の成功通知（口コミ投稿など）
   */
  variant: {
    type: String,
    default: 'error',
    validator: (value) => ['error', 'omakase', 'success'].includes(value)
  }
});

defineEmits(['close']);

/** お知らせかどうか。エラー以外は割り込まずに読み上げさせる */
const isOmakase = computed(() => props.variant === 'omakase');

/** エラーかどうか。エラーのときだけ割り込みで読み上げさせる */
const isError = computed(() => props.variant === 'error');
</script>

<template>
  <div
    class="toast"
    :class="{ 'is-omakase': isOmakase, 'is-success': variant === 'success' }"
    :role="isError ? 'alert' : 'status'"
    :aria-live="isError ? 'assertive' : 'polite'"
  >
    <img
      v-if="isOmakase"
      class="toast-logo"
      :src="logoImage"
      alt=""
      width="40"
      height="40"
    >
    <span class="toast-body">
      <span
        v-if="isOmakase"
        class="toast-label"
      >おまかせ</span>
      <span class="toast-message">{{ message }}</span>
    </span>
    <button
      class="toast-close-btn"
      type="button"
      aria-label="閉じる"
      @click="$emit('close')"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
/* 画面幅が広い場合もアプリの表示幅に合わせて中央へ寄せる */
.toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200;
  display: flex;
  align-items: center;
  gap: 12px;
  width: calc(100% - 40px);
  max-width: 390px;
  padding: 14px 16px;
  border: var(--pixel-frame-width) solid var(--border-ink);
  border-image: var(--pixel-frame-ink);
  background: var(--surface);
  background-clip: padding-box;
  /*
   * 左端の色帯で種別を示す。
   * border-image は辺ごとに色を変えられないため、border-left ではなく
   * 内側の影（inset）で帯を引く。
   */
  box-shadow: inset 5px 0 0 var(--danger), var(--shadow-raised);
  animation: toast-slide-in 0.2s ease-out;
}

/* 成功通知: 左端の色帯を緑にしてエラー（赤）と見分ける */
.toast.is-success {
  box-shadow: inset 5px 0 0 var(--accent-green), var(--shadow-raised);
}

.toast-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.toast-message {
  font-size: 14px;
  font-weight: 600;
  line-height: 1.5;
  color: var(--text-dark);
}

.toast-close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  color: var(--text-gray);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.toast-close-btn:hover {
  background: var(--bg-deep);
}

/*
 * おまかせのお知らせ: アプリの配色（羊皮紙・金・紫のインク）で揃え、
 * 左端の色帯ではなくグラデーションの枠と弾むアニメーションでエラーと見分ける
 */
.toast.is-omakase {
  padding: 12px 14px;
  background: linear-gradient(135deg, var(--surface) 0%, var(--bg-deep) 100%);
  background-clip: padding-box;
  /* おまかせは種別の帯を出さないため、内側の影は付けない */
  box-shadow: var(--shadow-raised);
  animation: toast-pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-logo {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: var(--pixel-frame-width) solid var(--border-ink);
  border-image: var(--pixel-frame-ink);
  box-shadow: var(--shadow);
  animation: toast-logo-bounce 0.6s ease-out 0.35s;
}

/* 「おまかせ」の小さなラベル。白文字と紫のインクでコントラスト比 4.5:1 以上 */
.toast-label {
  align-self: flex-start;
  padding: 1px 10px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--white);
  background: var(--primary-color);
  border-radius: 999px;
}

.toast.is-omakase .toast-message {
  color: var(--primary-color);
  font-weight: 700;
}

.toast.is-omakase .toast-close-btn:hover {
  background: rgba(184, 134, 43, 0.16);
}

@keyframes toast-slide-in {
  from {
    opacity: 0;
    transform: translate(-50%, -12px);
  }

  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@keyframes toast-pop-in {
  from {
    opacity: 0;
    transform: translate(-50%, -12px) scale(0.8);
  }

  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}

@keyframes toast-logo-bounce {
  0%,
  100% {
    transform: translateY(0);
  }

  40% {
    transform: translateY(-6px) rotate(-6deg);
  }

  70% {
    transform: translateY(0) rotate(4deg);
  }
}

/* 動きを減らす設定の場合はアニメーションを無効にする */
@media (prefers-reduced-motion: reduce) {
  .toast,
  .toast.is-omakase,
  .toast-logo {
    animation: none;
  }
}
</style>
