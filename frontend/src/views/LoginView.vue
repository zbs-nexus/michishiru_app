<script setup>
import { computed } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import LoginForm from '@/components/feature/auth/LoginForm.vue';
import { useAuthStore } from '@/stores/authStore';

/**
 * @description ログイン画面。
 * 認証はストアとserviceへ委譲し、この画面は成功後の遷移だけを担う。
 */
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

// ユーザー登録画面から移ってきた場合に、前の画面のエラーを引き継がないよう消す
authStore.clearErrorMessage();

/**
 * ユーザー登録を終えて戻ってきたかどうか。
 * 登録完了を伝えるためだけの表示で、状態は持ち越さずクエリで判断する。
 */
const hasRegistered = computed(() => route.query.registered === '1');

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

    <p
      v-if="hasRegistered"
      class="auth-note registered-note"
      role="status"
    >
      ユーザー登録が完了しました。登録した内容でログインしてください。
    </p>

    <LoginForm
      :is-signing-in="authStore.isSigningIn"
      :error-message="authStore.errorMessage"
      @submit-login="handleLogin"
    />

    <p class="auth-switch">
      アカウントをお持ちでない方は
      <RouterLink :to="{ name: 'sign-up' }">
        ユーザー登録
      </RouterLink>
    </p>
  </DefaultLayout>
</template>

<style scoped>
/* フォームとの間隔を空ける。auth-note 自体は余白を持たないため、ここで足す */
.registered-note {
  margin-bottom: 16px;
}
</style>
