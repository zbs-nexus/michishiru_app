<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';
import RouteInfoCard from '@/components/feature/route/RouteInfoCard.vue';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import RouteMapPreview from '@/components/feature/route/RouteMapPreview.vue';
import TutorialSpotlight from '@/components/feature/tutorial/TutorialSpotlight.vue';
import { useRouteCreation } from '@/composables/useRouteCreation';
import { useToastMessage } from '@/composables/useToastMessage';
import { useMascotStore } from '@/stores/mascotStore';
import { useRouteStore } from '@/stores/routeStore';
import { useTutorialStore } from '@/stores/tutorialStore';

/**
 * @description 提案されたルートを確認する画面。
 * 決定で案内へ進み、再作成で同じ条件のまま作り直し、ホームに戻るで条件入力へ戻る。
 */
const router = useRouter();
const mascotStore = useMascotStore();
const routeStore = useRouteStore();
const tutorialStore = useTutorialStore();
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

onMounted(() => {
  // ホーム画面から作成して遷移してきたときに知らせる
  showRandomSelectionMessage();

  // 通常はホームで取得済みだが、この画面へ直接来た場合（リロード等）に備えて
  // 取得できていなければ起こす。loadExperience は何度呼んでも同じ結果になる
  if (!mascotStore.isExperienceLoaded) {
    mascotStore.loadExperience();
  }
});

/**
 * @description 提案を確定して案内画面へ進む。
 * 詳細画面は挟まず、決定した時点で案内を開始する。
 * @returns {void}
 */
const handleConfirm = () => {
  // チュートリアル中は、決定で案内の最初のステップ（次の目的地へ）へ進める
  if (tutorialStore.isStep(tutorialStore.STEP.CONFIRM_ROUTE)) {
    tutorialStore.completeStep(tutorialStore.STEP.CONFIRM_ROUTE);
  }

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

/**
 * @description 提案を採用せずにホーム画面へ戻る。
 * 検索条件はストアに残るため、戻った先で条件を変えて作り直せる。
 * @returns {void}
 */
const handleBackToHome = () => {
  router.push({ name: 'route-condition' });
};
</script>

<template>
  <!-- 再作成中のロード画面。ホーム経由のときと同じ見え方にするため同じ値を渡す -->
  <RouteLoadingOverlay
    v-if="isCreating"
    :mascot-level="mascotStore.mascotLevel"
  />

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

    <div class="content suggestion-content">
      <h2 class="page-title">
        おすすめルート
      </h2>

      <!--
        チュートリアル中の案内役。通常マスコットの定位置が無いため、
        見出しの下・地図の上の空き場所に流し込みで置く（地図やボタンに重ねない）。
        レベル表示・経験値バーは出さず、案内の文言だけを話す。
      -->
      <MascotSpeechBubble
        v-if="tutorialStore.isActive && tutorialStore.currentMessage"
        class="tutorial-mascot-inline"
        :message="tutorialStore.currentMessage"
        :level="mascotStore.mascotLevel"
        placement="side"
        size="small"
      />

      <RouteMapPreview
        :geometry="routeStore.currentRoute.geometry"
        :spots="routeStore.currentRoute.spots"
      />

      <RouteInfoCard
        :route-name="routeStore.currentRoute.routeName"
        :description="routeStore.currentRoute.description"
        :duration-minutes="routeStore.currentRoute.durationMinutes"
        :mascot-level="mascotStore.mascotLevel"
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
          <!-- チュートリアル中は「決定」だけハイライトして押せるようにする -->
          <TutorialSpotlight
            :is-active="tutorialStore.isActive"
            :is-highlighted="tutorialStore.isStep(tutorialStore.STEP.CONFIRM_ROUTE)"
          >
            <BaseButton @click="handleConfirm">
              決定
            </BaseButton>
          </TutorialSpotlight>
          <!-- 再作成・ホームに戻るはチュートリアルを一本道にするためロックする -->
          <TutorialSpotlight
            :is-active="tutorialStore.isActive"
            :is-highlighted="false"
          >
            <BaseButton
              variant="secondary"
              @click="handleRegenerate"
            >
              再作成
            </BaseButton>
          </TutorialSpotlight>
          <TutorialSpotlight
            :is-active="tutorialStore.isActive"
            :is-highlighted="false"
          >
            <BaseButton
              variant="secondary"
              @click="handleBackToHome"
            >
              ホームに戻る
            </BaseButton>
          </TutorialSpotlight>
        </div>
      </div>
    </template>

  </DefaultLayout>
</template>

<style scoped>
/*
 * 見出し・地図・紹介文を縦に並べ、地図に残りの高さをすべて渡す。
 * 端末の高さが変わっても、紹介文と下部のボタンを出したまま地図だけが伸び縮みする。
 * 紹介文が長い場合は、地図が下限まで縮んで紹介文に高さを譲る。
 * 下限まで縮んでも入りきらない分だけ、紹介文の説明の中をスクロールさせる（RouteInfoCard）。
 */
.suggestion-content {
  display: flex;
  flex-direction: column;
}

/* チュートリアルの案内役。見出しと地図の間に流し込みで置き、下に余白を取る */
.tutorial-mascot-inline {
  flex-shrink: 0;
  margin-bottom: calc(6px + var(--fit) * 8);
}

/*
 * 地図の枠（RouteMapPreview のルート要素）。
 * 下限は、ルート全体を収める余白（MAP_FIT_PADDING_PX の上下40px）を取っても
 * 線が見える高さにしている。高い画面ほど下限も上げ、長い紹介文に地図が押し潰されないようにする。
 */
.suggestion-content .map-preview {
  flex: 1 1 0;
  min-height: calc(150px + var(--fit) * 100);
}
</style>
