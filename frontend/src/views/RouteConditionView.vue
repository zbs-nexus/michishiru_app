<script setup>
import { useRouter } from 'vue-router';
import { computed, onMounted } from 'vue';
import logoImage from '@/assets/images/logo.png';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import SignOutMenu from '@/components/feature/auth/SignOutMenu.vue';
import MascotExperienceBar from '@/components/feature/mascot/MascotExperienceBar.vue';
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';
import RouteConditionForm from '@/components/feature/route/RouteConditionForm.vue';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import { useRouteConditionOptions } from '@/composables/useRouteConditionOptions';
import { useRouteCreation } from '@/composables/useRouteCreation';
import { useToastMessage } from '@/composables/useToastMessage';
import { useAuthStore } from '@/stores/authStore';
import { useMascotStore } from '@/stores/mascotStore';
import { useRouteStore } from '@/stores/routeStore';
import { useTutorialStore } from '@/stores/tutorialStore';
import {
  TUTORIAL_DISTANCE_KM,
  TUTORIAL_GENRE_ID,
  createTutorialRoute
} from '@/constants/tutorial';

/**
 * @description ルート作成条件を入力する画面。
 * 選択肢の取得と作成処理はcomposableへ委譲し、入力値はストアへ保存する。
 */
const router = useRouter();
const authStore = useAuthStore();
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
  showMessage,
  hideMessage
} = useToastMessage();
const {
  genreOptions,
  distanceRange,
  isLoading: isLoadingOptions,
  errorMessage: optionsErrorMessage,
  hasConditionOptions,
  loadConditionOptions
} = useRouteConditionOptions();

// 初回描画前に読み込み中の状態へ入れるため、setup内で取得を開始する
loadConditionOptions();

// マスコットのレベルのもとになる実績を取得する。
// この画面は必ず最初に通るため、ここで取っておけば以降の画面でも同じ値が読める。
// 失敗してもストア側で握るため、条件の入力は妨げない
onMounted(() => {
  mascotStore.loadExperience();
});

/**
 * マスコットが話す文言。
 * 読み込み中の案内は出さない（マスコット自体を取得完了まで出さないため）。
 * 取得が終わった後の「失敗」「入力待ち」の2状態だけを、この画面の案内役が話す。
 */
const mascotMessage = computed(() => {
  if (!hasConditionOptions.value) {
    return optionsErrorMessage.value ?? '条件をよみこめなかったみたい。もう一度ためしてね';
  }

  return 'どんなお散歩にする？ ジャンルと距離をえらんで、ぼくに教えて！';
});

/** 吹き出しの種類。条件を出せないときだけ注意として見せる */
const mascotMessageVariant = computed(() =>
  hasConditionOptions.value ? 'normal' : 'alert'
);

/**
 * 案内役が話す文言。
 * チュートリアル中は今のステップの文言を優先し、通常時はこの画面の案内文を話す。
 * 下部固定の専用部品はやめ、通常時と同じ home-mascot の位置で文言だけ切り替える。
 */
const displayMascotMessage = computed(() =>
  tutorialStore.isActive && tutorialStore.currentMessage
    ? tutorialStore.currentMessage
    : mascotMessage.value
);

/**
 * 案内役の吹き出しを出すかどうか。
 * 読み込み中（条件マスタ・実績）は出さず、両方そろってから出す。
 * チュートリアル中は条件マスタの読み込みが終わっていれば、今のステップの文言を出す。
 */
const isMascotVisible = computed(() => {
  if (isLoadingOptions.value) {
    return false;
  }

  if (tutorialStore.isActive) {
    return Boolean(tutorialStore.currentMessage);
  }

  return mascotStore.isExperienceLoaded;
});

/**
 * @description 選択されたジャンルを、表示名と合わせてストアへ保存する。
 * 表示名はルート作成APIへ送る値のため、選択肢を持つこの画面で引き当てる。
 * @param {string} value 選択されたジャンルの値（genreId）
 * @returns {void}
 */
