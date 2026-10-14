<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
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
import { useReviewSpots } from '@/composables/useReviewSpots';
import { useToastMessage } from '@/composables/useToastMessage';
import { MAX_MEASURABLE_ACCURACY_M, useWalkRecord } from '@/composables/useWalkRecord';
import { useScreenWakeLock } from '@/composables/useScreenWakeLock';
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

/**
 * 計測が途切れたとみなす継続時間（ミリ秒）。
 * これより短い中断では、復帰時の区間が MAX_SEGMENT_DISTANCE_M（200m）以内に収まり
 * 距離は直線で繋がるため、実質的な損失が出ない。
 * 60秒は、以前のスポット到達判定（半径40m・徒歩の通過時間 約64秒）に合わせて決めた値。
 * 現在スポットの到達はボタン操作で決めるため測位の中断の影響を受けないが、
 * 値はそのまま据え置いている。
 */
const MEASUREMENT_GAP_THRESHOLD_MS = 60000;

/** 終了確認モーダルを表示するかどうか */
const isEndConfirmVisible = ref(false);

/** 口コミフォームの対象にしている座標 { lng, lat }。未設定はnull */
const reviewTargetPosition = ref(null);

/**
 * 投稿済みのピン（オレンジ・紫）から開いたかどうか。
 * 既存の場所を選んだときは赤いピンを立てないため、長押しと区別する。
 */
const isExistingSpotSelected = ref(false);

/** 口コミ投稿フォームを表示するかどうか */
const isReviewFormVisible = ref(false);

/** 次の目的地バナーの要素。可視範囲の上端を測るために参照する */
const bannerRef = ref(null);

/** 口コミ投稿フォームの要素。可視範囲の下端を測るために参照する */
const reviewFormRef = ref(null);

/** 対象の場所を可視範囲の中央へ寄せるための、地図中央からの縦のずれ（ピクセル） */
const focusOffsetY = ref(0);

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

// 口コミが付いた場所の一覧（自分のぶんを除いて紫ピンにする）
const { reviewSpots, loadReviewSpots } = useReviewSpots();

/** 自分の口コミのオレンジピンを表示するか（既定は表示） */
const showMyReviews = ref(true);

/** 他の人の口コミの紫ピンを表示するか（既定は表示） */
const showOtherReviews = ref(true);

/**
 * 他の人の口コミの場所（紫ピン）。
 * 一覧には自分が投稿済みの場所も含まれるため、オレンジピンと重ならないよう取り除く。
 */
const otherReviewSpots = computed(() => {
  const myReviewedSpotIds = new Set(myReviews.value.map((review) => review.spotId));

  return reviewSpots.value.filter((spot) => !myReviewedSpotIds.has(spot.spotId));
});

/**
 * 赤いピンの座標。
 * 新規で口コミを投稿する場所にだけ立てるため、投稿済みのピンから開いたとき、
 * および長押しの位置に既存の場所が見つかったときは立てない。
 */
const newSpotPin = computed(() => {
  if (reviewTargetPosition.value === null || isExistingSpotSelected.value) {
    return null;
  }

  return existingSpot.value === null ? reviewTargetPosition.value : null;
});

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

const {
  nextSpot,
  distanceToNextM,
  visitedSpotIds,
  isCompleted,
  advanceToNextSpot
} = useRouteProgress({
  spots,
  currentLocation,
  geometry
});

// 距離の積算は公開する状態を持たず、現在地のwatchでwalkStoreへ直接書き込む
useWalkRecord({ currentLocation, accuracy });

// 歩行中に画面が消えると測位が止まるため、案内中は自動消灯を抑止する。
// 取得できたかどうかは画面に出さないため isScreenAwake は受け取らない。
// 解放も composable 側の onBeforeUnmount が行うため、ここでは要求だけ使う
const { requestScreenWakeLock } = useScreenWakeLock();

// 到達状況をストアへ写し、結果画面でも巡ったスポット数が読めるようにする。
// useRouteProgressは配列を丸ごと差し替えるためdeepは不要
watch(visitedSpotIds, (spotIds) => {
  walkStore.setVisitedSpotIds(spotIds);
});

/**
 * 計測が中断しているかどうか。
 *
 * 測位が届かない（trackingError）だけでなく、届いていても精度が悪くて
 * useWalkRecord が距離を積めない区間（accuracy が MAX_MEASURABLE_ACCURACY_M 超）も
 * 中断として扱う。精度が悪い測位が続く間は trackingError が null のままなので、
 * エラーだけを見ていると、実際には距離が積まれていないのに完全に計測できたことになる。
 */
const isMeasurementInterrupted = computed(
  () =>
    trackingError.value !== null ||
    (accuracy.value !== null && accuracy.value > MAX_MEASURABLE_ACCURACY_M)
);

