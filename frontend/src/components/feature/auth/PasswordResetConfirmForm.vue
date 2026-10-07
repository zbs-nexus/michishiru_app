<script setup>
import { ref, watch } from 'vue';
import {
  CONFIRMATION_CODE_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_HINT
} from '@/constants/authValidation';
import { usePasswordVisibility } from '@/composables/usePasswordVisibility';
import {
  hasNoFieldError,
  validateConfirmationCode,
  validatePassword,
  validatePasswordConfirmation
} from '@/utils/authValidator';

/**
 * @description 確認コードと新しいパスワード・確認パスワードの入力欄を提供する。
 * 再設定の処理は行わず、入力値を検証してから親へ渡すだけに留める。
 */
const props = defineProps({
  /** パスワード再設定の通信中かどうか */
  isResettingPassword: {
    type: Boolean,
    default: false
  },
  /** 確認コードの送信先。マスクされた形で届くため、そのまま表示する */
  codeDeliveryDestination: {
    type: String,
    default: null
  },
  /** 表示するエラーの文言。無い場合はnull */
  errorMessage: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['submitPasswordReset', 'resendCode']);

const {
  isPasswordVisible,
  isPasswordRevealAvailable,
  passwordInputType,
  togglePasswordVisibility,
  disablePasswordReveal,
  enablePasswordReveal
} = usePasswordVisibility();

/** 入力中の確認コード */
const confirmationCode = ref('');

/** 入力中の新しいパスワード */
const newPassword = ref('');

/** 入力中の確認パスワード */
const passwordConfirmation = ref('');

/** 項目ごとの入力チェックの結果。問題が無い項目はnull */
const fieldErrors = ref({
  confirmationCode: null,
  newPassword: null,
  passwordConfirmation: null
});

// 再設定に失敗したときも、修正されるまで表示ボタンを出さない
watch(
  () => props.errorMessage,
  (message) => {
    if (message !== null) {
      disablePasswordReveal();
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
 * @description パスワードが修正されたら、エラーを消して表示ボタンを使えるようにする。
 * 確認パスワードとの一致も取り直すため、両方のエラーを消す。
 * @returns {void}
 */
const handlePasswordInput = () => {
  clearFieldError('newPassword');
  clearFieldError('passwordConfirmation');
  enablePasswordReveal();
};

/**
 * @description 入力値を検証し、問題が無ければ親へ渡す
 * @returns {void}
 */
const handleSubmit = () => {
  const trimmedConfirmationCode = confirmationCode.value.trim();

  fieldErrors.value = {
    confirmationCode: validateConfirmationCode(trimmedConfirmationCode),
    newPassword: validatePassword(newPassword.value, '新しいパスワード'),
    passwordConfirmation: validatePasswordConfirmation(
      newPassword.value,
      passwordConfirmation.value,
      '新しいパスワード'
    )
  };

  if (!hasNoFieldError(fieldErrors.value)) {
    disablePasswordReveal();
    return;
  }

  emit('submitPasswordReset', {
    confirmationCode: trimmedConfirmationCode,
    newPassword: newPassword.value
  });
};
</script>

<template>
  <!-- ブラウザ既定の検証バブルは文言を揃えられないため novalidate で止めている -->
  <form
    class="auth-form"
    novalidate
    @submit.prevent="handleSubmit"
  >
    <p class="auth-note">
      <template v-if="codeDeliveryDestination">
        {{ codeDeliveryDestination }} に確認コードを送信しました。
      </template>
      <template v-else>
        登録したメールアドレスに確認コードを送信しました。
      </template>
      メールに記載された{{ CONFIRMATION_CODE_LENGTH }}桁の数字と、新しいパスワードを入力してください。
    </p>

    <div class="auth-field">
      <label
        class="auth-label"
        for="password-reset-code"
      >確認コード</label>
      <input
        id="password-reset-code"
        v-model="confirmationCode"
        type="text"
        name="confirmationCode"
        inputmode="numeric"
        autocomplete="one-time-code"
        :maxlength="CONFIRMATION_CODE_LENGTH"
        :disabled="isResettingPassword"
        :aria-invalid="fieldErrors.confirmationCode !== null"
        aria-describedby="password-reset-code-error"
        @input="clearFieldError('confirmationCode')"
      >
      <span
        v-if="fieldErrors.confirmationCode"
        id="password-reset-code-error"
        class="auth-error"
      >
        {{ fieldErrors.confirmationCode }}
      </span>
    </div>

    <div class="auth-field">
      <label
        class="auth-label"
        for="password-reset-new-password"
      >新しいパスワード</label>
      <div class="auth-password">
        <input
          id="password-reset-new-password"
          v-model="newPassword"
          :type="passwordInputType"
          name="newPassword"
          autocomplete="new-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          :disabled="isResettingPassword"
          :aria-invalid="fieldErrors.newPassword !== null"
          aria-describedby="password-reset-new-password-hint password-reset-new-password-error"
          @input="handlePasswordInput"
        >
        <!-- エラーが出た後は、入力が修正されるまでこのボタンを出さない -->
        <button
          v-if="isPasswordRevealAvailable"
          class="auth-reveal-btn"
          type="button"
          :aria-pressed="isPasswordVisible"
          :disabled="isResettingPassword"
          @click="togglePasswordVisibility"
        >
          {{ isPasswordVisible ? '非表示' : '表示' }}
        </button>
      </div>
      <span
        id="password-reset-new-password-hint"
        class="auth-note"
      >{{ PASSWORD_POLICY_HINT }}</span>
      <span
        v-if="fieldErrors.newPassword"
        id="password-reset-new-password-error"
        class="auth-error"
      >
        {{ fieldErrors.newPassword }}
      </span>
    </div>

    <div class="auth-field">
      <label
        class="auth-label"
        for="password-reset-password-confirmation"
      >新しいパスワード（確認）</label>
      <input
        id="password-reset-password-confirmation"
        v-model="passwordConfirmation"
        :type="passwordInputType"
        name="passwordConfirmation"
        autocomplete="new-password"
        :maxlength="PASSWORD_MAX_LENGTH"
        :disabled="isResettingPassword"
        :aria-invalid="fieldErrors.passwordConfirmation !== null"
        aria-describedby="password-reset-password-confirmation-error"
        @input="clearFieldError('passwordConfirmation')"
      >
      <span
        v-if="fieldErrors.passwordConfirmation"
        id="password-reset-password-confirmation-error"
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
      :disabled="isResettingPassword"
    >
      {{ isResettingPassword ? '再設定中...' : 'パスワードを再設定する' }}
    </button>

    <button
      class="secondary-btn"
      type="button"
      :disabled="isResettingPassword"
      @click="$emit('resendCode')"
    >
      確認コードを再送する
    </button>
  </form>
</template>
