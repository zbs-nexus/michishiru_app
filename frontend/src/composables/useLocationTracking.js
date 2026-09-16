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
 * @description 2点間の方位角を計算する（北を0度として時計回り）
 * @param {number} fromLat 出発点の緯度
 * @param {number} fromLng 出発点の経度
 * @param {number} toLat 到着点の緯度
 * @param {number} toLng 到着点の経度
 * @returns {number} 方位角（0-360度）
 */
const calculateBearing = (fromLat, fromLng, toLat, toLng) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;

  const dLng = toRad(toLng - fromLng);
  const lat1 = toRad(fromLat);
  const lat2 = toRad(toLat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  let bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
};

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

  /** 向いている方向（度、北を0度として時計回り）。取得できない場合はnull */
  const heading = ref(null);

  /** 位置情報の精度（メートル） */
  const accuracy = ref(null);

  /** 追跡中かどうか */
  const isTracking = ref(false);

  /** エラーメッセージ */
  const trackingError = ref(null);

  /** 前回の位置（方向計算用） */
  let previousLocation = null;

  /** watchPosition の ID */
  let watchId = null;

  /**
   * @description 位置情報の更新時に呼ばれるコールバック
   * @param {GeolocationPosition} position 位置情報
   * @returns {void}
   */
  const handlePositionUpdate = (position) => {
    const newLocation = {
      lng: position.coords.longitude,
      lat: position.coords.latitude
    };

    // Geolocation API から heading が取得できた場合はそれを使う
    // 取得できない場合は前回位置からの移動方向を計算する
    if (position.coords.heading !== null && !Number.isNaN(position.coords.heading)) {
      heading.value = position.coords.heading;
    } else if (previousLocation !== null) {
      // 移動距離が小さすぎると方向が不正確になるため、閾値を設ける
      const distanceMoved = Math.sqrt(
        Math.pow(newLocation.lng - previousLocation.lng, 2) +
        Math.pow(newLocation.lat - previousLocation.lat, 2)
      );
      // 約10mの移動を閾値とする（緯度経度で約0.0001度）
      if (distanceMoved > 0.0001) {
        heading.value = calculateBearing(
          previousLocation.lat,
          previousLocation.lng,
          newLocation.lat,
          newLocation.lng
        );
      }
    }

    previousLocation = { ...newLocation };
    currentLocation.value = newLocation;
    accuracy.value = position.coords.accuracy;
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
    heading,
    accuracy,
    isTracking,
    trackingError,
    startTracking,
    stopTracking
  };
};
