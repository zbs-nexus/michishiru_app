import { computed, ref } from 'vue';
import {
  fetchPhotoUploadUrls,
  postReview,
  resolveSpot,
  uploadPhoto
} from '@/services/reviewService';

/**
 * @description 口コミ投稿の状態と処理を管理する。
 * 長押し位置の場所解決（投稿済みか）と投稿を扱い、進行状況・エラーを公開する。
 * APIの呼び出しはreviewServiceへ委譲し、ここでは状態遷移とエラー処理のみ行う。
 * @returns {object} 解決結果・進行状況・エラーと、解決/投稿/リセットの関数
 */
export const useReviewPosting = () => {
  /** 場所の解決結果。{exists, spot?, userReview?} または未解決のnull */
  const resolvedSpot = ref(null);

  /** 場所解決中かどうか */
  const isResolving = ref(false);

  /** 投稿中かどうか */
  const isPosting = ref(false);

  /** 失敗時のメッセージ。成功時はnull */
  const errorMessage = ref(null);

  /** 投稿済みの既存の場所。未解決・未投稿の場所の場合はnull */
  const existingSpot = computed(() =>
    resolvedSpot.value?.exists ? resolvedSpot.value.spot : null
  );

  /** 呼び出し元がその場所に既に付けている評価。無ければ0 */
  const userRating = computed(() => resolvedSpot.value?.userReview?.rating ?? 0);

  /**
   * @description 長押し位置に投稿済みの場所があるかを解決する
   * @param {{lng: number, lat: number}} position 長押しされた座標
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  const resolve = async (position) => {
    isResolving.value = true;
    resolvedSpot.value = null;
    errorMessage.value = null;

    try {
      resolvedSpot.value = await resolveSpot(position);
      return true;
    } catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      isResolving.value = false;
    }
  };

  /**
   * @description 口コミを投稿する。
   * 写真がある場合は先に署名付きURLでアップロードし、得たキーを投稿に含める。
   * @param {object} payload 投稿内容
   * @param {{lng: number, lat: number}} payload.position 投稿位置
   * @param {number} payload.rating 評価
   * @param {string|null} payload.spotName ロケーション名（初回のみ）
   * @param {string|null} payload.genreId ジャンルID（初回のみ）
   * @param {string|null} payload.genreName ジャンル名（初回のみ）
   * @param {File[]} [payload.photos] アップロードする写真（初回のみ・最大4）
   * @returns {Promise<object|null>} 成功時は投稿結果、失敗時はnull
   */
  const post = async ({ photos = [], ...payload }) => {
    isPosting.value = true;
    errorMessage.value = null;

    try {
      let photoKeys = [];

      if (photos.length > 0) {
        const uploads = await fetchPhotoUploadUrls(photos.length);
        await Promise.all(
          uploads.map((upload, index) => uploadPhoto(upload.uploadUrl, photos[index]))
        );
        photoKeys = uploads.map((upload) => upload.key);
      }

      return await postReview({ ...payload, photoKeys });
    } catch (error) {
      errorMessage.value = error.message;
      return null;
    } finally {
      isPosting.value = false;
    }
  };

  /**
   * @description 状態を初期化する（フォームを閉じたとき）
   * @returns {void}
   */
  const reset = () => {
    resolvedSpot.value = null;
    errorMessage.value = null;
  };

  return {
    resolvedSpot,
    existingSpot,
    userRating,
    isResolving,
    isPosting,
    errorMessage,
    resolve,
    post,
    reset
  };
};
