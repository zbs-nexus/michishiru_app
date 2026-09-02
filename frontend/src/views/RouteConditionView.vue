<script setup>
import { useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteConditionForm from '@/components/feature/route/RouteConditionForm.vue';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import { useRouteConditionOptions } from '@/composables/useRouteConditionOptions';
import { useRouteCreation } from '@/composables/useRouteCreation';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description ルート作成条件を入力する画面。
 * 選択肢の取得と作成処理はcomposableへ委譲し、入力値はストアへ保存する。
 */
const router = useRouter();
const routeStore = useRouteStore();
const { isCreating, errorMessage, createRoute } = useRouteCreation();
const {
  purposeOptions,
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
 * @description 条件を検証してルートを作成し、成功時は提案画面へ進む
 * @returns {Promise<void>}
 */
const handleCreateRoute = async () => {
  if (!routeStore.hasRequiredConditions) {
    return;
  }

  const isSucceeded = await createRoute();

  if (isSucceeded) {
    router.push({ name: 'route-suggestion' });
  }
};
</script>

<template>
  <RouteLoadingOverlay v-if="isCreating" />

  <DefaultLayout v-else>
    <template #background>
      <div class="header-bg" />
    </template>

    <div
      class="deploy-test-banner"
      style="background:#ffeb3b;color:#111;text-align:center;padding:10px;font-weight:bold;border-radius:8px;margin:8px 0;"
    >
      デプロイテスト５
    </div>

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
        :purpose="routeStore.purpose"
        :genre="routeStore.genre"
        :distance-km="routeStore.distanceKm"
        :purpose-options="purposeOptions"
        :genre-options="genreOptions"
        :distance-range="distanceRange"
        @select-purpose="routeStore.selectPurpose"
        @select-genre="routeStore.selectGenre"
        @select-distance="routeStore.selectDistance"
      />

      <p
        v-if="!routeStore.hasRequiredConditions"
        class="hint"
        role="status"
      >
        目的とジャンルを選択してください
      </p>

      <p
        v-if="errorMessage"
        class="hint"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <BaseButton
        :is-disabled="!routeStore.hasRequiredConditions"
        @click="handleCreateRoute"
      >
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