const handleSelectGenre = (value) => {
  const selectedOption = genreOptions.value.find(
    (option) => option.value === value
  );

  routeStore.selectGenre(value, selectedOption?.label ?? '');

  // チュートリアル中は、対象のジャンル（写真）が選ばれたら距離の段階へ進める。
  // 対象以外のボタンはフォーム側で無効化しているため、ここに来るのは対象のみ
  if (tutorialStore.isStep(tutorialStore.STEP.SELECT_GENRE)) {
    tutorialStore.completeStep(tutorialStore.STEP.SELECT_GENRE);
  }
};

/**
 * @description 距離を選び、チュートリアル中はちょうど5kmになった段階で次へ進める。
 * チュートリアルでは5km以外では作成の段階へ進めず、合わせ直しを促す。
 * @param {number} value 選択された距離（km）
 * @returns {void}
 */
const handleSelectDistance = (value) => {
  routeStore.selectDistance(value);

  if (
    tutorialStore.isStep(tutorialStore.STEP.SELECT_DISTANCE) &&
    value === TUTORIAL_DISTANCE_KM
  ) {
    tutorialStore.completeStep(tutorialStore.STEP.SELECT_DISTANCE);
  }
};

/**
 * @description 条件を検証してルートを作成し、成功時は提案画面へ進む。
 * 未選択の場合、および作成に失敗した場合は画面上部のポップアップで知らせる。
 *
 * チュートリアル中はAPIを呼ばず、ダミーのルートをストアへ入れて提案画面へ進む。
 * @returns {Promise<void>}
 */
const handleCreateRoute = async () => {
  // チュートリアルはAPIを呼ばず、固定のダミールートを見せる
  if (tutorialStore.isStep(tutorialStore.STEP.CREATE_ROUTE)) {
    routeStore.setCurrentRoute(createTutorialRoute());
    tutorialStore.completeStep(tutorialStore.STEP.CREATE_ROUTE);
    router.push({ name: 'route-suggestion' });
    return;
  }

  if (!routeStore.hasRequiredConditions) {
    showMessage('ジャンルを選択するか、おまかせを選んでください');
    return;
  }

  const isSucceeded = await createRoute();

  if (!isSucceeded) {
    showMessage(creationErrorMessage.value ?? 'ルートの作成に失敗しました');
    return;
  }

  // おまかせで選ばれた条件は提案画面で表示する
  router.push({ name: 'route-suggestion' });
};

/**
 * @description メニューからチュートリアルを開始する。
 * 前の利用者やそれまでの入力が残らないよう条件を初期化してから、最初のステップへ入る。
 * @returns {void}
 */
const handleStartTutorial = () => {
  routeStore.resetConditions();
  tutorialStore.start();
};

/**
 * @description ログアウトしてログイン画面へ戻る。
 * 次に使う人へ前の利用者の入力条件が残らないよう、ストアも初期化する。
 * @returns {Promise<void>}
 */
const handleSignOut = async () => {
  await authStore.signOut();
  routeStore.resetConditions();
  // 次の利用者に前の人のレベル・経験値が出ないようにする
  mascotStore.resetExperience();
  // チュートリアル中にログアウトされても状態が残らないようにする
  tutorialStore.finish();

  router.push({ name: 'login' });
};

/**
 * チュートリアルでフォームのどの区画を操作させるか。
 * ジャンルの段階は 'genre'、距離の段階は 'distance'、作成の段階はどちらも触らせない。
 */
const tutorialFormSection = computed(() => {
  if (tutorialStore.isStep(tutorialStore.STEP.SELECT_GENRE)) {
    return 'genre';
  }

  if (tutorialStore.isStep(tutorialStore.STEP.SELECT_DISTANCE)) {
    return 'distance';
  }

  return null;
});

/** チュートリアルで「ルートを作成」ボタンをハイライトする段階かどうか */
const isTutorialCreateStep = computed(() =>
  tutorialStore.isStep(tutorialStore.STEP.CREATE_ROUTE)
);
</script>

