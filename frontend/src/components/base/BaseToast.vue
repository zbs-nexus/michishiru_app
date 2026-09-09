<script setup>
/**
 * @description 画面上部に一時的なメッセージを表示するポップアップ部品。
 * 表示の可否は親が制御し、閉じる操作はemitで通知する。
 */
defineProps({
  /** 表示するメッセージ */
  message: {
    type: String,
    required: true
  }
});

defineEmits(['close']);
</script>

<template>
  <div
    class="toast"
    role="alert"
    aria-live="assertive"
  >
    <span class="toast-message">{{ message }}</span>
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
  border-left: 4px solid #C0392B;
  background: var(--white);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  animation: toast-slide-in 0.2s ease-out;
}

.toast-message {
  flex: 1;
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
  background: #F0F4F8;
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

/* 動きを減らす設定の場合はアニメーションを無効にする */
@media (prefers-reduced-motion: reduce) {
  .toast {
    animation: none;
  }
}
</style>