/**
 * 測位が途切れてから欠落と判断するまでのタイマーのID。張っていない場合はnull。
 * テンプレートから参照しないため、リアクティブにせず素の変数で持つ
 */
let gapTimerId = null;

/** 画面が隠れた時刻（エポックms）。表示中はnull */
let hiddenAt = null;

/**
 * 中断していた時間の合計（ミリ秒）。
 *
 * 1回の中断ごとに判定を捨てるのではなく、散歩全体で積み上げる。
 * しきい値未満の中断を繰り返す断続的な不調（信号待ちのたびに測位が切れる等）は、
 * 復帰のたびにタイマーを捨てる形では永久に検知できなかった。
 * 合計がしきい値を超えた時点で、欠けた事実として記録する。
 *
 * 累積値そのものは他の画面から読まないため、ストアには持たせない
 */
let accumulatedGapMs = 0;

/** 中断が始まった時刻（エポックms）。中断していない場合はnull */
let interruptedAt = null;

/**
 * @description 欠落と判断するタイマーを破棄する
 * @returns {void}
 */
const clearGapTimer = () => {
  if (gapTimerId !== null) {
    clearTimeout(gapTimerId);
    gapTimerId = null;
  }
};

/**
 * @description 中断していた時間を合計へ加え、しきい値を超えていれば欠落として記録する
 * @param {number} gapMs 中断していた時間（ミリ秒）
 * @returns {void}
 */
const addMeasurementGapMs = (gapMs) => {
  accumulatedGapMs += gapMs;

  if (accumulatedGapMs >= MEASUREMENT_GAP_THRESHOLD_MS) {
    walkStore.markMeasurementGap();
  }
};

/**
 * @description 計測の中断が始まったものとして、開始時刻とタイマーを用意する。
 * 復帰しないまま案内が続く場合に備え、残り時間でタイマーを張る。
 * @returns {void}
 */
const startMeasurementInterruption = () => {
  // 記録済みならラッチなので張り直す意味がない。
  // 二重に始めると同じ実時間が2回積まれるため、開始済みの場合も何もしない
  if (
    walkStore.hasMeasurementGap ||
    gapTimerId !== null ||
    interruptedAt !== null
  ) {
    return;
  }

  interruptedAt = Date.now();

  // 既に合計がしきい値に達しているなら待つ必要がない
  const remainingMs = MEASUREMENT_GAP_THRESHOLD_MS - accumulatedGapMs;

  if (remainingMs <= 0) {
    walkStore.markMeasurementGap();
    return;
  }

  gapTimerId = setTimeout(() => {
    gapTimerId = null;
    walkStore.markMeasurementGap();
  }, remainingMs);
};

/**
 * @description 計測の中断が終わったものとして、その長さを合計へ加える
 * @returns {void}
 */
const endMeasurementInterruption = () => {
  // 長さが確定したためタイマーは不要になる
  clearGapTimer();

  if (interruptedAt !== null) {
    addMeasurementGapMs(Date.now() - interruptedAt);
    interruptedAt = null;
  }
};

// 測位のエラーは1回では欠落と判断しない。タイムアウトは10秒で、屋内や高架下では
// 普通に起きるうえ、その間に進む距離（徒歩で約12m）では距離もスポットも失われない。
// 中断の合計がしきい値を超えた場合だけ、欠けた事実として記録する
watch(isMeasurementInterrupted, (isInterrupted) => {
  if (!isInterrupted) {
    endMeasurementInterruption();

    return;
  }

  // 画面が隠れている間は非表示側で時間を数えている。ここでも数えると
  // 同じ実時間が2回積まれ、実際より早くしきい値へ到達してしまう
  if (hiddenAt !== null) {
    return;
  }

  startMeasurementInterruption();
});

/**
 * @description 画面の表示状態の変化に応じて、欠落の記録と消灯抑止の取り直しを行う
 * @returns {void}
 */
const handleVisibilityChange = () => {
  // 画面が隠れている間は測位が止まるか間隔が開く。ただし短い中断なら復帰時の区間が
  // 200m以内に収まり距離は繋がるため、この時点では欠落と決めず時刻だけ控える
  if (document.visibilityState === 'hidden') {
    // ここから先は非表示側で時間を数える。測位の中断が続いていた場合は
    // そこまでの長さを確定させ、同じ実時間を二重に積まないようにする
    endMeasurementInterruption();
    hiddenAt = Date.now();

    return;
  }

  // 復帰した時点で中断の長さが確定する。タイマーではなく実測で判定できるのは、
  // 隠れている画面の終了ボタンは押せず、復帰せずに案内が終わることがないため。
  // 測位の中断と同じ合計へ積むことで、「1回の非表示がしきい値以上」も
  // 「短い非表示の繰り返し」も同じ判定で拾える
  if (hiddenAt !== null) {
    addMeasurementGapMs(Date.now() - hiddenAt);
  }

  hiddenAt = null;

  // 戻っても測位が届いていない場合は、ここから測位側の中断として数え直す
  if (isMeasurementInterrupted.value) {
    startMeasurementInterruption();
  }

  // Wake Lock は非表示で自動解放されるため、戻ってきた時点で取り直す
  requestScreenWakeLock();
};

