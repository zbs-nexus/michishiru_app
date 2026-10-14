import * as reviewSpotRepository from './repository.js';

/**
 * @description 口コミが付いた場所の一覧（地図にピンで出すための座標つき）を取得する。
 *
 * 自分の口コミ（オレンジ）と他の人の口コミ（紫）の塗り分けは、
 * 呼び出し元が `GET /api/v1/my-reviews` の結果と突き合わせて行う。
 * ここで「誰が投稿したか」を返すと他ユーザーのIDが外へ出るため、
 * `createdByUserId` は返却から除く。
 * @param {object} [repository] データアクセス（テスト用に差し替え可能）
 * @returns {Promise<{spots: Array<{spotId: string, position: {lng: number, lat: number}, spotName: string}>}>} 場所の一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getReviewSpots = async (repository = reviewSpotRepository) => {
  const spots = await repository.listSpots();

  // 座標が欠けている行は地図に置けないため除く
  const usableSpots = spots.filter(
    (spot) => Number.isFinite(spot.position?.lng) && Number.isFinite(spot.position?.lat)
  );

  return {
    spots: usableSpots.map(({ spotId, position, spotName }) => ({
      spotId,
      position,
      spotName
    }))
  };
};
