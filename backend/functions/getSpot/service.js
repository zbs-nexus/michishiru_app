import * as spotRepository from './repository.js';
import {
  findNearestWithinRadiusM,
  SAME_PLACE_RADIUS_M
} from '../../shared/utils/geo.js';

/**
 * @description 口コミの場所解決を担うビジネスロジック。
 * HTTPに依存せず、プレーンなオブジェクトを入出力する。
 */

/**
 * @description 指定座標に対応する既存の場所を解決する。
 * 半径40m以内に場所があれば、その情報と呼び出し元の既存評価を返す。
 * 無ければ exists:false を返す（＝その場所への初回投稿になる）。
 * @param {object} input 入力
 * @param {{lng: number, lat: number}} input.position 長押しされた座標
 * @param {string|null} input.userId 呼び出し元のユーザーID
 * @param {object} [repository] データアクセス（テスト用に差し替え可能）
 * @returns {Promise<object>} 解決結果
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getSpot = async ({ position, userId }, repository = spotRepository) => {
  const candidates = await repository.findNearbySpots(position);
  const spot = findNearestWithinRadiusM(position, candidates, SAME_PLACE_RADIUS_M);

  if (spot === null) {
    return { exists: false };
  }

  // 写真は非公開バケットにあるため、表示用の署名付きURLを付けて返す
  const photoUrls = await repository.createPhotoViewUrls(spot.photoKeys ?? []);

  // 認証済みなら、呼び出し元が既にこの場所へ投稿しているかを合わせて返す
  const userReview =
    userId === null ? null : await repository.getUserReview(spot.spotId, userId);

  return { exists: true, spot: { ...spot, photoUrls }, userReview };
};
