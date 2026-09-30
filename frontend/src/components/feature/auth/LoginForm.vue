<script setup>
import { ref } from 'vue';

/**
 * @description ユーザー名とパスワードの入力欄を提供する。
 * 認証は行わず、入力された値を親へ渡すだけに留める。
 */
defineProps({
  /** サインインの通信中かどうか */
  isSigningIn: {
    type: Boolean,
    default: false
  },
  /** 表示するエラーの文言。無い場合はnull */
  errorMessage: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['submitLogin']);

/** 入力中のユーザー名 */
const username = ref('');

/** 入力中のパスワード */
const password = ref('');

/**
 * @description 入力値を親へ渡す。
 * 前後の空白はコピー貼り付けで混ざりやすいため、ユーザー名だけ取り除く。
 * @returns {void}
 */
const handleSubmit = () => {
  emit('submitLogin', {
    username: username.value.trim(),
    password: password.value
  });
};
</script>

<template>
  <!--
    BaseButton は type="button" 固定でフォームを送信できないため、
    Enterキーでログインできるようここでは submit のボタンを使い、
    見た目だけ共通クラスの primary-btn を借りる。
    入力欄のスタイル（auth-*）はユーザー登録画面と共通のため global.css に置いている。
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
        :disabled="isSigningIn"
        required
      >
    </label>

    <label class="auth-field">
      <span class="auth-label">パスワード</span>
      <input
        v-model="password"
        type="password"
        name="password"
        autocomplete="current-password"
        :disabled="isSigningIn"
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
      :disabled="isSigningIn"
    >
      {{ isSigningIn ? 'ログイン中...' : 'ログイン' }}
    </button>
  </form>
</template>
