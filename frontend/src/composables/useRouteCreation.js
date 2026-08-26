import { ref } from 'vue';
import { fetchRoute } from '@/services/routeService';
import { useRouteStore } from '@/stores/routeStore';
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
 * @returns {object} 作成状態と実行関数
 */
export const useRouteCreation = () => {
  const routeStore = useRouteStore();

  /** 作成処理中かどうか */
  const isCreating = ref(false);

  /** 失敗時のメッセージ。成功時はnull */
  const errorMessage = ref(null);

  /**
   * @description 現在の入力条件でルートを作成し、ストアへ保存する
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  const createRoute = async () => {
    isCreating.value = true;
    errorMessage.value = null;

    const startedAt = Date.now();

    try {
      const route = await fetchRoute({
        purpose: routeStore.purpose,
        category: routeStore.category,
        distance: routeStore.distance
      });

      routeStore.setCurrentRoute(route);
      return true;
    } catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      // 応答が速すぎる場合にローディングが一瞬だけ表示されるのを防ぐ
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_DURATION_MS) {
        await wait(MIN_LOADING_DURATION_MS - elapsed);
      }
      isCreating.value = false;
    }
  };

  return {
    isCreating,
    errorMessage,
    createRoute
  };
};
