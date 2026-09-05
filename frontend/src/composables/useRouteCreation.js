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
 *
 * ロード表示は「APIの応答があるまで出し続ける」仕様のため、
 * 一度開始したら自動では解除しない。画面遷移でコンポーネントごと破棄されて解除される。
 * @returns {object} 作成状態と実行関数
 */
export const useRouteCreation = () => {
  const routeStore = useRouteStore();

  /** 作成処理中かどうか */
  const isCreating = ref(false);

  /** 失敗時のメッセージ。成功時はnull */
  const errorMessage = ref(null);

  /**
   * @description 現在の入力条件でルートを作成し、ストアへ保存する。
   * 応答があるまでロード表示を継続するため、失敗しても isCreating は解除しない。
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  const createRoute = async () => {
    isCreating.value = true;
    errorMessage.value = null;

    const startedAt = Date.now();

    try {
      const route = await fetchRoute({
        genre: routeStore.genre,
        distanceKm: routeStore.distanceKm
      });

      // 応答が速すぎる場合にローディングが一瞬だけ表示されるのを防ぐ
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_LOADING_DURATION_MS) {
        await wait(MIN_LOADING_DURATION_MS - elapsed);
      }

      routeStore.setCurrentRoute(route);

      // 解除せずに返す。画面遷移でロード表示ごと切り替わるため、ちらつきを防げる
      return true;
    } catch (error) {
      errorMessage.value = error.message;
      return false;
    }
  };

  return {
    isCreating,
    errorMessage,
    createRoute
  };
};
