<script setup>
import { ref } from 'vue';

/**
 * @description パスワードを再設定する対象のユーザー名を入力する欄を提供する。
 * 送信の処理は行わず、入力された値を親へ渡すだけに留める。
 */
defineProps({
  /** パスワード再設定の通信中かどうか */
  isResettingPassword: {
    type: Boolean,
    default: false
  },
  /** 表示するエラーの文言。無い場合はnull */
  errorMessage: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['submitPasswordResetRequest']);

/** 入力中のユーザー名 */
const username = ref('');

/**
 * @description 入力値を親へ渡す。
 * 前後の空白はコピー貼り付けで混ざりやすいため取り除く。
 * @returns {void}
 */
const handleSubmit = () => {
  emit('submitPasswordResetRequest', {
    username: username.value.trim()
  });
};
</script>

<template>
  <!-- 入力欄のスタイル（auth-*）は global.css で共通化している -->
  <form
    class="auth-form"
    @submit.prevent="handleSubmit"
  >
    <p class="auth-note">
      登録済みのユーザー名を入力してください。
      登録したメールアドレスへ、パスワードを再設定するための確認コードを送ります。
    </p>

    <label class="auth-field">
      <span class="auth-label">ユーザー名</span>
      <input
        v-model="username"
        type="text"
        name="username"
        autocomplete="username"
        :disabled="isResettingPassword"
        required
      >
    </label>

    <p
      v-if="errorMessage"
      class="auth-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>

    <button
      class="primary-btn"
      type="submit"
      :disabled="isResettingPassword"
    >
      {{ isResettingPassword ? '送信中...' : '確認コードを送る' }}
    </button>
  </form>
</template>
