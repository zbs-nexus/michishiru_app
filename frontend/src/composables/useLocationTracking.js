import { ref, onBeforeUnmount } from 'vue';
import { DEFAULT_CURRENT_LOCATION } from '@/constants/routeConditions';
import {
  isPlausibleWalkingMove,
  toFixTimestamp
} from '@/utils/locationPlausibility';

/**
 * @description リアルタイムで現在地を追跡する composable。
 * ルート案内中にユーザーの位置を継続的に取得し、地図上に表示するために使用する。
 *
 * watchPosition を使用し、位置が変わるたびに自動で更新される。
 *
 * 届いた測位は2段階でふるいにかける。
 * ① 精度：申告された精度が悪い測位を捨てる
 * ② 速さ：前回の採用地点から徒歩ではあり得ない速さで動いた測位を捨てる
 *   （ビル群のマルチパスは精度の申告が良いまま座標が飛ぶため、①では捕まえられない）
 */

/** 位置情報取得のタイムアウト（ミリ秒） */
const GEOLOCATION_TIMEOUT_MS = 10000;

/** 位置情報のキャッシュ有効期間（ミリ秒）。0で常に最新を取得 */
const MAXIMUM_AGE_MS = 0;

/**
 * 採用する測位精度の上限（メートル）。
 * これより精度が悪い測位は座標が大きく飛ぶため、現在地を更新せず前回の位置を保つ。
 * 屋外のGPSは5〜10m程度、建物内や高層ビル街では数十mまで悪化する。
 * ブラウザの座標上書き（開発者ツール）も大きめの精度を返すため、余裕を持たせている。
 */
const MAX_ACCEPTABLE_ACCURACY_M = 100;

/**
 * 精度が悪い測位しか届かない場合でも、この時間を超えたら受け入れる（ミリ秒）。
 * 精度の良い測位が続かない環境で、現在地が固まったままになるのを防ぐ。
 */
const MAX_POSITION_AGE_MS = 10000;

/**
 * 飛びと判定した測位が、互いに矛盾せずこの回数続いたら受け入れる。
 * 前回の採用地点そのものが誤っていた場合（初回の測位が飛んでいた等）に、
 * 現在地が誤った地点に固まり続けるのを防ぐ。
 * 1回きりの飛びは次の測位で元の位置へ戻るため、続けて矛盾しない形にはならない。
 */
const MAX_CONSECUTIVE_JUMP_COUNT = 3;

/**
 * @description Geolocation API のエラーコードからユーザー向けメッセージを生成する
 * @param {GeolocationPositionError} error Geolocation API のエラー
 * @returns {string} エラーメッセージ
 */
const toErrorMessage = (error) => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return '位置情報の取得が許可されていません';
    case error.POSITION_UNAVAILABLE:
      return '位置情報を取得できませんでした';
    case error.TIMEOUT:
      return '位置情報の取得がタイムアウトしました';
    default:
      return '位置情報の取得に失敗しました';
  }
};

/**
 * @description リアルタイム位置追跡を提供する composable。
 * watchPosition を使用し、位置が変わるたびに自動で状態が更新される。
 * @returns {object} 位置情報の状態と制御関数
 */
