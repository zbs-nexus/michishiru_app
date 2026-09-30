import { ref, onBeforeUnmount } from 'vue';
import { DEFAULT_CURRENT_LOCATION } from '@/constants/routeConditions';

/**
 * @description リアルタイムで現在地を追跡する composable。
 * ルート案内中にユーザーの位置を継続的に取得し、地図上に表示するために使用する。
 *
 * watchPosition を使用し、位置が変わるたびに自動で更新される。
 */

/** 位置情報取得のタイムアウト（ミリ秒） */
const GEOLOCATION_TIMEOUT_MS = 10000;

/** 位置情報のキャッシュ有効期間（ミリ秒）。0で常に最新を取得 */
const MAXIMUM_AGE_MS = 0;

/**
 * 採用する測位精度の上限（メートル）。
 * これより精度が悪い測位は座標が大きく飛ぶため、現在地を更新せず前回の位置を保つ。
 * 屋外のGPSは5〜10m程度、建物内や高層ビル街では数十mまで悪化する。
 */
const MAX_ACCEPTABLE_ACCURACY_M = 50;

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

  /**
   * @description 位置情報の更新時に呼ばれるコールバック
   * @param {GeolocationPosition} position 位置情報
   * @returns {void}
   */
  const handlePositionUpdate = (position) => {
    const positionAccuracy = position.coords.accuracy;

    // accuracyがnullの間は現在地が既定値のままなので、初回だけは精度を問わず採用する。
    // ここで弾くと、精度が悪い場所では案内が始まらなくなる
    const isFirstFix = accuracy.value === null;

    const isReliableAccuracy =
      Number.isFinite(positionAccuracy) &&
      positionAccuracy <= MAX_ACCEPTABLE_ACCURACY_M;

    if (!isFirstFix && !isReliableAccuracy) {
      return;
    }

    currentLocation.value = {
      lng: position.coords.longitude,
      lat: position.coords.latitude
    };
    accuracy.value = positionAccuracy;
    trackingError.value = null;
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
