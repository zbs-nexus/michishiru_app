import { randomUUID } from 'node:crypto';
import * as reviewRepository from './repository.js';
import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import {
  createUnauthorizedError,
  createValidationError
} from '../../shared/utils/errorHandler.js';
import {
  findNearestWithinRadiusM,
  SAME_PLACE_RADIUS_M,
  toGeoCell
} from '../../shared/utils/geo.js';

/**
 * @description 口コミ投稿を担うビジネスロジック。
 * HTTPに依存せず、プレーンなオブジェクトを入出力する。
 *
 * 同じ場所（半径40m以内）への投稿は、初回のみロケーション名・ジャンルを登録し、
 * 2回目以降は評価のみを受け付ける。各ユーザーの評価は1件で、再投稿は編集になる。
 */

/**
 * @description レスポンス用に場所の公開情報だけを取り出す
 * @param {object} spot 場所
 * @returns {object} 公開する場所情報
 */
const toSpotView = (spot) => ({
  spotId: spot.spotId,
  spotName: spot.spotName,
  genreId: spot.genreId,
  genreName: spot.genreName ?? null,
  position: spot.position,
  ratingCount: spot.ratingCount,
  ratingAverage: spot.ratingAverage,
  photoKeys: spot.photoKeys ?? []
});

/**
 * @description 既存の場所がない座標への初回投稿を処理する
 * @param {object} input 投稿内容
 * @param {object} repository データアクセス
 * @returns {Promise<object>} 投稿結果
 * @throws {ApplicationError} 名前・ジャンルが無い、または保存に失敗した場合
 */
const postFirstReview = async (input, repository) => {
  const { position, rating, spotName, genreId, genreName, photoKeys, userId } = input;

  // 初回はロケーション名とジャンルが必須（2回目以降は評価のみのため）
  if (spotName === null || genreId === null) {
    throw createValidationError('初回投稿にはロケーション名とジャンルが必要です');
  }

  // 写真は場所ごとに初回投稿時のみ設定する（2回目以降は評価のみ）
  const spot = {
    spotId: randomUUID(),
    spotName,
    genreId,
    genreName,
    position,
    geoCell: toGeoCell(position),
    photoKeys: photoKeys ?? []
  };

  await repository.createSpotWithReview({
    spot,
    review: { userId, rating },
    now: new Date().toISOString()
  });

  return {
    isFirstReview: true,
    spot: toSpotView({ ...spot, ratingCount: 1, ratingAverage: rating })
  };
};

/**
 * @description 既存の場所への2回目以降（または別ユーザーの初投稿・自分の編集）を処理する
 * @param {object} params パラメータ
 * @param {object} params.spot 既存の場所
 * @param {number} params.rating 評価
 * @param {string} params.userId ユーザーID
 * @param {object} repository データアクセス
 * @returns {Promise<object>} 投稿結果
 * @throws {ApplicationError} 保存に失敗した場合
 */
const postSubsequentReview = async ({ spot, rating, userId }, repository) => {
  const { spotId } = spot;
  const now = new Date().toISOString();
  const existingReview = await repository.getUserReview(spotId, userId);

  if (existingReview === null) {
    await repository.addReview({ spotId, userId, rating, now });
  } else if (existingReview.rating !== rating) {
    // 自分の既存の口コミの評価を更新する（他人の口コミには触れない）
    await repository.updateReviewRating({
      spotId,
      userId,
      rating,
      delta: rating - existingReview.rating,
      now
    });
  }

  const updatedSpot = await repository.getSpotById(spotId);

  return { isFirstReview: false, spot: toSpotView(updatedSpot) };
};

/**
 * @description 口コミを投稿する
 * @param {object} input 投稿内容
 * @param {{lng: number, lat: number}} input.position 投稿位置
 * @param {number} input.rating 評価（1〜5）
 * @param {string|null} input.spotName ロケーション名（初回のみ必須）
 * @param {string|null} input.genreId ジャンルID（初回のみ必須）
 * @param {string|null} input.genreName ジャンル名
 * @param {string[]} [input.photoKeys] 写真キー（初回のみ・最大4）
 * @param {string|null} input.userId 投稿者のユーザーID
 * @param {object} [repository] データアクセス（テスト用に差し替え可能）
 * @param {{retried?: boolean}} [options] 内部用。競合時の再試行フラグ
 * @returns {Promise<object>} 投稿結果
 * @throws {ApplicationError} 未認証・入力不備・保存失敗の場合
 */
export const createReview = async (
  input,
  repository = reviewRepository,
  { retried = false } = {}
) => {
  if (!input.userId) {
    throw createUnauthorizedError('口コミの投稿にはログインが必要です');
  }

  const candidates = await repository.findNearbySpots(input.position);
  const existingSpot = findNearestWithinRadiusM(
    input.position,
    candidates,
    SAME_PLACE_RADIUS_M
  );

  if (existingSpot !== null) {
    return postSubsequentReview(
      { spot: existingSpot, rating: input.rating, userId: input.userId },
      repository
    );
  }

  try {
    return await postFirstReview(input, repository);
  } catch (error) {
    // 別のユーザーが同じ場所を先に作成した競合。1度だけ2回目以降として再試行する
    if (error.code === ERROR_CODES.REVIEW_CONFLICT && !retried) {
      return createReview(input, repository, { retried: true });
    }

    throw error;
  }
};
