<script setup>
import { ref } from 'vue';
import { CONFIRMATION_CODE_LENGTH } from '@/constants/authValidation';

/**
 * @description メールで届いた確認コードの入力欄を提供する。
 * 有効化の処理は行わず、入力された値を親へ渡すだけに留める。
 */
defineProps({
  /** 通信中かどうか */
  isSigningUp: {
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

const emit = defineEmits(['submitConfirmation', 'resendCode']);

/** 入力中の確認コード */
const confirmationCode = ref('');

/**
 * @description 入力値を親へ渡す
 * @returns {void}
 */
const handleSubmit = () => {
  emit('submitConfirmation', {
    confirmationCode: confirmationCode.value.trim()
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
      メールに記載された{{ CONFIRMATION_CODE_LENGTH }}桁の数字を入力してください。
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
        :disabled="isSigningUp"
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
      :disabled="isSigningUp"
    >
      {{ isSigningUp ? '確認中...' : '登録を完了する' }}
    </button>

    <button
      class="secondary-btn"
      type="button"
      :disabled="isSigningUp"
      @click="$emit('resendCode')"
    >
      確認コードを再送する
    </button>
  </form>
</template>
