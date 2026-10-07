<script setup>
/**
 * @description パスワードの表示・非表示を切り替えるボタン。
 * 入力欄の右端に重ねて置く目のアイコンで、押すと平文表示に切り替わる。
 *
 * 切り替えの状態は持たず、押されたことを親へ伝えるだけに留める。
 * Edge は同じ役目のボタンを標準で出すが、ブラウザによって有無が変わるため
 * 自前のボタンに寄せている（標準のものは global.css の `::-ms-reveal` で隠している）。
 */
defineProps({
  /** パスワードを平文で表示しているかどうか */
  isPasswordVisible: {
    type: Boolean,
    required: true
  },
  /** 操作できない状態かどうか（通信中など） */
  isDisabled: {
    type: Boolean,
    default: false
  },
  /** 読み上げ用の項目名。新しいパスワードの欄では差し替える */
  label: {
    type: String,
    default: 'パスワード'
  }
});

defineEmits(['toggleVisibility']);
</script>

<template>
  <!-- アイコンだけのボタンなので、何のボタンかは aria-label で伝える -->
  <button
    class="password-visibility-btn"
    type="button"
    :aria-label="isPasswordVisible ? `${label}を隠す` : `${label}を表示する`"
    :aria-pressed="isPasswordVisible"
    :disabled="isDisabled"
    @click="$emit('toggleVisibility')"
  >
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
      <!-- 平文表示中は斜線を重ね、押すと隠れることが分かるようにする -->
      <line
        v-if="isPasswordVisible"
        x1="4"
        y1="20"
        x2="20"
        y2="4"
      />
    </svg>
  </button>
</template>

<style scoped>
/* 入力欄の右端に重ねる。位置の基準は global.css の .auth-password */
.password-visibility-btn {
  position: absolute;
  top: 50%;
  right: 10px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--text-gray);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.password-visibility-btn:hover {
  color: var(--primary-color);
}

.password-visibility-btn:focus-visible {
  outline: 2px solid var(--route-blue);
  outline-offset: 1px;
}

.password-visibility-btn:disabled {
  color: #B8C4CE;
  cursor: default;
}
</style>
