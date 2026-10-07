<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseModal from '@/components/base/BaseModal.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteNavigationMap from '@/components/feature/route/RouteNavigationMap.vue';
import RouteNextSpotBanner from '@/components/feature/route/RouteNextSpotBanner.vue';
import { useLocationTracking } from '@/composables/useLocationTracking';
import { useRouteProgress } from '@/composables/useRouteProgress';
import { useWalkRecord } from '@/composables/useWalkRecord';
import { useRouteStore } from '@/stores/routeStore';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description ルート案内を表示する画面。
 * 現在地の追跡はここで開始し、地図と次の目的地バナーの両方へ渡す。
 * 追跡を1か所にまとめることで、watchPositionが二重に動くのを防ぐ。
 * 終了時は確認モーダルを挟んでから結果画面へ進む。
 */
const router = useRouter();
const routeStore = useRouteStore();
const walkStore = useWalkStore();

/** 終了確認モーダルを表示するかどうか */
const isEndConfirmVisible = ref(false);

const {
  currentLocation,
  accuracy,
  isTracking,
  trackingError,
  startTracking
} = useLocationTracking();

/** 案内対象のスポット。巡る順に並んでいる */
const spots = computed(() => routeStore.currentRoute?.spots ?? []);

/** 経路の形。次の目的地までの距離を道に沿って測るために渡す */
const geometry = computed(() => routeStore.currentRoute?.geometry ?? null);

const { nextSpot, distanceToNextM, visitedSpotIds, isCompleted } = useRouteProgress({
  spots,
  currentLocation,
  accuracy,
  geometry
});

// 距離の積算は公開する状態を持たず、現在地のwatchでwalkStoreへ直接書き込む
useWalkRecord({ currentLocation, accuracy });

// 到達状況をストアへ写し、結果画面でも巡ったスポット数が読めるようにする。
// useRouteProgressは配列を丸ごと差し替えるためdeepは不要
watch(visitedSpotIds, (spotIds) => {
  walkStore.setVisitedSpotIds(spotIds);
});

// 追跡の停止はuseLocationTracking側で画面の破棄時に行われる
onMounted(() => {
  // 初期化は追跡より先に行う。順序が逆だと初回の測位で積んだ距離がリセットで消える
  walkStore.startWalk();
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
  // 結果画面が所要時間を読むため、遷移前に終了時刻を確定させる
  walkStore.endWalk();
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

<style scoped>
/*
 * この画面は地図が全画面に広がるため、地図右下の帰属表示（iマーク）と
 * 終了ボタンが重なる。共通の位置（global.css の bottom: 20px）は
 * 他の画面でも使うため変えず、この画面だけ上へ寄せる。
 */
.primary-btn.full-width {
  bottom: 44px;
}
</style>
