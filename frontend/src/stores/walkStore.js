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

/**
 * 実績をどこまで計測できたかを表す3値。
 * 結果画面の注記の出し分けに使うため、文字列を画面側へ直書きさせずここから参照させる。
 */
export const MEASUREMENT_STATUS = {
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable'
};

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

  /**
   * 計測の欠落を検知したかどうか。
   * 画面を切られた・測位が途切れた場合に立てる。復帰しても欠けた区間は取り戻せないため、
   * 一度立てたら戻さない（visitedSpotIds と同じラッチの方針）
   */
  const hasMeasurementGap = ref(false);

  /**
   * 最後に距離を積めた時刻（エポックms）。まだ積めていない場合はnull。
   * 本段階では計測状態の判定には使わず、記録だけ行う。
   * 「一定時間積めていない＝欠落」とするタイマー判定は信号待ちや休憩を誤検知するため
   */
  const lastDistanceAddedAt = ref(null);

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
   * 実績をどこまで計測できたか。
   *
   * 判定の順序そのものが結果を左右するため、強い事実から順に見る。
   * ① 一度も測位できていない場合は、欠落があったかどうかを語る土台がない。
   *    最も強い事実なので最初に見て unavailable を返す。
   * ② 欠落を検知していれば、距離が積めていても足りていない。
   *    ③より先に見るのは、こちらが「検知した事実」で③より確かな情報だから。
   * ③ 測位はできたのに距離が0のままなのは、ゆらぎ判定で全区間が落ちた状態。
   *    欠落を検知してはいないが完全に計測できたとも言えないため partial に寄せる。
   * ④ 上記のいずれでもなければ complete。
   */
  const measurementStatus = computed(() => {
    if (hasLocationFix.value === false) {
      return MEASUREMENT_STATUS.UNAVAILABLE;
    }

    if (hasMeasurementGap.value === true) {
      return MEASUREMENT_STATUS.PARTIAL;
    }

    if (totalDistanceM.value === 0) {
      return MEASUREMENT_STATUS.PARTIAL;
    }

    return MEASUREMENT_STATUS.COMPLETE;
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
    hasMeasurementGap.value = false;
    lastDistanceAddedAt.value = null;
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
    // 加算できた時点だけを記録する。無効値で呼ばれた場合に時刻を進めると
    // 「距離は積めている」と誤って読めてしまう
    lastDistanceAddedAt.value = Date.now();
  };

  /**
   * @description 現在地を採用できたことを記録する
   * @returns {void}
   */
  const markLocationFixed = () => {
    hasLocationFix.value = true;
  };

  /**
   * @description 計測の欠落を検知したことを記録する
   * @returns {void}
   */
  const markMeasurementGap = () => {
    // 一度立てたら戻さない。測位が復帰しても、途切れていた間の距離は取り戻せないため
    hasMeasurementGap.value = true;
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
    hasMeasurementGap.value = false;
    lastDistanceAddedAt.value = null;
  };

  return {
    totalDistanceM,
    visitedSpotIds,
    startedAt,
    endedAt,
    hasLocationFix,
    hasMeasurementGap,
    lastDistanceAddedAt,
    totalDistanceKm,
    spotCount,
    elapsedMinutes,
    measurementStatus,
    startWalk,
    addDistanceM,
    markLocationFixed,
    markMeasurementGap,
    setVisitedSpotIds,
    endWalk,
    resetWalk
  };
});
