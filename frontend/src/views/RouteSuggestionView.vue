<script setup>
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteInfoCard from '@/components/feature/route/RouteInfoCard.vue';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import RouteMapPreview from '@/components/feature/route/RouteMapPreview.vue';
import { useRouteCreation } from '@/composables/useRouteCreation';
import { useToastMessage } from '@/composables/useToastMessage';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description 提案されたルートを確認する画面。
 * 決定で案内へ進み、再作成で同じ条件のまま作り直す。
 */
const router = useRouter();
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

/**
 * @description 提案を確定して案内画面へ進む。
 * 詳細画面は挟まず、決定した時点で案内を開始する。
 * @returns {void}
 */
const handleConfirm = () => {
  router.push({ name: 'route-navigation' });
};

/**
 * @description 同じ条件でルートを作り直す。
 * 失敗した場合はホーム画面と同じく画面上部のポップアップで知らせ、
 * 直前に提案していたルートはそのまま表示し続ける。
 * @returns {Promise<void>}
 */
const handleRegenerate = async () => {
  // 前回の失敗メッセージが残ったままロード表示へ入らないように消す
  hideMessage();

  const isSucceeded = await createRoute();

  if (!isSucceeded) {
    showMessage(creationErrorMessage.value ?? 'ルートの再作成に失敗しました');
  }
};
</script>

<template>
  <RouteLoadingOverlay v-if="isCreating" />

  <DefaultLayout
    v-else-if="routeStore.currentRoute"
    :has-content-padding="false"
  >
    <BaseToast
      v-if="toastMessage"
      :message="toastMessage"
      @close="hideMessage"
    />

    <div class="content">
      <h2 class="page-title">
        おすすめルート
      </h2>

      <RouteMapPreview
        :geometry="routeStore.currentRoute.geometry"
        :spots="routeStore.currentRoute.spots"
      />

      <RouteInfoCard
        :route-name="routeStore.currentRoute.routeName"
        :description="routeStore.currentRoute.description"
        :duration-minutes="routeStore.currentRoute.durationMinutes"
      />
    </div>

    <template #footer>
      <div class="bottom-actions">
        <div class="distance-display">
          <span class="label">距離</span>
          <span class="value">
            {{ routeStore.currentRoute.distanceKm.toFixed(1) }}<small>km</small>
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
