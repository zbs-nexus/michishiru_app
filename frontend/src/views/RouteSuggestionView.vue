<script setup>
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteInfoCard from '@/components/feature/route/RouteInfoCard.vue';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import RouteMapPreview from '@/components/feature/route/RouteMapPreview.vue';
import { useRouteCreation } from '@/composables/useRouteCreation';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description 提案されたルートを確認する画面。
 * 決定で詳細へ進み、再作成で同じ条件のまま作り直す。
 */
const router = useRouter();
const routeStore = useRouteStore();
const { isCreating, errorMessage, createRoute } = useRouteCreation();

/**
 * @description 提案を確定して詳細画面へ進む
 * @returns {void}
 */
const handleConfirm = () => {
  router.push({ name: 'route-detail' });
};

/**
 * @description 同じ条件でルートを作り直す
 * @returns {Promise<void>}
 */
const handleRegenerate = async () => {
  await createRoute();
};
</script>

<template>
  <RouteLoadingOverlay v-if="isCreating" />

  <DefaultLayout
    v-else-if="routeStore.currentRoute"
    :has-content-padding="false"
  >
    <div class="content">
      <h2 class="page-title">
        おすすめルート
      </h2>

      <RouteMapPreview :waypoints="routeStore.currentRoute.waypoints" />

      <RouteInfoCard
        :route-name="routeStore.currentRoute.routeName"
        :description="routeStore.currentRoute.description"
        :duration="routeStore.currentRoute.duration"
      />

      <p
        v-if="errorMessage"
        class="hint"
        role="alert"
      >
        {{ errorMessage }}
      </p>
    </div>

    <template #footer>
      <div class="bottom-actions">
        <div class="distance-display">
          <span class="label">距離</span>
          <span class="value">
            {{ routeStore.currentRoute.distance.toFixed(1) }}<small>km</small>
          </span>
        </div>
        <div class="action-buttons">
          <BaseButton @click="handleConfirm">
            決定
          </BaseButton>
          <BaseButton
            variant="secondary"
            @click="handleRegenerate"
          >
            再作成
          </BaseButton>
        </div>
      </div>
    </template>
  </DefaultLayout>
</template>
