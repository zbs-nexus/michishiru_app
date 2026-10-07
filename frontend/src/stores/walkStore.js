import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

/**
 * @description 案内中に計測した散歩の実績を保持するグローバルストア。
 * 案内画面から結果画面へ遷移すると案内画面は破棄され、composable の状態は失われる。
 * 画面をまたいで実績を読めるようにするため、Piniaで一元管理する。
 *
 * ルート作成時の予測値は routeStore が持つ。こちらは実際に歩いた結果のみを扱う。
 */

/** 1kmあたりのメートル数 */
const METERS_PER_KM = 1000;

/** 1分あたりのミリ秒数 */
const MILLISECONDS_PER_MINUTE = 60000;

export const useWalkStore = defineStore('walk', () => {
  /** 実際に歩いた距離（メートル）。GPSの軌跡から積算する */
  const totalDistanceM = ref(0);

  /** 到達済みのスポットID */
  const visitedSpotIds = ref([]);

  /** 案内を開始した時刻（エポックms）。未開始の場合はnull */
  const startedAt = ref(null);

  /** 案内を終了した時刻（エポックms）。案内中はnull */
  const endedAt = ref(null);

  /**
   * 一度でも現在地を採用できたかどうか。
   * 歩いた距離が0だったことと、測位そのものができなかったことを
   * 結果画面で言い分けるために持つ。距離が積めたかどうかとは別の事実
   */
  const hasLocationFix = ref(false);

  /** 実際に歩いた距離（km）。表示直前に換算し、丸め誤差を積み上げない */
  const totalDistanceKm = computed(() => totalDistanceM.value / METERS_PER_KM);

  /** 巡ったスポットの数 */
  const spotCount = computed(() => visitedSpotIds.value.length);

  /**
   * 案内の開始から終了までの時間（分）。
   * endedAt が未設定の間は現在時刻までを返し、案内中でも経過時間が読めるようにする。
   */
  const elapsedMinutes = computed(() => {
    if (startedAt.value === null) {
      return 0;
    }

    return Math.round(
      ((endedAt.value ?? Date.now()) - startedAt.value) / MILLISECONDS_PER_MINUTE
    );
  });

  /**
   * @description 散歩の計測を開始する
   * @returns {void}
   */
  const startWalk = () => {
    // 2回目以降の散歩で前回の距離やスポットが積み上がらないよう、開始時に初期化する
    totalDistanceM.value = 0;
    visitedSpotIds.value = [];
    endedAt.value = null;
    hasLocationFix.value = false;
    startedAt.value = Date.now();
  };

  /**
   * @description 歩いた区間の距離を総距離へ加算する
   * @param {number} distanceM 区間距離（メートル）
   * @returns {void}
   */
  const addDistanceM = (distanceM) => {
    if (!Number.isFinite(distanceM)) {
      return;
    }

    totalDistanceM.value += distanceM;
  };

  /**
   * @description 現在地を採用できたことを記録する
   * @returns {void}
   */
  const markLocationFixed = () => {
    hasLocationFix.value = true;
  };

  /**
   * @description 到達済みのスポットIDを置き換える
   * @param {string[]} spotIds 到達済みのスポットIDの一覧
   * @returns {void}
   */
  const setVisitedSpotIds = (spotIds) => {
    // 到達済みを未到達へ戻さないラッチは useRouteProgress 側が担保しているため、
    // ここでは判定せず渡された一覧をそのまま持つ
    visitedSpotIds.value = [...spotIds];
  };

  /**
   * @description 散歩の計測を終了する
   * @returns {void}
   */
  const endWalk = () => {
    endedAt.value = Date.now();
  };

  /**
   * @description 実績を初期状態へ戻す
   * @returns {void}
   */
  const resetWalk = () => {
    totalDistanceM.value = 0;
    visitedSpotIds.value = [];
    startedAt.value = null;
    endedAt.value = null;
    hasLocationFix.value = false;
  };

  return {
    totalDistanceM,
    visitedSpotIds,
    startedAt,
    endedAt,
    hasLocationFix,
    totalDistanceKm,
    spotCount,
    elapsedMinutes,
    startWalk,
    addDistanceM,
    markLocationFixed,
    setVisitedSpotIds,
    endWalk,
    resetWalk
  };
});
