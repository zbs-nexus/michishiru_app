<script setup>
import { computed, onMounted } from 'vue';
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
  variant: toastVariant,
  showMessage,
  hideMessage
} = useToastMessage();

/**
 * おまかせで選ばれた条件の案内文。おまかせを使っていない場合はnull。
 * ルートごとに持つため、再作成で選び直されると表示も切り替わる。
 */
const randomSelectionMessage = computed(() => {
  const route = routeStore.currentRoute;
  const parts = [];

  if (route?.selectedGenres?.length) {
    parts.push(`ジャンル: ${route.selectedGenres.map((genre) => genre.genreName).join('・')}`);
  }

  if (route?.selectedDistanceKm !== null && route?.selectedDistanceKm !== undefined) {
    parts.push(`距離: ${route.selectedDistanceKm}km`);
  }

  // トーストに「おまかせ」のラベルが付くため、本文は選ばれた内容だけにする
  return parts.length > 0 ? `${parts.join(' / ')} で選びました` : null;
});

/**
 * @description おまかせで選ばれた条件があればトーストで知らせる
 * @returns {void}
 */
const showRandomSelectionMessage = () => {
  if (randomSelectionMessage.value) {
    showMessage(randomSelectionMessage.value, 'omakase');
  }
};

// ホーム画面から作成して遷移してきたときに知らせる
onMounted(showRandomSelectionMessage);

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
    return;
  }

  // 再作成ではおまかせで選び直されるため、新しい値を知らせる
  showRandomSelectionMessage();
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
      :variant="toastVariant"
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