// 追跡の停止はuseLocationTracking側で画面の破棄時に行われる
onMounted(() => {
  // 初期化は追跡より先に行う。順序が逆だと初回の測位で積んだ距離がリセットで消える
  walkStore.startWalk();
  startTracking();
  // フォームを開いたときに待たせないよう、先にジャンルを取得しておく
  loadGenreOptions();
  // 自分の口コミをオレンジピン、他の人の口コミを紫ピンで出すために取得する
  loadMyReviews();
  loadReviewSpots();
  requestScreenWakeLock();
  document.addEventListener('visibilitychange', handleVisibilityChange);
});

// 購読やタイマーを残すと、案内画面を離れた後も欠落が記録されてしまう。
// とくにタイマーは次の散歩のストアへ書き込むため、必ず破棄する。
// Wake Lock の解放は useScreenWakeLock 側の onBeforeUnmount が行うため、ここでは呼ばない
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  clearGapTimer();
});

/**
 * @description 自分の口コミのオレンジピンの表示/非表示を切り替える
 * @returns {void}
 */
const toggleMyReviews = () => {
  showMyReviews.value = !showMyReviews.value;
};

/**
 * @description 他の人の口コミの紫ピンの表示/非表示を切り替える
 * @returns {void}
 */
const toggleOtherReviews = () => {
  showOtherReviews.value = !showOtherReviews.value;
};

/**
 * @description バナーとフォームに挟まれた可視範囲の中央に対象の場所が来るよう、
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
 * @description 指定座標を対象にして口コミ投稿フォームを開く。
 *
 * フォームを先に描画してから高さを測り、寄せ位置を決めたうえで対象を渡す。
 * 順序を入れ替えると、地図が古い高さを前提に寄ってしまう。
 * 投稿済みの場所なら名前・ジャンルを固定して評価のみにするため、先に場所を解決する。
 * @param {{lng: number, lat: number}} position 対象の座標
 * @param {boolean} isExistingSpot 投稿済みのピンから開いたかどうか
 * @returns {Promise<void>}
 */
const openReviewForm = async (position, isExistingSpot) => {
  // 前の場所のメッセージ・解決結果を持ち越さない
  hideMessage();
  resetReview();

  isExistingSpotSelected.value = isExistingSpot;
  isReviewFormVisible.value = true;

  // フォームが描画されてから高さを測る
  await nextTick();
  focusOffsetY.value = measureVisibleCenterOffsetY();

  reviewTargetPosition.value = position;

  const isResolved = await resolveReviewSpot(position);

  if (!isResolved) {
    showMessage(reviewErrorMessage.value ?? '場所の確認に失敗しました');
  }
};

/**
 * @description フォームの高さが変わったら、寄せ位置を測り直す。
 * 可視範囲が変わるため、そのままだと対象の場所がフォームに隠れる。
 * @returns {Promise<void>}
 */
const handleChangeReviewFormExpanded = async () => {
  await nextTick();
  focusOffsetY.value = measureVisibleCenterOffsetY();
};

/**
 * @description 地図の長押しで、押した場所に赤いピンを立てて投稿フォームを開く。
 *
 * ピンは押した座標に描き、地図はその座標が可視範囲の中央へ来るよう寄せる。
 * 解決の結果その場所が投稿済みだった場合は新規投稿ではないため、
 * 赤いピンは newSpotPin の判定で取り下げられる。
 * @param {{lng: number, lat: number}} position 長押しされた座標
 * @returns {Promise<void>}
 */
const handleLongPressMap = (position) => openReviewForm(position, false);

/**
 * @description 投稿済みのピン（自分=オレンジ / 他の人=紫）をタップしたとき、
 * その場所の口コミを開く。赤いピンは立てない。
 * @param {{lng: number, lat: number}} position タップした場所の座標
 * @returns {Promise<void>}
 */
const handleSelectReviewSpot = (position) => openReviewForm(position, true);

/**
 * @description 口コミ投稿フォームを閉じ、立てたピンを消す
 * @returns {void}
 */
