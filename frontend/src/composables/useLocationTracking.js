import { ref, onBeforeUnmount } from 'vue';
import { DEFAULT_CURRENT_LOCATION } from '@/constants/routeConditions';

/**
 * @description リアルタイムで現在地を追跡する composable。
 * ルート案内中にユーザーの位置を継続的に取得し、地図上に表示するために使用する。
 *
 * watchPosition ではなく setInterval + getCurrentPosition を使う理由:
 * - watchPosition は移動がないと更新されない場合がある
 * - 更新間隔を明示的に制御できる
 * - バッテリー消費を抑えやすい
 */

/** 位置情報取得のタイムアウト（ミリ秒） */
const GEOLOCATION_TIMEOUT_MS = 10000;

/** 位置情報のキャッシュ有効期間（ミリ秒） */
const MAXIMUM_AGE_MS = 0;

/** 既定の更新間隔（ミリ秒） */
const DEFAULT_UPDATE_INTERVAL_MS = 5000;

/**
 * @description Geolocation API で現在地を1回取得する
 * @returns {Promise<{lng: number, lat: number, heading: number|null, accuracy: number}>}
 */
const getCurrentPositionAsync = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('このブラウザは位置情報に対応していません'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          // heading は移動中でないと取得できない場合がある（null になる）
          heading: position.coords.heading,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: GEOLOCATION_TIMEOUT_MS,
        maximumAge: MAXIMUM_AGE_MS
      }
    );
  });

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
 * @description リアルタイム位置追跡を提供する composable
 * @param {object} options オプション
 * @param {number} options.intervalMs 更新間隔（ミリ秒）。既定は5000ms
 * @returns {object} 位置情報の状態と制御関数
 */
export const useLocationTracking = (options = {}) => {
  const intervalMs = options.intervalMs ?? DEFAULT_UPDATE_INTERVAL_MS;

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

  /** インターバルのID */
  let intervalId = null;

  /**
   * @description 位置情報を1回取得して状態を更新する
   * @returns {Promise<void>}
   */
  const updateLocation = async () => {
    try {
      const position = await getCurrentPositionAsync();

      // Geolocation API から heading が取得できた場合はそれを使う
      // 取得できない場合は前回位置からの移動方向を計算する
      if (position.heading !== null && !Number.isNaN(position.heading)) {
        heading.value = position.heading;
      } else if (previousLocation !== null) {
        // 移動距離が小さすぎると方向が不正確になるため、閾値を設ける
        const distanceMoved = Math.sqrt(
          Math.pow(position.lng - previousLocation.lng, 2) +
          Math.pow(position.lat - previousLocation.lat, 2)
        );
        // 約10mの移動を閾値とする（緯度経度で約0.0001度）
        if (distanceMoved > 0.0001) {
          heading.value = calculateBearing(
            previousLocation.lat,
            previousLocation.lng,
            position.lat,
            position.lng
          );
        }
      }

      previousLocation = { lng: position.lng, lat: position.lat };
      currentLocation.value = { lng: position.lng, lat: position.lat };
      accuracy.value = position.accuracy;
      trackingError.value = null;
    } catch (error) {
      // エラーが発生しても追跡は継続する（次回の更新で回復する可能性がある）
      trackingError.value = error.message ?? '位置情報の取得に失敗しました';
    }
  };

  /**
   * @description 位置追跡を開始する
   * @returns {Promise<void>}
   */
  const startTracking = async () => {
    if (isTracking.value) {
      return;
    }

    isTracking.value = true;
    trackingError.value = null;

    // 最初の位置を即座に取得
    await updateLocation();

    // 定期的に位置を更新
    intervalId = setInterval(updateLocation, intervalMs);
  };

  /**
   * @description 位置追跡を停止する
   * @returns {void}
   */
  const stopTracking = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
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
