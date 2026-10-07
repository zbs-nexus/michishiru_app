<script setup>
import { ref, watch } from 'vue';
import PasswordVisibilityButton from '@/components/feature/auth/PasswordVisibilityButton.vue';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_HINT,
  USERNAME_MAX_LENGTH
} from '@/constants/authValidation';
import { usePasswordVisibility } from '@/composables/usePasswordVisibility';
import {
  hasNoFieldError,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateUsername
} from '@/utils/authValidator';

/**
 * @description ユーザー名・メールアドレス・パスワード・確認パスワードの入力欄を提供する。
 * 登録処理は行わず、入力値を検証してから親へ渡すだけに留める。
 */
const props = defineProps({
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

// 表示の状態は欄ごとに持つ。片方を平文にしても、もう片方は隠したままにする
const passwordVisibility = usePasswordVisibility();
const passwordConfirmationVisibility = usePasswordVisibility();

/** 入力中のユーザー名 */
const username = ref('');

/** 入力中のメールアドレス */
const email = ref('');

/** 入力中のパスワード */
const password = ref('');

/** 入力中の確認パスワード */
const passwordConfirmation = ref('');

/** 項目ごとの入力チェックの結果。問題が無い項目はnull */
const fieldErrors = ref({
  username: null,
  email: null,
  password: null,
  passwordConfirmation: null
});

/**
 * @description 両方のパスワード欄の表示ボタンを隠す
 * @returns {void}
 */
const disableAllPasswordReveal = () => {
  passwordVisibility.disablePasswordReveal();
  passwordConfirmationVisibility.disablePasswordReveal();
};

// 登録に失敗したときも、修正されるまで表示ボタンを出さない
watch(
  () => props.errorMessage,
  (message) => {
    if (message !== null) {
      disableAllPasswordReveal();
    }
  }
);

/**
 * @description 修正された項目のエラーを消す
 * @param {string} fieldName 項目名
 * @returns {void}
 */
const clearFieldError = (fieldName) => {
  fieldErrors.value[fieldName] = null;
};

/**
 * @description パスワードが修正されたら、エラーを消して表示ボタンを出せるようにする。
 * 確認パスワードとの一致も取り直すため、両方のエラーを消す。
 * @returns {void}
 */
const handlePasswordInput = () => {
  clearFieldError('password');
  clearFieldError('passwordConfirmation');
  passwordVisibility.enablePasswordReveal();
};

/**
 * @description 確認パスワードが修正されたときの処理
 * @returns {void}
 */
const handlePasswordConfirmationInput = () => {
  clearFieldError('passwordConfirmation');
  passwordConfirmationVisibility.enablePasswordReveal();
};

/**
 * @description 入力値を検証し、問題が無ければ親へ渡す。
 * 前後の空白はコピー貼り付けで混ざりやすいため、
 * ユーザー名とメールアドレスからは取り除く。
 * @returns {void}
 */
const handleSubmit = () => {
  const trimmedUsername = username.value.trim();
  const trimmedEmail = email.value.trim();

  fieldErrors.value = {
    username: validateUsername(trimmedUsername),
    email: validateEmail(trimmedEmail),
    password: validatePassword(password.value),
    passwordConfirmation: validatePasswordConfirmation(
      password.value,
      passwordConfirmation.value
    )
  };

  if (!hasNoFieldError(fieldErrors.value)) {
    disableAllPasswordReveal();
    return;
  }

  emit('submitSignUp', {
    username: trimmedUsername,
    email: trimmedEmail,
    password: password.value
  });
};
</script>

<template>
  <!--
    LoginForm と同じ理由で、BaseButton ではなく submit のボタンを使う。
    入力欄のスタイル（auth-*）は global.css で共通化している。
    ブラウザ既定の検証バブルは文言を揃えられないため novalidate で止めている。
  -->
  <form
    class="auth-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <div class="auth-field">
      <label
        class="auth-label"
        for="sign-up-username"
      >ユーザー名</label>
      <input
        id="sign-up-username"
        v-model="username"
        type="text"
        name="username"
        autocomplete="username"
        :maxlength="USERNAME_MAX_LENGTH"
        :disabled="isSigningUp"
        :aria-invalid="fieldErrors.username !== null"
        aria-describedby="sign-up-username-error"
        @input="clearFieldError('username')"
      >
      <span
        v-if="fieldErrors.username"
        id="sign-up-username-error"
        class="auth-error"
      >
        {{ fieldErrors.username }}
      </span>
    </div>

    <div class="auth-field">
      <label
        class="auth-label"
        for="sign-up-email"
      >メールアドレス</label>
      <input
        id="sign-up-email"
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        :maxlength="EMAIL_MAX_LENGTH"
        :disabled="isSigningUp"
        :aria-invalid="fieldErrors.email !== null"
        aria-describedby="sign-up-email-error"
        @input="clearFieldError('email')"
      >
      <span
        v-if="fieldErrors.email"
        id="sign-up-email-error"
        class="auth-error"
      >
        {{ fieldErrors.email }}
      </span>
    </div>

    <div class="auth-field">
      <label
        class="auth-label"
        for="sign-up-password"
      >パスワード</label>
      <div class="auth-password">
        <input
          id="sign-up-password"
          v-model="password"
          :type="passwordVisibility.passwordInputType.value"
          name="password"
          autocomplete="new-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          :disabled="isSigningUp"
          :aria-invalid="fieldErrors.password !== null"
          aria-describedby="sign-up-password-hint sign-up-password-error"
          @input="handlePasswordInput"
        >
        <!-- エラーが出た後は、入力が修正されるまでこのボタンを出さない -->
        <PasswordVisibilityButton
          v-if="passwordVisibility.isPasswordRevealAvailable.value"
          :is-password-visible="passwordVisibility.isPasswordVisible.value"
          :is-disabled="isSigningUp"
          @toggle-visibility="passwordVisibility.togglePasswordVisibility"
        />
      </div>
      <span
        id="sign-up-password-hint"
        class="auth-note"
      >{{ PASSWORD_POLICY_HINT }}</span>
      <span
        v-if="fieldErrors.password"
        id="sign-up-password-error"
        class="auth-error"
      >
        {{ fieldErrors.password }}
      </span>
    </div>

    <div class="auth-field">
      <label
        class="auth-label"
        for="sign-up-password-confirmation"
      >パスワード（確認）</label>
      <div class="auth-password">
        <input
          id="sign-up-password-confirmation"
          v-model="passwordConfirmation"
          :type="passwordConfirmationVisibility.passwordInputType.value"
          name="passwordConfirmation"
          autocomplete="new-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          :disabled="isSigningUp"
          :aria-invalid="fieldErrors.passwordConfirmation !== null"
          aria-describedby="sign-up-password-confirmation-error"
          @input="handlePasswordConfirmationInput"
        >
        <PasswordVisibilityButton
          v-if="passwordConfirmationVisibility.isPasswordRevealAvailable.value"
          :is-password-visible="
            passwordConfirmationVisibility.isPasswordVisible.value
          "
          :is-disabled="isSigningUp"
          label="確認パスワード"
          @toggle-visibility="
            passwordConfirmationVisibility.togglePasswordVisibility
          "
        />
      </div>
      <span
        v-if="fieldErrors.passwordConfirmation"
        id="sign-up-password-confirmation-error"
        class="auth-error"
      >
        {{ fieldErrors.passwordConfirmation }}
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
      :disabled="isSigningUp"
    >
      {{ isSigningUp ? '登録中...' : '登録する' }}
    </button>
  </form>
</template>
