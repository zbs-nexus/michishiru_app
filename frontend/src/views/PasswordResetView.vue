<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import PasswordResetConfirmForm from '@/components/feature/auth/PasswordResetConfirmForm.vue';
import PasswordResetRequestForm from '@/components/feature/auth/PasswordResetRequestForm.vue';
import { useAuthStore } from '@/stores/authStore';

/**
 * @description パスワード再設定画面。
 * ユーザー名の入力と、確認コード＋新しいパスワードの入力の2段で構成する。
 * 再設定処理はストアとserviceへ委譲し、この画面は段の切り替えと遷移だけを担う。
 *
 * Cognito は新しいパスワードを発行せず、利用者自身に決めさせる仕組みのため、
 * 「再発行」ではなく「再設定」の流れになる。
 */
const router = useRouter();
const authStore = useAuthStore();

// ログイン画面から移ってきた場合に、前の画面のエラーを引き継がないよう消す
authStore.clearErrorMessage();

/** 確認コードの入力に進んだかどうか */
const isConfirming = ref(false);

/**
 * 再設定の対象のユーザー名。確認と再送に使う。
 * 画面をまたがないためストアではなくこの画面で持つ。
 */
const targetUsername = ref('');

/** 入力されたメールアドレス。再送でも組み合わせを確かめるため保持する */
const targetEmail = ref('');

/** 確認コードの送信先（マスクされた形）。取得できない場合はnull */
const codeDeliveryDestination = ref(null);

/**
 * @description 確認コードを送り、コードと新しいパスワードの入力へ進む。
 * ユーザー名とメールアドレスの組み合わせが一致しない場合は進まない。
 * 失敗の理由はストアが保持し、フォーム側に表示される。
 * @param {{username: string, email: string}} inputs 入力されたユーザー名とメールアドレス
 * @returns {Promise<void>}
 */
const handlePasswordResetRequest = async ({ username, email }) => {
  const { isSucceeded, codeDeliveryDestination: destination } =
    await authStore.resetPassword(username, email);

  if (!isSucceeded) {
    return;
  }

  targetUsername.value = username;
  targetEmail.value = email;
  codeDeliveryDestination.value = destination;
  isConfirming.value = true;
};

/**
 * @description 新しいパスワードを確定し、ログイン画面へ送る
 * @param {{confirmationCode: string, newPassword: string}} inputs 入力された確認コードと新しいパスワード
 * @returns {Promise<void>}
 */
const handlePasswordReset = async ({ confirmationCode, newPassword }) => {
  const isSucceeded = await authStore.confirmResetPassword(
    targetUsername.value,
    confirmationCode,
    newPassword
  );

  if (isSucceeded) {
    router.push({ name: 'login', query: { reset: '1' } });
  }
};

/**
 * @description 確認コードを再送する。
 * 再送は開始と同じ操作のため、送信先を受け取り直して表示を更新する。
 * @returns {Promise<void>}
 */
const handleResendCode = async () => {
  const { isSucceeded, codeDeliveryDestination: destination } =
    await authStore.resetPassword(targetUsername.value, targetEmail.value);

  if (isSucceeded) {
    codeDeliveryDestination.value = destination;
  }
};
</script>

<template>
  <DefaultLayout>
    <template #background>
      <div class="header-bg" />
    </template>

    <div class="logo-header">
      <div class="logo-icon">
        <img
          :src="logoImage"
          alt="ミチシル"
          width="50"
          height="50"
        >
      </div>
      <div class="logo-text">
        <h1>ミチシル</h1>
        <p>ルート提案型お散歩アプリ</p>
      </div>
    </div>

    <h2 class="section-title">
      {{ isConfirming ? '新しいパスワードの設定' : 'パスワードの再設定' }}
    </h2>

    <PasswordResetConfirmForm
      v-if="isConfirming"
      :is-resetting-password="authStore.isResettingPassword"
      :code-delivery-destination="codeDeliveryDestination"
      :error-message="authStore.errorMessage"
      @submit-password-reset="handlePasswordReset"
      @resend-code="handleResendCode"
    />

    <PasswordResetRequestForm
      v-else
      :is-resetting-password="authStore.isResettingPassword"
      :error-message="authStore.errorMessage"
      @submit-password-reset-request="handlePasswordResetRequest"
    />

    <p class="auth-switch">
      パスワードを思い出した方は
      <RouterLink :to="{ name: 'login' }">
        ログイン
      </RouterLink>
    </p>
  </DefaultLayout>
</template>