export const useLocationTracking = () => {
  /** 現在地 */
  const currentLocation = ref({
    lng: DEFAULT_CURRENT_LOCATION.lng,
    lat: DEFAULT_CURRENT_LOCATION.lat
  });

  /** 位置情報の精度（メートル） */
  const accuracy = ref(null);

  /** 追跡中かどうか */
  const isTracking = ref(false);

  /** エラーメッセージ */
  const trackingError = ref(null);

  /** watchPosition の ID */
  let watchId = null;

  /** 直前に現在地として採用した時刻。採用が途切れていないかの判定に使う */
  let lastAcceptedAt = null;

  /**
   * 直前に現在地として採用した測位 { lat, lng, accuracy, timestamp }。
   * 速さの判定の起点に使う。テンプレートから参照しないため素の変数で持つ
   */
  let lastAcceptedFix = null;

  /**
   * 飛びと判定して捨てた直近の測位と、矛盾せず続いた回数。
   * { fix: { lat, lng, accuracy, timestamp }, count: number }。無い場合はnull
   */
  let jumpCandidate = null;

  /**
   * @description 測位を現在地として採用する
   * @param {{lat: number, lng: number, accuracy: number, timestamp: number}} fix 採用する測位
   * @returns {void}
   */
  const acceptFix = (fix) => {
    currentLocation.value = { lng: fix.lng, lat: fix.lat };
    accuracy.value = fix.accuracy;
    lastAcceptedAt = Date.now();
    lastAcceptedFix = fix;
    jumpCandidate = null;
  };

  /**
   * @description 飛びと判定した測位を記録し、受け入れてよい回数に達したかを返す。
   * 直前に捨てた測位から徒歩で起こり得る移動なら同じ地点が続いているとみなし数を重ね、
   * そうでなければ数え直す。
   * @param {{lat: number, lng: number, accuracy: number, timestamp: number}} fix 飛びと判定した測位
   * @returns {boolean} 続けて矛盾しない飛びが MAX_CONSECUTIVE_JUMP_COUNT 回に達したらtrue
   */
  const recordJump = (fix) => {
    const isContinuing =
      jumpCandidate !== null && isPlausibleWalkingMove(jumpCandidate.fix, fix);

    jumpCandidate = {
      fix,
      count: isContinuing ? jumpCandidate.count + 1 : 1
    };

    return jumpCandidate.count >= MAX_CONSECUTIVE_JUMP_COUNT;
  };

  /**
   * @description 位置情報の更新時に呼ばれるコールバック
   * @param {GeolocationPosition} position 位置情報
   * @returns {void}
   */
  const handlePositionUpdate = (position) => {
    const positionAccuracy = position.coords.accuracy;

    const fix = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: positionAccuracy,
      timestamp: toFixTimestamp(position)
    };

    // 測位そのものは届いているため、精度を採用するかに関わらずエラー表示を解除する。
    // ここを採用判定の後ろに置くと、精度が悪い測位が続く間エラーが消えなくなる
    trackingError.value = null;

    // accuracyがnullの間は現在地が既定値のままなので、初回だけは精度を問わず採用する。
    // ここで弾くと、精度が悪い場所では案内が始まらなくなる
    const isFirstFix = accuracy.value === null;

    if (isFirstFix) {
      acceptFix(fix);
      return;
    }

    const isReliableAccuracy =
      Number.isFinite(positionAccuracy) &&
      positionAccuracy <= MAX_ACCEPTABLE_ACCURACY_M;

    // 精度が悪い測位しか来ない環境で、現在地が固まったままにならないようにする
    const isPositionStale =
      lastAcceptedAt !== null && Date.now() - lastAcceptedAt >= MAX_POSITION_AGE_MS;

    // ① 精度の判定
    if (!isReliableAccuracy && !isPositionStale) {
      return;
    }

    // ② 速さの判定。精度の救済（isPositionStale）で通った測位にも適用する。
    // 精度が悪い測位ほど飛びやすく、ここを素通りさせるとビル群で大きくずれる
    if (
      !isPlausibleWalkingMove(lastAcceptedFix, fix) &&
      !recordJump(fix)
    ) {
      return;
    }

    acceptFix(fix);
  };

  /**
   * @description 位置情報のエラー時に呼ばれるコールバック
   * @param {GeolocationPositionError} error エラー情報
   * @returns {void}
   */
  const handlePositionError = (error) => {
    trackingError.value = toErrorMessage(error);
  };

  /**
   * @description 位置追跡を開始する
   * @returns {void}
   */
  const startTracking = () => {
    if (isTracking.value || !navigator.geolocation) {
      if (!navigator.geolocation) {
        trackingError.value = 'このブラウザは位置情報に対応していません';
      }
      return;
    }

    isTracking.value = true;
    trackingError.value = null;
    lastAcceptedAt = null;
    lastAcceptedFix = null;
    jumpCandidate = null;

    watchId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handlePositionError,
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: MAXIMUM_AGE_MS
      }
    );
  };

  /**
   * @description 位置追跡を停止する
   * @returns {void}
   */
  const stopTracking = () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    isTracking.value = false;
  };

  // コンポーネントの破棄時に追跡を停止
  onBeforeUnmount(() => {
    stopTracking();
  });

  return {
    currentLocation,
    accuracy,
    isTracking,
    trackingError,
    startTracking,
    stopTracking
  };
};
