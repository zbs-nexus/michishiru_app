<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import logoImage from '@/assets/images/logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import WalkResultStats from '@/components/feature/walk/WalkResultStats.vue';
import { useToastMessage } from '@/composables/useToastMessage';
import { useWalkResultSave } from '@/composables/useWalkResultSave';
import { useRouteStore } from '@/stores/routeStore';
import { MEASUREMENT_STATUS, useWalkStore } from '@/stores/walkStore';

/**
 * @description 散歩結果を表示する画面。
 * 集計値は案内中に計測した実績（walkStore）から表示する。
 * ルート作成時の予測値は使わない。
 *
 * 実績のサーバーへの保存もこの画面で起こす。案内画面で起こすと、`router.push` の
 * 直後に案内画面が破棄され、保存の成否を結果画面から読めなくなる。
 * この画面で起こせば、保存の起点と結果の表示先が同じコンポーネントに収まる。
 * 案内画面側は `endWalk()` → `push` だけなので、保存を一切待たない。
 */
const router = useRouter();
const routeStore = useRouteStore();
const walkStore = useWalkStore();
const {
  message: toastMessage,
  showMessage,
  hideMessage
} = useToastMessage();
// 保存中であることは画面に出さないため isSaving は受け取らない。
// 実績は既に確定していて利用者の操作を待たせる必要がなく、
// スピナーを出すとかえって失敗したように見える
const { saveErrorMessage, saveCurrentWalkResult } = useWalkResultSave();

/**
 * 計測状態に応じた注記。注記が不要な場合はnull。
 * 数値そのものは計測状態にかかわらず常に表示し、測れた分だけを見せたうえで
 * 足りない可能性をこの注記で補う
 */
const measurementNote = computed(() => {
  if (walkStore.measurementStatus === MEASUREMENT_STATUS.UNAVAILABLE) {
    return '位置情報を取得できなかったため、実績を計測できませんでした';
  }

  if (walkStore.measurementStatus === MEASUREMENT_STATUS.PARTIAL) {
    return '一部の区間を計測できなかったため、実際より短く表示されている可能性があります';
  }

  return null;
});

// 描画された時点のストアには確定した実績が入っている（endWalk は遷移前に呼ばれる）。
// 「ホームに戻る」の resetWalk() より前に送る内容を確定させるため、ここで起こす
onMounted(async () => {
  const isSucceeded = await saveCurrentWalkResult();

  if (!isSucceeded) {
    showMessage(saveErrorMessage.value ?? '実績を保存できませんでした');
  }
});

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
    <BaseToast
      v-if="toastMessage"
      :message="toastMessage"
      @close="hideMessage"
    />

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
        v-if="measurementNote"
        class="hint"
        role="status"
      >
        {{ measurementNote }}
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
