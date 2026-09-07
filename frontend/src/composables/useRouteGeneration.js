import { computed, ref, shallowRef } from 'vue';
import { generateRoute as requestRouteGeneration } from '@/services/routeService';

/**
 * @description ルート生成の実行と、その進行状況を管理する。
 * APIの呼び出しはrouteServiceへ委譲し、ここでは状態遷移とエラー処理のみ扱う。
 *
 * 既存のuseRouteCreationはDBから登録済みルートを取得する処理を担うため、
 * 条件から生成する本composableとは別に持つ。
 * @returns {object} 生成状態と実行関数
 */
export const useRouteGeneration = () => {
  /** 生成処理中かどうか */
  const isGenerating = ref(false);

  /** 失敗時のメッセージ。成功時はnull */
  const errorMessage = ref(null);

  /**
   * 生成されたルート。未生成の場合はnull。
   *
   * shallowRefを使うのは、地図ライブラリがGeoJSONをWeb Workerへ渡す際に
   * 構造化複製を行い、リアクティブProxyでは DataCloneError になるため。
   * 中身を部分的に書き換えることはなく、常に全体を差し替えるので浅い参照で足りる。
   */
  const generatedRoute = shallowRef(null);

  /** ルートを生成済みかどうか */
  const hasGeneratedRoute = computed(() => generatedRoute.value !== null);

  /**
   * @description 指定した条件でルートを生成する
   * @param {object} conditions 生成条件
   * @param {string} conditions.genre ジャンル
   * @param {number} conditions.distanceKm 目標距離（km）
   * @param {{lat: number, lng: number}} conditions.origin 現在地
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  const generate = async (conditions) => {
    isGenerating.value = true;
    errorMessage.value = null;

    try {
      generatedRoute.value = await requestRouteGeneration(conditions);
      return true;
    } catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      isGenerating.value = false;
    }
  };

  return {
    isGenerating,
    errorMessage,
    generatedRoute,
    hasGeneratedRoute,
    generate
  };
};