const handleCloseReview = () => {
  isReviewFormVisible.value = false;
  reviewTargetPosition.value = null;
  isExistingSpotSelected.value = false;
  focusOffsetY.value = 0;
  resetReview();
};

/**
 * @description 口コミを投稿する。
 * 成功したらフォームを閉じて知らせ、失敗したらフォームを残してエラーを出す。
 * @param {{spotName: string|null, genreId: string|null, genreName: string|null, rating: number}} review 投稿内容
 * @returns {Promise<void>}
 */
const handleSubmitReview = async (review) => {
  const result = await postReviewContent({
    position: reviewTargetPosition.value,
    ...review
  });

  if (result === null) {
    showMessage(reviewErrorMessage.value ?? '口コミの投稿に失敗しました');
    return;
  }

  handleCloseReview();
  showMessage('口コミを投稿しました', 'success');
  // 新規・編集を地図のピン（オレンジ・紫）へ反映する
  loadMyReviews();
  loadReviewSpots();
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

    <!--
      次の目的地を切り替える唯一の手段（現在地からの自動切り替えは行わない）。
      押したスポットは巡ったものとして扱う。すべて巡った後は進める先が無いため出さない。
    -->
    <button
      v-if="nextSpot"
      class="next-spot-btn"
      type="button"
      @click="advanceToNextSpot"
    >
      次の目的地へ
    </button>

    <RouteNavigationMap
      :geometry="routeStore.currentRoute.geometry"
      :spots="spots"
      :current-location="currentLocation"
      :current-accuracy="accuracy"
      :is-tracking="isTracking"
      :tracking-error="trackingError"
      :is-long-press-enabled="true"
      :pin-position="newSpotPin"
      :focus-position="reviewTargetPosition"
      :focus-offset-y="focusOffsetY"
      :my-review-spots="myReviews"
      :show-my-reviews="showMyReviews"
      :other-review-spots="otherReviewSpots"
      :show-other-reviews="showOtherReviews"
      :visited-spot-ids="visitedSpotIds"
      @long-press-map="handleLongPressMap"
      @select-review-spot="handleSelectReviewSpot"
    />

    <div class="review-toggles">
      <button
        class="review-toggle review-toggle-mine"
        :class="{ 'is-on': showMyReviews }"
        type="button"
        :aria-pressed="showMyReviews"
        @click="toggleMyReviews"
      >
        <span class="review-toggle-dot" />
        自分の口コミ
      </button>

      <button
        class="review-toggle review-toggle-other"
        :class="{ 'is-on': showOtherReviews }"
        type="button"
        :aria-pressed="showOtherReviews"
        @click="toggleOtherReviews"
      >
        <span class="review-toggle-dot" />
        みんなの口コミ
      </button>
    </div>

    <ReviewPostForm
      v-if="isReviewFormVisible"
      ref="reviewFormRef"
      :genre-options="genreOptions"
      :pin-position="reviewTargetPosition"
      :existing-spot="existingSpot"
      :is-owner="isOwner"
      :initial-rating="userRating"
      :existing-photos="existingPhotos"
      :is-resolving="isResolving"
      :is-posting="isPosting"
      @submit-review="handleSubmitReview"
      @close="handleCloseReview"
      @change-expanded="handleChangeReviewFormExpanded"
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
        message="ルート案内を終了しますか？"
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
 * 「次の目的地へ」ボタン。次の目的地バナーの右下に置く。
 * バナーは幅 calc(100% - 24px)・最大406pxで中央寄せのため、
 * 右端をバナーの右端（狭い画面では12px、広い画面では中央から203px）に揃える。
 * 大きさは口コミの表示切り替えボタンと揃える。
 */
.next-spot-btn {
  position: fixed;
  top: 84px;
  right: max(12px, calc(50% - 203px));
  z-index: 45;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--white);
  background: var(--primary-color);
  border: none;
  border-radius: 999px;
  box-shadow: var(--shadow);
  cursor: pointer;
}

.next-spot-btn:active {
  background: var(--primary-light);
}

/*
 * 口コミピンの表示切り替えボタン（自分・他の人の2つ）。
 * 次の目的地バナー（top: 12px・中央）とズームコントロール（右上）に重ならないよう左上に置く。
 */
.review-toggles {
  position: fixed;
  top: 84px;
  left: 12px;
  z-index: 45;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.review-toggle {
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

.review-toggle.is-on {
  color: var(--text-dark);
}

.review-toggle-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #D8DEE4;
}

/* オン状態の丸をピンの色（自分=オレンジ / 他の人=紫）と対応づける */
.review-toggle-mine.is-on .review-toggle-dot {
  background: #F39C12;
}

.review-toggle-other.is-on .review-toggle-dot {
  background: #8E44AD;
}
</style>
