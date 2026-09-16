import { ref } from 'vue';
// composableが公開する createRoute と名前が衝突するため、API呼び出し側に別名を付ける
import { createRoute as requestRouteCreation } from '@/services/routeService';
import { useRouteStore } from '@/stores/routeStore';
import { useGeolocation } from '@/composables/useGeolocation';
import { MIN_LOADING_DURATION_MS } from '@/constants/routeConditions';

/**
 * @description 指定時間だけ待機する
 * @param {number} durationMs 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
const wait = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

/**
 * @description ルート作成の実行と、その進行状況を管理する。
 * APIの呼び出しはrouteServiceへ委譲し、ここでは状態遷移とエラー処理のみ扱う。
 *
 * ロード表示は応答が返った時点で解除する。画面遷移に頼って解除すると、
 * 提案画面での再作成（同じ画面に留まる）でロード表示が残り続ける。
 * @returns {object} 作成状態と実行関数
 */
export const useRouteCreation = () => {
  const routeStore = useRouteStore();
  const {
    isLocating,
    locationWarning,
    isUsingFallback,
    fetchCurrentLocation
  } = useGeolocation();

  /** 作成処理中かどうか */
  const isCreating = ref(false);

  /** 失敗時のメッセージ。成功時はnull */
  const errorMessage = ref(null);

  /**
   * @description ストアが保持する入力条件でルートを作成し、結果をストアへ保存する。
   * 条件はストアから読むため、初回作成と再作成で同じ値が使われる。
   * 現在地は Geolocation API から取得し、失敗時はフォールバック値を使用する。
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  const createRoute = async () => {
    isCreating.value = true;
    errorMessage.value = null;

    const startedAt = Date.now();

    try {
      // 現在地を取得（失敗時はフォールバック値が返る）
      const location = await fetchCurrentLocation();

      // ジャンルは英語のジャンルID（genre）を送る。表示名（genreName）ではマスタと一致しない
      const route = await requestRouteCreation({
        genreId: routeStore.genre,
        distanceKm: routeStore.distanceKm,
        currentLocation: location
      });

      routeStore.setCurrentRoute(route);

      return true;
    } catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      // 応答が速すぎる場合にローディングが一瞬だけ表示されるのを防ぐ。
      // 成否にかかわらず待ってから解除する
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < MIN_LOADING_DURATION_MS) {
        await wait(MIN_LOADING_DURATION_MS - elapsedMs);
      }

      isCreating.value = false;
    }
  };

  return {
    isCreating,
    isLocating,
    errorMessage,
    locationWarning,
    isUsingFallback,
    createRoute
  };
};
