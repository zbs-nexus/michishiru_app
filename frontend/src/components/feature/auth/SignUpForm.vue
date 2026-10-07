<script setup>
import { ref } from 'vue';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT
} from '@/constants/authValidation';

/**
 * @description ユーザー名・メールアドレス・パスワードの入力欄を提供する。
 * 登録処理は行わず、入力された値を親へ渡すだけに留める。
 */
defineProps({
  /** ユーザー登録の通信中かどうか */
  isSigningUp: {
    type: Boolean,
    default: false
  },
  /** 表示するエラーの文言。無い場合はnull */
  errorMessage: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['submitSignUp']);

/** 入力中のユーザー名 */
const username = ref('');

/** 入力中のメールアドレス */
const email = ref('');

/** 入力中のパスワード */
const password = ref('');

/**
 * @description 入力値を親へ渡す。
 * 前後の空白はコピー貼り付けで混ざりやすいため、
 * ユーザー名とメールアドレスからは取り除く。
 * @returns {void}
 */
const handleSubmit = () => {
  emit('submitSignUp', {
    username: username.value.trim(),
    email: email.value.trim(),
    password: password.value
  });
};
</script>

<template>
  <!--
    LoginForm と同じ理由で、BaseButton ではなく submit のボタンを使う。
    入力欄のスタイル（auth-*）は global.css で共通化している。
  -->
  <form
    class="auth-form"
    @submit.prevent="handleSubmit"
  >
    <label class="auth-field">
      <span class="auth-label">ユーザー名</span>
      <input
        v-model="username"
        type="text"
        name="username"
        autocomplete="username"
        :disabled="isSigningUp"
        required
      >
    </label>

    <label class="auth-field">
      <span class="auth-label">メールアドレス</span>
      <input
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        :disabled="isSigningUp"
        required
      >
    </label>

    <label class="auth-field">
      <span class="auth-label">パスワード</span>
      <input
        v-model="password"
        type="password"
        name="password"
        autocomplete="new-password"
        :minlength="PASSWORD_MIN_LENGTH"
        :disabled="isSigningUp"
        required
      >
      <span class="auth-note">{{ PASSWORD_POLICY_HINT }}</span>
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
      :disabled="isSigningUp"
    >
      {{ isSigningUp ? '登録中...' : '登録する' }}
    </button>
  </form>
</template>
