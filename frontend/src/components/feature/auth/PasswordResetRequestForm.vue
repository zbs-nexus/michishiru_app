<script setup>
import { ref } from 'vue';
import {
  EMAIL_MAX_LENGTH,
  USERNAME_MAX_LENGTH
} from '@/constants/authValidation';
import {
  hasNoFieldError,
  validateEmail,
  validateUsername
} from '@/utils/authValidator';

/**
 * @description パスワードを再設定する対象のユーザー名とメールアドレスを入力する欄を提供する。
 * 送信の処理は行わず、入力値を検証してから親へ渡すだけに留める。
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

/** 入力中のメールアドレス */
const email = ref('');

/** 項目ごとの入力チェックの結果。問題が無い項目はnull */
const fieldErrors = ref({
  username: null,
  email: null
});

/**
 * @description 修正された項目のエラーを消す
 * @param {string} fieldName 項目名
 * @returns {void}
 */
const clearFieldError = (fieldName) => {
  fieldErrors.value[fieldName] = null;
};

/**
 * @description 入力値を検証し、問題が無ければ親へ渡す。
 * 前後の空白はコピー貼り付けで混ざりやすいため取り除く。
 * @returns {void}
 */
const handleSubmit = () => {
  const trimmedUsername = username.value.trim();
  const trimmedEmail = email.value.trim();

  fieldErrors.value = {
    username: validateUsername(trimmedUsername),
    email: validateEmail(trimmedEmail)
  };

  if (!hasNoFieldError(fieldErrors.value)) {
    return;
  }

  emit('submitPasswordResetRequest', {
    username: trimmedUsername,
    email: trimmedEmail
  });
};
</script>

<template>
  <!--
    入力欄のスタイル（auth-*）は global.css で共通化している。
    ブラウザ既定の検証バブルは文言を揃えられないため novalidate で止めている。
  -->
  <form
    class="auth-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <p class="auth-note">
      登録済みのユーザー名と、そのユーザーに登録したメールアドレスを入力してください。
      組み合わせが一致した場合に、パスワードを再設定するための確認コードを送ります。
    </p>

    <div class="auth-field">
      <label
        class="auth-label"
        for="password-reset-username"
      >ユーザー名</label>
      <input
        id="password-reset-username"
        v-model="username"
        type="text"
        name="username"
        autocomplete="username"
        :maxlength="USERNAME_MAX_LENGTH"
        :disabled="isResettingPassword"
        :aria-invalid="fieldErrors.username !== null"
        aria-describedby="password-reset-username-error"
        @input="clearFieldError('username')"
      >
      <span
        v-if="fieldErrors.username"
        id="password-reset-username-error"
        class="auth-error"
      >
        {{ fieldErrors.username }}
      </span>
    </div>

    <div class="auth-field">
      <label
        class="auth-label"
        for="password-reset-email"
      >メールアドレス</label>
      <input
        id="password-reset-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        :maxlength="EMAIL_MAX_LENGTH"
        :disabled="isResettingPassword"
        :aria-invalid="fieldErrors.email !== null"
        aria-describedby="password-reset-email-error"
        @input="clearFieldError('email')"
      >
      <span
        v-if="fieldErrors.email"
        id="password-reset-email-error"
        class="auth-error"
      >
        {{ fieldErrors.email }}
      </span>
    </div>

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
