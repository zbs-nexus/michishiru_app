import { ref } from 'vue';
import { fetchReviewSpots } from '@/services/reviewService';

/**
 * @description 口コミが付いた場所の一覧（地図にピンで出す）を管理する。
 * 自分が投稿済みの場所も含むため、他の人の口コミ（紫ピン）だけに絞るのは
 * 自分の口コミ（`useMyReviews`）と突き合わせる呼び出し側で行う。
 * 表示は副次的な情報のため、取得に失敗しても画面を止めず空のまま続行する。
 * @returns {object} 場所の一覧と再取得の関数
 */
export const useReviewSpots = () => {
  /** 口コミが付いた場所の一覧 */
  const reviewSpots = ref([]);

  /**
   * @description 口コミが付いた場所の一覧を取得して保持する
   * @returns {Promise<void>}
   */
  const loadReviewSpots = async () => {
    try {
      reviewSpots.value = await fetchReviewSpots();
    } catch {
      // ピン表示は副次的なため、失敗時は空にして続行する
      reviewSpots.value = [];
    }
  };

  return { reviewSpots, loadReviewSpots };
};