<template>
  <!-- ロード画面はレベル名だけ添える（経験値バーは渡さない） -->
  <RouteLoadingOverlay
    v-if="isCreating"
    :mascot-level="mascotStore.mascotLevel"
  />

  <!--
    is-home は、この画面だけの見た目（見出しの扱い・下部の余白）を
    global.css の .screen.is-home から当てるための目印。
  -->
  <DefaultLayout
    v-else
    class="is-home"
  >
    <template #background>
      <div class="paper-map-bg" />
    </template>

    <BaseToast
      v-if="toastMessage"
      :message="toastMessage"
      @close="hideMessage"
    />
    <div class="logo-header">
      <div class="logo-icon">
        <img
          :src="logoImage"
          alt="ミチシル"
          width="50"
          height="50"
        >
      </div>
      <div class="logo-text">
        <h1>ミチシル</h1>
      </div>

      <SignOutMenu
        class="header-menu"
        @sign-out="handleSignOut"
        @start-tutorial="handleStartTutorial"
      />
    </div>

    <!--
      失敗・入力待ちの案内は、この画面の案内役が吹き出しで話す。
      読み込み中（条件マスタの取得中・実績の取得中）は何も出さず、両方が終わってから
      一度に出す。これにより「読み込み中」の中間表示そのものが消え、取得前のLv.1（卵）が
      ちらつくこともない。実績は失敗しても isExperienceLoaded が真になり、Lv.1 で進む。
      has-level-label で `Lv.5 まちの案内人` のようにレベルと名前を添える。
    -->
    <MascotSpeechBubble
      v-if="isMascotVisible"
      class="home-mascot"
      :message="displayMascotMessage"
      :variant="tutorialStore.isActive ? 'normal' : mascotMessageVariant"
      :level="mascotStore.mascotLevel"
      placement="side"
      size="medium"
      :has-level-label="!tutorialStore.isActive"
    >
      <!--
        実績を取得できたときだけ経験値バーを出す（失敗時はLv.1でバー無し）。
        チュートリアル中はレベル表示・バーを出さず、案内の文言だけに集中させる。
      -->
      <template
        v-if="mascotStore.hasExperience && !tutorialStore.isActive"
        #experience
      >
        <MascotExperienceBar
          :level-progress="mascotStore.levelProgress"
          :total-experience-points="mascotStore.totalExperiencePoints"
          size="medium"
        />
      </template>
    </MascotSpeechBubble>

    <h2 class="section-title">
      お散歩ルートを作成
    </h2>

    <template v-if="hasConditionOptions">
      <RouteConditionForm
        :genre="routeStore.genre"
        :distance-km="routeStore.distanceKm"
        :is-genre-random="routeStore.isGenreRandom"
        :is-distance-random="routeStore.isDistanceRandom"
        :genre-options="genreOptions"
        :distance-range="distanceRange"
        :is-tutorial="tutorialStore.isActive"
        :tutorial-section="tutorialFormSection"
        :tutorial-genre-value="TUTORIAL_GENRE_ID"
        @select-genre="handleSelectGenre"
        @select-distance="handleSelectDistance"
        @toggle-genre-random="routeStore.toggleGenreRandom"
        @toggle-distance-random="routeStore.toggleDistanceRandom"
      />

      <!--
        未選択でも押せるようにし、押下時にポップアップで不足を知らせる。
        画面の下端に固定して、条件を見ながらいつでも押せるようにする。
        チュートリアル中は、作成の段階（CREATE_ROUTE）でだけ押せるようにし、
        それ以外の段階では is-disabled で無効にする。
        TutorialSpotlight でラップしないのは、ロック時に親へかかる filter が
        包含ブロックを作り、固定表示（position: fixed）のこのボタンの位置を崩すため。
        無効表示（disabled）なら固定位置を保ったまま、作成段階以外の押下を防げる。
      -->
      <BaseButton
        is-full-width
        :is-disabled="tutorialStore.isActive && !isTutorialCreateStep"
        @click="handleCreateRoute"
      >
        ルートを作成
      </BaseButton>
    </template>

    <!-- 失敗の理由は吹き出しで伝えるため、ここは操作のみ置く -->
    <BaseButton
      v-else-if="!isLoadingOptions"
      variant="secondary"
      @click="loadConditionOptions"
    >
      再読み込み
    </BaseButton>

  </DefaultLayout>
</template>

<style scoped>
/* ロゴの右側の余白へ寄せ、ヘッダーの右上に置く */
.header-menu {
  margin-left: auto;
}

/* 見出しとの間を空け、案内役が最初に目に入るようにする */
.home-mascot {
  margin-bottom: calc(8px + var(--fit) * 18);
}
</style>
