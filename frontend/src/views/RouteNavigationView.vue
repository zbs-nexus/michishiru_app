<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseModal from '@/components/base/BaseModal.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteNavigationMap from '@/components/feature/route/RouteNavigationMap.vue';
import RouteNextSpotBanner from '@/components/feature/route/RouteNextSpotBanner.vue';
import ReviewPostForm from '@/components/feature/review/ReviewPostForm.vue';
import { useLocationTracking } from '@/composables/useLocationTracking';
import { useRouteProgress } from '@/composables/useRouteProgress';
import { useGenreOptions } from '@/composables/useGenreOptions';
import { useReviewPosting } from '@/composables/useReviewPosting';
import { useMyReviews } from '@/composables/useMyReviews';
import { useToastMessage } from '@/composables/useToastMessage';
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

// 口コミの場所解決と投稿
const {
  existingSpot,
  isOwner,
  userRating,
  existingPhotos,
  isResolving,
  isPosting,
  errorMessage: reviewErrorMessage,
  resolve: resolveReviewSpot,
  post: postReviewContent,
  reset: resetReview
} = useReviewPosting();

// 自分が投稿した口コミ（地図のオレンジピン）
const { myReviews, loadMyReviews } = useMyReviews();

/** 自分の口コミのオレンジピンを表示するか（既定は表示） */
const showMyReviews = ref(true);

// 画面上部に出す一時メッセージ（投稿成功・エラー）
const {
  message: toastMessage,
  variant: toastVariant,
  showMessage,
  hideMessage
} = useToastMessage();

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
  // 自分の口コミをオレンジピンで出すために取得する
  loadMyReviews();
});

/**
 * @description 自分の口コミのオレンジピンの表示/非表示を切り替える
 * @returns {void}
 */
const toggleMyReviews = () => {
  showMyReviews.value = !showMyReviews.value;
};

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
  // 前の場所のメッセージ・解決結果を持ち越さない
  hideMessage();
  resetReview();

  isReviewFormVisible.value = true;

  // フォームが描画されてから高さを測る
  await nextTick();
  pinOffsetY.value = measureVisibleCenterOffsetY();

  reviewPin.value = position;

  // 投稿済みの場所なら名前・ジャンルを固定し評価のみにするため、先に解決する
  const isResolved = await resolveReviewSpot(position);

  if (!isResolved) {
    showMessage(reviewErrorMessage.value ?? '場所の確認に失敗しました');
  }
};

/**
 * @description オレンジピンをタップしたとき、その場所の口コミフォーム（本人編集）を開く
 * @param {{lng: number, lat: number}} position タップした場所の座標
 * @returns {Promise<void>}
 */
const handleSelectMyReview = (position) => handleLongPressMap(position);

/**
 * @description 口コミ投稿フォームを閉じ、立てたピンを消す
 * @returns {void}
 */
const handleCloseReview = () => {
  isReviewFormVisible.value = false;
  reviewPin.value = null;
  resetReview();
};

/**
 * @description 口コミを投稿する。
 * 成功したらフォームを閉じて知らせ、失敗したらフォームを残してエラーを出す。
 * @param {{spotName: string|null, genreId: string|null, genreName: string|null, rating: number}} review 投稿内容
 * @returns {Promise<void>}
 */
const handleSubmitReview = async (review) => {
  const result = await postReviewContent({ position: reviewPin.value, ...review });

  if (result === null) {
    showMessage(reviewErrorMessage.value ?? '口コミの投稿に失敗しました');
    return;
  }

  handleCloseReview();
  showMessage('口コミを投稿しました', 'success');
  // 新規・編集を地図のオレンジピンへ反映する
  loadMyReviews();
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
    <BaseToast
      v-if="toastMessage"
      :message="toastMessage"
      :variant="toastVariant"
      @close="hideMessage"
    />

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
      :my-review-spots="myReviews"
      :show-my-reviews="showMyReviews"
      @long-press-map="handleLongPressMap"
      @select-my-review="handleSelectMyReview"
    />

    <button
      class="my-reviews-toggle"
      :class="{ 'is-on': showMyReviews }"
      type="button"
      :aria-pressed="showMyReviews"
      @click="toggleMyReviews"
    >
      <span class="my-reviews-toggle-dot" />
      自分の口コミ
    </button>

    <ReviewPostForm
      v-if="isReviewFormVisible"
      ref="reviewFormRef"
      :genre-options="genreOptions"
      :pin-position="reviewPin"
      :existing-spot="existingSpot"
      :is-owner="isOwner"
      :initial-rating="userRating"
      :existing-photos="existingPhotos"
      :is-resolving="isResolving"
      :is-posting="isPosting"
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

/*
 * 自分の口コミピンの表示切り替えボタン。
 * 次の目的地バナー（top: 12px・中央）とズームコントロール（右上）に重ならないよう左上に置く。
 */
.my-reviews-toggle {
  position: fixed;
  top: 84px;
  left: 12px;
  z-index: 45;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-gray);
  background: var(--white);
  border: none;
  border-radius: 999px;
  box-shadow: var(--shadow);
  cursor: pointer;
}

.my-reviews-toggle.is-on {
  color: var(--text-dark);
}

.my-reviews-toggle-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #D8DEE4;
}

/* オン状態はオレンジの丸でピンの色と対応づける */
.my-reviews-toggle.is-on .my-reviews-toggle-dot {
  background: #F39C12;
}
</style>
