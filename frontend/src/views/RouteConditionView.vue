<script setup>
import { useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteConditionForm from '@/components/feature/route/RouteConditionForm.vue';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import { useRouteCreation } from '@/composables/useRouteCreation';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description ルート作成条件を入力する画面。
 * 入力値はストアへ保存し、作成処理はcomposableへ委譲する。
 */
const router = useRouter();
const routeStore = useRouteStore();
const { isCreating, errorMessage, createRoute } = useRouteCreation();

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

    <RouteConditionForm
      :purpose="routeStore.purpose"
      :category="routeStore.category"
      :distance="routeStore.distance"
      @select-purpose="routeStore.selectPurpose"
      @select-category="routeStore.selectCategory"
      @select-distance="routeStore.selectDistance"
    />

    <p
      v-if="!routeStore.hasRequiredConditions"
      class="hint"
      role="status"
    >
      目的とカテゴリを選択してください
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
  </DefaultLayout>
</template>
