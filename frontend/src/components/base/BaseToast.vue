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
   */
  variant: {
    type: String,
    default: 'error',
    validator: (value) => ['error', 'omakase'].includes(value)
  }
});

defineEmits(['close']);

/** お知らせかどうか。エラー以外は割り込まずに読み上げさせる */
const isOmakase = computed(() => props.variant === 'omakase');
</script>

<template>
  <div
    class="toast"
    :class="{ 'is-omakase': isOmakase }"
    :role="isOmakase ? 'status' : 'alert'"
    :aria-live="isOmakase ? 'polite' : 'assertive'"
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
  border-radius: 12px;
  border: 2px solid var(--border-gold);
  border-left: 4px solid var(--danger);
  background: var(--surface);
  box-shadow: 0 4px 16px rgba(58, 46, 32, 0.22);
  animation: toast-slide-in 0.2s ease-out;
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
  border: 2px solid transparent;
  border-radius: 20px;
  background:
    linear-gradient(135deg, var(--surface) 0%, var(--bg-deep) 100%) padding-box,
    linear-gradient(135deg, var(--accent-gold) 0%, var(--primary-light) 100%) border-box;
  box-shadow: 0 8px 24px rgba(58, 46, 32, 0.28);
  animation: toast-pop-in 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-logo {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 2px solid var(--border-gold);
  box-shadow: 0 3px 8px rgba(58, 46, 32, 0.32);
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
