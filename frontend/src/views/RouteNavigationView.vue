<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseModal from '@/components/base/BaseModal.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteNavigationMap from '@/components/feature/route/RouteNavigationMap.vue';
import RouteNextSpotBanner from '@/components/feature/route/RouteNextSpotBanner.vue';
import { useLocationTracking } from '@/composables/useLocationTracking';
import { useRouteProgress } from '@/composables/useRouteProgress';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description ルート案内を表示する画面。
 * 現在地の追跡はここで開始し、地図と次の目的地バナーの両方へ渡す。
 * 追跡を1か所にまとめることで、watchPositionが二重に動くのを防ぐ。
 * 終了時は確認モーダルを挟んでから結果画面へ進む。
 */
const router = useRouter();
const routeStore = useRouteStore();

/** 終了確認モーダルを表示するかどうか */
const isEndConfirmVisible = ref(false);

const {
  currentLocation,
  heading,
  accuracy,
  isTracking,
  trackingError,
  startTracking
} = useLocationTracking();

/** 案内対象のスポット。巡る順に並んでいる */
const spots = computed(() => routeStore.currentRoute?.spots ?? []);

const { nextSpot, distanceToNextM, isCompleted } = useRouteProgress({
  spots,
  currentLocation,
  accuracy
});

// 追跡の停止はuseLocationTracking側で画面の破棄時に行われる
onMounted(() => {
  startTracking();
});

/**
 * @description 終了確認を表示する
 * @returns {void}
 */
const handleRequestEnd = () => {
  isEndConfirmVisible.value = true;
};

/**
 * @description 終了確認を閉じて案内へ戻る
 * @returns {void}
 */
const handleCancelEnd = () => {
  isEndConfirmVisible.value = false;
};

/**
 * @description 案内を終了して結果画面へ進む
 * @returns {void}
 */
const handleConfirmEnd = () => {
  isEndConfirmVisible.value = false;
  router.push({ name: 'walk-result' });
};
</script>

<template>
  <DefaultLayout
    v-if="routeStore.currentRoute"
    :has-content-padding="false"
  >
    <RouteNextSpotBanner
      :spot-name="nextSpot?.name ?? null"
      :distance-to-next-m="distanceToNextM"
      :is-completed="isCompleted"
    />

    <RouteNavigationMap
      :geometry="routeStore.currentRoute.geometry"
      :spots="spots"
      :current-location="currentLocation"
      :current-heading="heading"
      :current-accuracy="accuracy"
      :is-tracking="isTracking"
      :tracking-error="trackingError"
    />

    <template #footer>
      <BaseButton
        is-full-width
        @click="handleRequestEnd"
      >
        終 了
      </BaseButton>

      <BaseModal
        v-if="isEndConfirmVisible"
        message="案内を終了しますか？"
        confirm-label="終了する"
        @confirm="handleConfirmEnd"
        @cancel="handleCancelEnd"
      />
    </template>
  </DefaultLayout>
</template>
