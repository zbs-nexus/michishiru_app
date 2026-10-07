<script setup>
import { ref, watch } from 'vue';
import {
  PASSWORD_MAX_LENGTH,
  USERNAME_MAX_LENGTH
} from '@/constants/authValidation';
import { usePasswordVisibility } from '@/composables/usePasswordVisibility';
import {
  hasNoFieldError,
  validatePassword,
  validateUsername
} from '@/utils/authValidator';

/**
 * @description ユーザー名とパスワードの入力欄を提供する。
 * 認証は行わず、入力値を検証してから親へ渡すだけに留める。
 */
const props = defineProps({
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

const {
  isPasswordVisible,
  isPasswordRevealAvailable,
  passwordInputType,
  togglePasswordVisibility,
  disablePasswordReveal,
  enablePasswordReveal
} = usePasswordVisibility();

/** 入力中のユーザー名 */
const username = ref('');

/** 入力中のパスワード */
const password = ref('');

/** 項目ごとの入力チェックの結果。問題が無い項目はnull */
const fieldErrors = ref({
  username: null,
  password: null
});

// サインインに失敗したときも、修正されるまで表示ボタンを出さない
watch(
  () => props.errorMessage,
  (message) => {
    if (message !== null) {
      disablePasswordReveal();
    }
  }
);

/**
 * @description ユーザー名が修正されたら、その項目のエラーを消す
 * @returns {void}
 */
const handleUsernameInput = () => {
  fieldErrors.value.username = null;
};

/**
 * @description パスワードが修正されたら、エラーを消して表示ボタンを使えるようにする
 * @returns {void}
 */
const handlePasswordInput = () => {
  fieldErrors.value.password = null;
  enablePasswordReveal();
};

/**
 * @description 入力値を検証し、問題が無ければ親へ渡す。
 * 前後の空白はコピー貼り付けで混ざりやすいため、ユーザー名だけ取り除く。
 * @returns {void}
 */
const handleSubmit = () => {
  const trimmedUsername = username.value.trim();

  fieldErrors.value = {
    username: validateUsername(trimmedUsername),
    password: validatePassword(password.value)
  };

  if (!hasNoFieldError(fieldErrors.value)) {
    disablePasswordReveal();
    return;
  }

  emit('submitLogin', {
    username: trimmedUsername,
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

    ブラウザ既定の検証バブルは文言を揃えられないため novalidate で止め、
    チェックは authValidator に寄せている。
  -->
  <form
    class="auth-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <div class="auth-field">
      <label
        class="auth-label"
        for="login-username"
      >ユーザー名</label>
      <input
        id="login-username"
        v-model="username"
        type="text"
        name="username"
        autocomplete="username"
        :maxlength="USERNAME_MAX_LENGTH"
        :disabled="isSigningIn"
        :aria-invalid="fieldErrors.username !== null"
        aria-describedby="login-username-error"
        @input="handleUsernameInput"
      >
      <span
        v-if="fieldErrors.username"
        id="login-username-error"
        class="auth-error"
      >
        {{ fieldErrors.username }}
      </span>
    </div>

    <div class="auth-field">
      <label
        class="auth-label"
        for="login-password"
      >パスワード</label>
      <div class="auth-password">
        <input
          id="login-password"
          v-model="password"
          :type="passwordInputType"
          name="password"
          autocomplete="current-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          :disabled="isSigningIn"
          :aria-invalid="fieldErrors.password !== null"
          aria-describedby="login-password-error"
          @input="handlePasswordInput"
        >
        <!-- エラーが出た後は、入力が修正されるまでこのボタンを出さない -->
        <button
          v-if="isPasswordRevealAvailable"
          class="auth-reveal-btn"
          type="button"
          :aria-pressed="isPasswordVisible"
          :disabled="isSigningIn"
          @click="togglePasswordVisibility"
        >
          {{ isPasswordVisible ? '非表示' : '表示' }}
        </button>
      </div>
      <span
        v-if="fieldErrors.password"
        id="login-password-error"
        class="auth-error"
      >
        {{ fieldErrors.password }}
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
      :disabled="isSigningIn"
    >
      {{ isSigningIn ? 'ログイン中...' : 'ログイン' }}
    </button>
  </form>
</template>
