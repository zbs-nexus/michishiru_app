import { ref } from 'vue';
import { DEFAULT_CURRENT_LOCATION } from '@/constants/routeConditions';

/**
 * @description ブラウザの Geolocation API を使って現在地を取得する。
 * PC・スマートフォンの両方で動作する。
 *
 * 取得に失敗した場合（権限拒否、タイムアウト、非対応ブラウザ）は
 * フォールバックとして固定の座標を返す。
 */

/** 位置情報取得のタイムアウト（ミリ秒） */
const GEOLOCATION_TIMEOUT_MS = 10000;

/** 位置情報のキャッシュ有効期間（ミリ秒）。頻繁な再取得を防ぐ */
const MAXIMUM_AGE_MS = 60000;

/**
 * @description Geolocation API で現在地を取得する Promise を返す
 * @returns {Promise<{lng: number, lat: number}>} 現在地の座標
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
          lat: position.coords.latitude
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
 * @description 現在地の取得と状態管理を提供する composable。
 * @returns {object} 現在地の状態と取得関数
 */
export const useGeolocation = () => {
  /** 取得した現在地。未取得または失敗時はフォールバック値 */
  const currentLocation = ref({ ...DEFAULT_CURRENT_LOCATION });

  /** 現在地を取得中かどうか */
  const isLocating = ref(false);

  /** 位置情報の取得に失敗した場合の警告メッセージ。成功時はnull */
  const locationWarning = ref(null);

  /** フォールバック値を使用しているかどうか */
  const isUsingFallback = ref(true);

  /**
   * @description 現在地を取得し、状態を更新する。
   * 失敗した場合はフォールバック値を使用し、警告メッセージを設定する。
   * @returns {Promise<{lng: number, lat: number}>} 現在地（成功時は実際の座標、失敗時はフォールバック）
   */
  const fetchCurrentLocation = async () => {
    isLocating.value = true;
    locationWarning.value = null;

    try {
      const position = await getCurrentPositionAsync();
      currentLocation.value = position;
      isUsingFallback.value = false;
      return position;
    } catch (error) {
      // 失敗してもフォールバック値でルート作成は続行できる
      locationWarning.value = toErrorMessage(error);
      currentLocation.value = { ...DEFAULT_CURRENT_LOCATION };
      isUsingFallback.value = true;
      return currentLocation.value;
    } finally {
      isLocating.value = false;
    }
  };

  return {
    currentLocation,
    isLocating,
    locationWarning,
    isUsingFallback,
    fetchCurrentLocation
  };
};
