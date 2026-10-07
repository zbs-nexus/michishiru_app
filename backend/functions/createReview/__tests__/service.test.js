import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';
import { createConflictError } from '../../../shared/utils/errorHandler.js';
import { createReview } from '../service.js';

/** テストで使う基準座標 */
const POSITION = { lng: 139.7, lat: 35.68 };

/**
 * @description 呼び出しを記録するテスト用リポジトリを作る
 * @param {object} overrides 差し替える関数
 * @returns {object} リポジトリと呼び出し記録
 */
const createRepositoryStub = (overrides = {}) => {
  const calls = {};

  return {
    calls,
    findNearbySpots: overrides.findNearbySpots ?? (async () => []),
    getSpotById: overrides.getSpotById ?? (async () => null),
    getUserReview: overrides.getUserReview ?? (async () => null),
    createSpotWithReview:
      overrides.createSpotWithReview ??
      (async (arg) => {
        calls.createSpotWithReview = arg;
      }),
    addReview:
      overrides.addReview ??
      (async (arg) => {
        calls.addReview = arg;
      }),
    updateReviewRating:
      overrides.updateReviewRating ??
      (async (arg) => {
        calls.updateReviewRating = arg;
      })
  };
};

/**
 * @description 既存の場所を作る
 * @param {object} overrides 上書きする項目
 * @returns {object} 場所
 */
const createSpot = (overrides = {}) => ({
  spotId: 's-1',
  spotName: '中央公園',
  genreId: 'nature',
  genreName: '自然',
  position: POSITION,
  ratingCount: 1,
  ratingAverage: 5,
  ...overrides
});

describe('createReview', () => {
  it('近くに場所が無ければ初回投稿として場所と口コミを作成する', async () => {
    const repository = createRepositoryStub();

    const result = await createReview(
      {
        position: POSITION,
        rating: 4,
        spotName: '中央公園',
        genreId: 'nature',
        genreName: '自然',
        userId: 'user-1'
      },
      repository
    );

    assert.equal(result.isFirstReview, true);
    assert.equal(result.spot.spotName, '中央公園');
    assert.equal(result.spot.ratingAverage, 4);
    assert.equal(result.spot.ratingCount, 1);
    assert.ok(repository.calls.createSpotWithReview);
    assert.equal(repository.calls.createSpotWithReview.review.userId, 'user-1');
  });

  it('初回投稿でロケーション名・ジャンルが無い場合はVALIDATION_ERRORを投げる', async () => {
    await assert.rejects(
      () =>
        createReview(
          {
            position: POSITION,
            rating: 3,
            spotName: null,
            genreId: null,
            genreName: null,
            userId: 'user-1'
          },
          createRepositoryStub()
        ),
      (error) => {
        assert.equal(error.code, ERROR_CODES.VALIDATION_ERROR);
        return true;
      }
    );
  });

  it('半径40m以内に場所があれば2回目以降として評価のみ追加する', async () => {
    const repository = createRepositoryStub({
      findNearbySpots: async () => [createSpot()],
      getUserReview: async () => null,
      getSpotById: async () => createSpot({ ratingCount: 2, ratingAverage: 4.5 })
    });

    const result = await createReview(
      {
        position: POSITION,
        rating: 4,
        // 2回目以降は名前・ジャンルが来ても使わない
        spotName: '別の名前',
        genreId: 'city',
        genreName: '街歩き',
        userId: 'user-2'
      },
      repository
    );

    assert.equal(result.isFirstReview, false);
    assert.ok(repository.calls.addReview);
    assert.equal(repository.calls.addReview.rating, 4);
    assert.equal(result.spot.spotName, '中央公園');
    assert.equal(result.spot.ratingAverage, 4.5);
  });

  it('自分の既存の口コミがある場合は差分で集計を更新する（編集）', async () => {
    const repository = createRepositoryStub({
      findNearbySpots: async () => [createSpot()],
      getUserReview: async () => ({ rating: 2 }),
      getSpotById: async () => createSpot({ ratingCount: 1, ratingAverage: 5 })
    });

    await createReview(
      {
        position: POSITION,
        rating: 5,
        spotName: null,
        genreId: null,
        genreName: null,
        userId: 'user-2'
      },
      repository
    );

    assert.ok(repository.calls.updateReviewRating);
    assert.equal(repository.calls.updateReviewRating.delta, 3);
    assert.equal(repository.calls.addReview, undefined);
  });

  it('ユーザーIDが無い場合はUNAUTHORIZEDを投げる', async () => {
    await assert.rejects(
      () =>
        createReview(
          {
            position: POSITION,
            rating: 3,
            spotName: '公園',
            genreId: 'nature',
            genreName: '自然',
            userId: null
          },
          createRepositoryStub()
        ),
      (error) => {
        assert.equal(error.code, ERROR_CODES.UNAUTHORIZED);
        return true;
      }
    );
  });

  it('初回投稿が競合したら2回目以降として1度だけ再試行する', async () => {
    let findCallCount = 0;
    const repository = createRepositoryStub({
      findNearbySpots: async () => {
        findCallCount += 1;
        // 1回目は空（初回扱い）、2回目は既存あり（競合後の再解決）
        return findCallCount === 1 ? [] : [createSpot()];
      },
      createSpotWithReview: async () => {
        throw createConflictError('競合');
      },
      getUserReview: async () => null,
      getSpotById: async () => createSpot({ ratingCount: 2, ratingAverage: 4 })
    });

    const result = await createReview(
      {
        position: POSITION,
        rating: 3,
        spotName: '公園',
        genreId: 'nature',
        genreName: '自然',
        userId: 'user-3'
      },
      repository
    );

    assert.equal(result.isFirstReview, false);
    assert.ok(repository.calls.addReview);
  });
});
