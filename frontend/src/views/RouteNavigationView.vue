<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseModal from '@/components/base/BaseModal.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteNavigationMap from '@/components/feature/route/RouteNavigationMap.vue';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description ルート案内を表示する画面。
 * 終了時は確認モーダルを挟んでから結果画面へ進む。
 */
const router = useRouter();
const routeStore = useRouteStore();

/** 終了確認モーダルを表示するかどうか */
const isEndConfirmVisible = ref(false);

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
    <RouteNavigationMap :waypoints="routeStore.currentRoute.waypoints" />

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
