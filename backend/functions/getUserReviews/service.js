import * as userReviewRepository from './repository.js';

/**
 * @description 自分の口コミ一覧（地図にオレンジのピンで出すための場所つき）を取得する。
 * HTTPに依存せず、プレーンなオブジェクトを入出力する。
 * @param {object} input 入力
 * @param {string} input.userId ユーザーID
 * @param {object} [repository] データアクセス（テスト用に差し替え可能）
 * @returns {Promise<{reviews: Array<{spotId: string, position: object, spotName: string, rating: number}>}>} 口コミ一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getUserReviews = async ({ userId }, repository = userReviewRepository) => {
  const reviews = await repository.listReviewsByUser(userId);

  if (reviews.length === 0) {
    return { reviews: [] };
  }

  const spotIds = [...new Set(reviews.map((review) => review.spotId))];
  const spotsById = await repository.getSpotsByIds(spotIds);

  // 場所メタが取得できたものだけを、座標・名前つきで返す
  const enriched = reviews
    .map((review) => {
      const spot = spotsById.get(review.spotId);

      if (!spot) {
        return null;
      }

      return {
        spotId: review.spotId,
        position: spot.position,
        spotName: spot.spotName,
        rating: review.rating
      };
    })
    .filter((review) => review !== null);

  return { reviews: enriched };
};
