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

/**
 * @description ルート作成条件を入力する画面。
 * 選択肢の取得と作成処理はcomposableへ委譲し、入力値はストアへ保存する。
 */
const router = useRouter();
const authStore = useAuthStore();
const mascotStore = useMascotStore();
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
};

/**
 * @description 条件を検証してルートを作成し、成功時は提案画面へ進む。
 * 未選択の場合、および作成に失敗した場合は画面上部のポップアップで知らせる。
 * @returns {Promise<void>}
 */
const handleCreateRoute = async () => {
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
 * @description ログアウトしてログイン画面へ戻る。
 * 次に使う人へ前の利用者の入力条件が残らないよう、ストアも初期化する。
 * @returns {Promise<void>}
 */
const handleSignOut = async () => {
  await authStore.signOut();
  routeStore.resetConditions();
  // 次の利用者に前の人のレベル・経験値が出ないようにする
  mascotStore.resetExperience();

  router.push({ name: 'login' });
};
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
      v-if="mascotStore.isExperienceLoaded && !isLoadingOptions"
      class="home-mascot"
      :message="mascotMessage"
      :variant="mascotMessageVariant"
      :level="mascotStore.mascotLevel"
      placement="side"
      size="medium"
      has-level-label
    >
      <!-- 実績を取得できたときだけ経験値バーを出す（失敗時はLv.1でバー無し） -->
      <template
        v-if="mascotStore.hasExperience"
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
        @select-genre="handleSelectGenre"
        @select-distance="routeStore.selectDistance"
        @toggle-genre-random="routeStore.toggleGenreRandom"
        @toggle-distance-random="routeStore.toggleDistanceRandom"
      />

      <!--
        未選択でも押せるようにし、押下時にポップアップで不足を知らせる。
        画面の下端に固定して、条件を見ながらいつでも押せるようにする。
      -->
      <BaseButton
        is-full-width
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
