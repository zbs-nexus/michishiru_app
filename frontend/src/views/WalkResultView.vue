<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import WalkResultStats from '@/components/feature/walk/WalkResultStats.vue';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description 散歩結果を表示する画面。
 * 集計値は歩いたルートの情報から算出する。
 */
const router = useRouter();
const routeStore = useRouteStore();

/** 巡った経由地の数 */
const waypointCount = computed(() => routeStore.currentRoute?.waypoints.length ?? 0);

/**
 * @description 条件をリセットして条件入力画面へ戻る
 * @returns {void}
 */
const handleReturnHome = () => {
  routeStore.resetConditions();
  router.push({ name: 'route-condition' });
};
</script>

<template>
  <DefaultLayout
    v-if="routeStore.currentRoute"
    :has-content-padding="false"
  >
    <div class="result-content">
      <div class="confetti" />
      <div class="result-logo">
        <img
          :src="logoImage"
          alt="ミチシル"
          width="80"
          height="80"
        >
        <div class="sparkles">
          ✨
        </div>
      </div>
      <h2>お疲れさまでした</h2>

      <WalkResultStats
        :distance="routeStore.currentRoute.distance"
        :waypoint-count="waypointCount"
        :duration="routeStore.currentRoute.duration"
      />
    </div>

    <template #footer>
      <BaseButton
        is-full-width
        @click="handleReturnHome"
      >
        ホームに戻る
      </BaseButton>
    </template>
  </DefaultLayout>
</template>
