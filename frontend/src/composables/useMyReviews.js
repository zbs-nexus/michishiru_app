import { ref } from 'vue';
import { fetchMyReviews } from '@/services/reviewService';

/**
 * @description 自分が投稿した口コミ一覧（地図にオレンジのピンで出す）を管理する。
 * 表示は副次的な情報のため、取得に失敗しても画面を止めず空のまま続行する。
 * @returns {object} 口コミ一覧と再取得の関数
 */
export const useMyReviews = () => {
  /** 自分の口コミ（場所つき）の一覧 */
  const myReviews = ref([]);

  /**
   * @description 自分の口コミ一覧を取得して保持する
   * @returns {Promise<void>}
   */
  const loadMyReviews = async () => {
    try {
      myReviews.value = await fetchMyReviews();
    } catch {
      // ピン表示は副次的なため、失敗時は空にして続行する
      myReviews.value = [];
    }
  };

  return { myReviews, loadMyReviews };
};
