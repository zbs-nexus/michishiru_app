<script setup>
import { useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import LoginForm from '@/components/feature/auth/LoginForm.vue';
import { useAuthStore } from '@/stores/authStore';

/**
 * @description ログイン画面。
 * 認証はストアとserviceへ委譲し、この画面は成功後の遷移だけを担う。
 */
const router = useRouter();
const authStore = useAuthStore();

/**
 * @description 入力された資格情報でサインインし、成功したらホームへ進む。
 * 失敗の理由はストアが保持し、フォーム側に表示される。
 * @param {{username: string, password: string}} credentials 入力された資格情報
 * @returns {Promise<void>}
 */
const handleLogin = async ({ username, password }) => {
  const isSucceeded = await authStore.signIn(username, password);

  if (isSucceeded) {
    router.push({ name: 'route-condition' });
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
      ログイン
    </h2>

    <LoginForm
      :is-signing-in="authStore.isSigningIn"
      :error-message="authStore.errorMessage"
      @submit-login="handleLogin"
    />
  </DefaultLayout>
</template>
