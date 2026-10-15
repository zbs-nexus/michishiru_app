<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import SignUpConfirmForm from '@/components/feature/auth/SignUpConfirmForm.vue';
import SignUpForm from '@/components/feature/auth/SignUpForm.vue';
import { useAuthStore } from '@/stores/authStore';

/**
 * @description ユーザー登録画面。
 * 登録とメールの確認コード入力の2段で構成する。
 * 登録処理はストアとserviceへ委譲し、この画面は段の切り替えと遷移だけを担う。
 */
const router = useRouter();
const authStore = useAuthStore();

// ログイン画面から移ってきた場合に、前の画面のエラーを引き継がないよう消す
authStore.clearErrorMessage();

/** 確認コードの入力に進んだかどうか */
const isConfirming = ref(false);

/**
 * 登録したユーザー名。確認コードの送信に使う。
 * 画面をまたがないためストアではなくこの画面で持つ。
 */
const registeredUsername = ref('');

/** 確認コードの送信先（マスクされた形）。取得できない場合はnull */
const codeDeliveryDestination = ref(null);

/**
 * @description 入力された内容でユーザーを登録し、確認コードの入力へ進む。
 * 失敗の理由はストアが保持し、フォーム側に表示される。
 * @param {{username: string, email: string, password: string}} inputs 入力された登録情報
 * @returns {Promise<void>}
 */
const handleSignUp = async ({ username, email, password }) => {
  const { isSucceeded, isConfirmationRequired, codeDeliveryDestination: destination } =
    await authStore.signUp(username, email, password);

  if (!isSucceeded) {
    return;
  }

  registeredUsername.value = username;
  codeDeliveryDestination.value = destination;

  // 確認が不要な設定の場合は、そのままログインへ送る
  if (!isConfirmationRequired) {
    router.push({ name: 'login', query: { registered: '1' } });
    return;
  }

  isConfirming.value = true;
};

/**
 * @description 確認コードで登録を確定し、ログイン画面へ送る
 * @param {{confirmationCode: string}} inputs 入力された確認コード
 * @returns {Promise<void>}
 */
const handleConfirmation = async ({ confirmationCode }) => {
  const isSucceeded = await authStore.confirmSignUp(
    registeredUsername.value,
    confirmationCode
  );

  if (isSucceeded) {
    router.push({ name: 'login', query: { registered: '1' } });
  }
};

/**
 * @description 確認コードを再送する
 * @returns {Promise<void>}
 */
const handleResendCode = async () => {
  await authStore.resendCode(registeredUsername.value);
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
      </div>
    </div>

    <h2 class="section-title">
      {{ isConfirming ? 'メールアドレスの確認' : 'ユーザー登録' }}
    </h2>

    <SignUpConfirmForm
      v-if="isConfirming"
      :is-signing-up="authStore.isSigningUp"
      :code-delivery-destination="codeDeliveryDestination"
      :error-message="authStore.errorMessage"
      @submit-confirmation="handleConfirmation"
      @resend-code="handleResendCode"
    />

    <SignUpForm
      v-else
      :is-signing-up="authStore.isSigningUp"
      :error-message="authStore.errorMessage"
      @submit-sign-up="handleSignUp"
    />

    <p class="auth-switch">
      すでにアカウントをお持ちの方は
      <RouterLink :to="{ name: 'login' }">
        ログイン
      </RouterLink>
    </p>
  </DefaultLayout>
</template>
