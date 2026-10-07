<script setup>
import { useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import WalkResultStats from '@/components/feature/walk/WalkResultStats.vue';
import { useRouteStore } from '@/stores/routeStore';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description 散歩結果を表示する画面。
 * 集計値は案内中に計測した実績（walkStore）から表示する。
 * ルート作成時の予測値は使わない。
 */
const router = useRouter();
const routeStore = useRouteStore();
const walkStore = useWalkStore();

/**
 * @description 条件と実績をリセットして条件入力画面へ戻る
 * @returns {void}
 */
const handleReturnHome = () => {
  routeStore.resetConditions();
  walkStore.resetWalk();
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
        :distance-km="walkStore.totalDistanceKm"
        :spot-count="walkStore.spotCount"
        :duration-minutes="walkStore.elapsedMinutes"
      />

      <p
        v-if="!walkStore.hasLocationFix"
        class="hint"
        role="status"
      >
        位置情報を取得できなかったため、実績を計測できませんでした
      </p>
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
