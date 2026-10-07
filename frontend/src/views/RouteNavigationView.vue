<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseModal from '@/components/base/BaseModal.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteNavigationMap from '@/components/feature/route/RouteNavigationMap.vue';
import RouteNextSpotBanner from '@/components/feature/route/RouteNextSpotBanner.vue';
import ReviewPostForm from '@/components/feature/review/ReviewPostForm.vue';
import { useLocationTracking } from '@/composables/useLocationTracking';
import { useRouteProgress } from '@/composables/useRouteProgress';
import { useGenreOptions } from '@/composables/useGenreOptions';
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

/** 長押しで立てた赤いピンの座標 { lng, lat }。未設定はnull */
const reviewPin = ref(null);

/** 口コミ投稿フォームを表示するかどうか */
const isReviewFormVisible = ref(false);

/** 次の目的地バナーの要素。可視範囲の上端を測るために参照する */
const bannerRef = ref(null);

/** 口コミ投稿フォームの要素。可視範囲の下端を測るために参照する */
const reviewFormRef = ref(null);

/** ピンを可視範囲の中央へ寄せるための、地図中央からの縦のずれ（ピクセル） */
const pinOffsetY = ref(0);

const {
  currentLocation,
  accuracy,
  isTracking,
  trackingError,
  startTracking
} = useLocationTracking();

// 口コミのジャンルはホーム画面と同じ検索条件マスタから取得する
const { genreOptions, loadGenreOptions } = useGenreOptions();

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
  // フォームを開いたときに待たせないよう、先にジャンルを取得しておく
  loadGenreOptions();
});

/**
 * @description バナーとフォームに挟まれた可視範囲の中央にピンが来るよう、
 * 地図中央からの縦のずれ（ピクセル）を求める。
 * 上端はバナーの下端、下端はフォームの高さで決まる。
 * @returns {number} 地図中央からの縦のずれ（下方向が正）
 */
const measureVisibleCenterOffsetY = () => {
  const bannerEl = bannerRef.value?.$el ?? null;
  const formEl = reviewFormRef.value?.$el ?? null;

  // 地図は画面全体に広がり上端が画面上端に一致するため、ビューポート基準で測れる
  const topInsetPx = bannerEl ? bannerEl.getBoundingClientRect().bottom : 0;
  const bottomInsetPx = formEl ? formEl.offsetHeight : 0;

  return (topInsetPx - bottomInsetPx) / 2;
};

/**
 * @description 地図の長押しでピンを立て、口コミ投稿フォームを開く。
 * フォームを先に開いてから高さを測り、可視範囲の中央にピンが来るよう
 * オフセットを決めたうえでピンを立てる。
 * @param {{lng: number, lat: number}} position 長押しされた座標
 * @returns {Promise<void>}
 */
const handleLongPressMap = async (position) => {
  isReviewFormVisible.value = true;

  // フォームが描画されてから高さを測る
  await nextTick();
  pinOffsetY.value = measureVisibleCenterOffsetY();

  reviewPin.value = position;
};

/**
 * @description 口コミ投稿フォームを閉じ、立てたピンを消す
 * @returns {void}
 */
const handleCloseReview = () => {
  isReviewFormVisible.value = false;
  reviewPin.value = null;
};

/**
 * @description 口コミの投稿を受け取る。
 * 送信などの内部処理は未実装のため、現時点では投稿内容（ReviewPostFormのsubmitReview
 * が渡す { spotName, genreId, genreName, rating }）は使わず、フォームを閉じてピンを消すだけにする。
 * @returns {void}
 */
const handleSubmitReview = () => {
  handleCloseReview();
};

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
      ref="bannerRef"
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
      :is-long-press-enabled="true"
      :pin-position="reviewPin"
      :pin-offset-y="pinOffsetY"
      @long-press-map="handleLongPressMap"
    />

    <ReviewPostForm
      v-if="isReviewFormVisible"
      ref="reviewFormRef"
      :genre-options="genreOptions"
      :pin-position="reviewPin"
      @submit-review="handleSubmitReview"
      @close="handleCloseReview"
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
