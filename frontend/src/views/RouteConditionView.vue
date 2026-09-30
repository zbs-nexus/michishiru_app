<script setup>
import { useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import SignOutMenu from '@/components/feature/auth/SignOutMenu.vue';
import RouteConditionForm from '@/components/feature/route/RouteConditionForm.vue';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import { useRouteConditionOptions } from '@/composables/useRouteConditionOptions';
import { useRouteCreation } from '@/composables/useRouteCreation';
import { useToastMessage } from '@/composables/useToastMessage';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description ルート作成条件を入力する画面。
 * 選択肢の取得と作成処理はcomposableへ委譲し、入力値はストアへ保存する。
 */
const router = useRouter();
const authStore = useAuthStore();
const routeStore = useRouteStore();
const {
  isCreating,
  errorMessage: creationErrorMessage,
  createRoute
} = useRouteCreation();
const {
  message: toastMessage,
  showMessage,
  hideMessage
} = useToastMessage();
const {
  genreOptions,
  distanceRange,
  isLoading: isLoadingOptions,
  errorMessage: optionsErrorMessage,
  hasConditionOptions,
  loadConditionOptions
} = useRouteConditionOptions();

// 初回描画前に読み込み中の状態へ入れるため、setup内で取得を開始する
loadConditionOptions();

/**
 * @description 選択されたジャンルを、表示名と合わせてストアへ保存する。
 * 表示名はルート作成APIへ送る値のため、選択肢を持つこの画面で引き当てる。
 * @param {string} value 選択されたジャンルの値（genreId）
 * @returns {void}
 */
const handleSelectGenre = (value) => {
  const selectedOption = genreOptions.value.find(
    (option) => option.value === value
  );

  routeStore.selectGenre(value, selectedOption?.label ?? '');
};

/**
 * @description 条件を検証してルートを作成し、成功時は提案画面へ進む。
 * 未選択の場合、および作成に失敗した場合は画面上部のポップアップで知らせる。
 * @returns {Promise<void>}
 */
const handleCreateRoute = async () => {
  if (!routeStore.hasRequiredConditions) {
    showMessage('ジャンルを選択するか、おまかせを選んでください');
    return;
  }

  const isSucceeded = await createRoute();

  if (!isSucceeded) {
    showMessage(creationErrorMessage.value ?? 'ルートの作成に失敗しました');
    return;
  }

  // おまかせで選ばれた条件は提案画面で表示する
  router.push({ name: 'route-suggestion' });
};

/**
 * @description ログアウトしてログイン画面へ戻る。
 * 次に使う人へ前の利用者の入力条件が残らないよう、ストアも初期化する。
 * @returns {Promise<void>}
 */
const handleSignOut = async () => {
  await authStore.signOut();
  routeStore.resetConditions();

  router.push({ name: 'login' });
};
</script>

<template>
  <RouteLoadingOverlay v-if="isCreating" />

  <DefaultLayout v-else>
    <template #background>
      <div class="header-bg" />
    </template>

    <BaseToast
      v-if="toastMessage"
      :message="toastMessage"
      @close="hideMessage"
    />
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

      <SignOutMenu
        class="header-menu"
        @sign-out="handleSignOut"
      />
    </div>

    <h2 class="section-title">
      お散歩ルートを作成
    </h2>

    <p
      v-if="isLoadingOptions"
      class="hint"
      role="status"
    >
      条件を読み込み中...
    </p>

    <template v-else-if="hasConditionOptions">
      <RouteConditionForm
        :genre="routeStore.genre"
        :distance-km="routeStore.distanceKm"
        :is-genre-random="routeStore.isGenreRandom"
        :is-distance-random="routeStore.isDistanceRandom"
        :genre-options="genreOptions"
        :distance-range="distanceRange"
        @select-genre="handleSelectGenre"
        @select-distance="routeStore.selectDistance"
        @toggle-genre-random="routeStore.toggleGenreRandom"
        @toggle-distance-random="routeStore.toggleDistanceRandom"
      />

      <!-- 未選択でも押せるようにし、押下時にポップアップで不足を知らせる -->
      <BaseButton @click="handleCreateRoute">
        ルートを作成
      </BaseButton>
    </template>

    <template v-else>
      <p
        v-if="optionsErrorMessage"
        class="hint"
        role="alert"
      >
        {{ optionsErrorMessage }}
      </p>

      <BaseButton
        variant="secondary"
        @click="loadConditionOptions"
      >
        再読み込み
      </BaseButton>
    </template>
  </DefaultLayout>
</template>

<style scoped>
/* ロゴの右側の余白へ寄せ、ヘッダーの右上に置く */
.header-menu {
  margin-left: auto;
}
</style>
