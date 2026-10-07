import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getSpot } from '../service.js';

/** テストで使う基準座標 */
const POSITION = { lng: 139.7, lat: 35.68 };

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
  ratingCount: 2,
  ratingAverage: 4.5,
  photoKeys: [],
  ...overrides
});

describe('getSpot', () => {
  it('半径40m以内に場所があれば exists:true と場所を返す', async () => {
    const repository = {
      findNearbySpots: async () => [createSpot()],
      getUserReview: async () => null
    };

    const result = await getSpot({ position: POSITION, userId: null }, repository);

    assert.equal(result.exists, true);
    assert.equal(result.spot.spotName, '中央公園');
    assert.equal(result.userReview, null);
  });

  it('認証済みなら呼び出し元の既存評価も返す', async () => {
    const repository = {
      findNearbySpots: async () => [createSpot()],
      getUserReview: async () => ({ rating: 3 })
    };

    const result = await getSpot({ position: POSITION, userId: 'user-1' }, repository);

    assert.equal(result.exists, true);
    assert.equal(result.userReview.rating, 3);
  });

  it('半径40mより遠い候補しかなければ exists:false を返す', async () => {
    // 約110m離れた候補（緯度0.001度 ≈ 111m）
    const repository = {
      findNearbySpots: async () => [
        createSpot({ position: { lng: 139.7, lat: 35.681 } })
      ],
      getUserReview: async () => null
    };

    const result = await getSpot({ position: POSITION, userId: 'user-1' }, repository);

    assert.equal(result.exists, false);
  });

  it('候補が無ければ exists:false を返す', async () => {
    const repository = {
      findNearbySpots: async () => [],
      getUserReview: async () => null
    };

    const result = await getSpot({ position: POSITION, userId: null }, repository);

    assert.equal(result.exists, false);
  });
});
