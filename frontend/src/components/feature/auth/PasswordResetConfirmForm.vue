<script setup>
import { ref } from 'vue';
import {
  CONFIRMATION_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_HINT
} from '@/constants/authValidation';

/**
 * @description 確認コードと新しいパスワードの入力欄を提供する。
 * 再設定の処理は行わず、入力された値を親へ渡すだけに留める。
 */
defineProps({
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

/** 入力中の確認コード */
const confirmationCode = ref('');

/** 入力中の新しいパスワード */
const newPassword = ref('');

/**
 * @description 入力値を親へ渡す
 * @returns {void}
 */
const handleSubmit = () => {
  emit('submitPasswordReset', {
    confirmationCode: confirmationCode.value.trim(),
    newPassword: newPassword.value
  });
};
</script>

<template>
  <form
    class="auth-form"
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

    <label class="auth-field">
      <span class="auth-label">確認コード</span>
      <input
        v-model="confirmationCode"
        type="text"
        name="confirmationCode"
        inputmode="numeric"
        autocomplete="one-time-code"
        :maxlength="CONFIRMATION_CODE_LENGTH"
        :disabled="isResettingPassword"
        required
      >
    </label>

    <label class="auth-field">
      <span class="auth-label">新しいパスワード</span>
      <input
        v-model="newPassword"
        type="password"
        name="newPassword"
        autocomplete="new-password"
        :minlength="PASSWORD_MIN_LENGTH"
        :disabled="isResettingPassword"
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
