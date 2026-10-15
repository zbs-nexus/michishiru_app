import { ref } from 'vue';
import { fetchConditionOptions } from '@/services/conditionService';

/**
 * @description ジャンルの選択肢の取得と、その進行状況を管理する。
 * ホーム画面の検索条件マスタAPIと同じ取得元を使うが、距離や検索条件ストアには
 * 触れずジャンルだけを扱う。口コミ投稿フォームなど、ジャンル選択のみが必要な
 * 画面で使う。APIの呼び出しはconditionServiceへ委譲する。
 * @returns {object} ジャンルの選択肢と取得状態、取得の実行関数
 */
export const useGenreOptions = () => {
  /** ジャンルの選択肢 */
  const genreOptions = ref([]);

  /** 取得処理中かどうか */
  const isLoading = ref(false);

  /** 失敗時のメッセージ。成功時はnull */
  const errorMessage = ref(null);

  /**
   * @description ジャンルの選択肢を取得して保持する
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  const loadGenreOptions = async () => {
    isLoading.value = true;
    errorMessage.value = null;

    try {
      const options = await fetchConditionOptions();
      genreOptions.value = options.genreOptions;
      return true;
    } catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    genreOptions,
    isLoading,
    errorMessage,
    loadGenreOptions
  };
};
