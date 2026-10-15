import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getUserReviews } from '../service.js';

describe('getUserReviews', () => {
  it('口コミに場所の座標・名前を紐づけて返す', async () => {
    const repository = {
      listReviewsByUser: async () => [
        { spotId: 's-1', rating: 4, createdAt: '2026-10-07T00:00:00.000Z' },
        { spotId: 's-2', rating: 5, createdAt: '2026-10-06T00:00:00.000Z' }
      ],
      getSpotsByIds: async () =>
        new Map([
          ['s-1', { position: { lng: 139.7, lat: 35.68 }, spotName: '公園' }],
          ['s-2', { position: { lng: 139.71, lat: 35.69 }, spotName: 'カフェ' }]
        ])
    };

    const result = await getUserReviews({ userId: 'user-1' }, repository);

    assert.equal(result.reviews.length, 2);
    assert.equal(result.reviews[0].spotName, '公園');
    assert.equal(result.reviews[0].rating, 4);
    assert.deepEqual(result.reviews[0].position, { lng: 139.7, lat: 35.68 });
  });

  it('場所メタが取得できない口コミは除外する', async () => {
    const repository = {
      listReviewsByUser: async () => [
        { spotId: 's-1', rating: 4, createdAt: '2026-10-07T00:00:00.000Z' },
        { spotId: 'missing', rating: 3, createdAt: '2026-10-06T00:00:00.000Z' }
      ],
      getSpotsByIds: async () =>
        new Map([['s-1', { position: { lng: 139.7, lat: 35.68 }, spotName: '公園' }]])
    };

    const result = await getUserReviews({ userId: 'user-1' }, repository);

    assert.equal(result.reviews.length, 1);
    assert.equal(result.reviews[0].spotId, 's-1');
  });

  it('口コミが無ければ空配列を返す', async () => {
    const repository = {
      listReviewsByUser: async () => [],
      getSpotsByIds: async () => new Map()
    };

    const result = await getUserReviews({ userId: 'user-1' }, repository);

    assert.deepEqual(result.reviews, []);
  });
});
