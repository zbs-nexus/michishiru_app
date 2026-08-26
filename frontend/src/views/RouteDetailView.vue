<script setup>
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteDetailMap from '@/components/feature/route/RouteDetailMap.vue';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description 決定したルートの詳細を表示する画面。
 */
const router = useRouter();
const routeStore = useRouteStore();

/**
 * @description 案内を開始する
 * @returns {void}
 */
const handleStartNavigation = () => {
  router.push({ name: 'route-navigation' });
};
</script>

<template>
  <DefaultLayout
    v-if="routeStore.currentRoute"
    :has-content-padding="false"
  >
    <div class="content">
      <h2 class="page-title">
        ルート詳細
      </h2>

      <RouteDetailMap :waypoints="routeStore.currentRoute.waypoints" />

      <div class="route-summary">
        <span class="shoe-icon">👟</span>
        <span class="label">総距離</span>
        <span class="distance">
          {{ routeStore.currentRoute.distance.toFixed(1) }}<small>km</small>
        </span>
      </div>
    </div>

    <template #footer>
      <BaseButton
        is-full-width
        @click="handleStartNavigation"
      >
        案内開始
      </BaseButton>
    </template>
  </DefaultLayout>
</template>
