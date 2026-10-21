import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getUserExperience } from '../service.js';

describe('getUserExperience', () => {
  it('累計と口コミ件数をそのまま返す', async () => {
    const repository = {
      getWalkTotalsByUserId: async () => ({
        cumulativeDistanceM: 12500,
        cumulativeMinutes: 210
      }),
      getReviewCountByUserId: async () => 3
    };

    const result = await getUserExperience({ userId: 'user-1' }, repository);

    assert.deepEqual(result, {
      cumulativeDistanceM: 12500,
      cumulativeMinutes: 210,
      reviewCount: 3
    });
  });

  it('累計アイテムが無い利用者には0を返す（エラーにしない）', async () => {
    const repository = {
      getWalkTotalsByUserId: async () => null,
      getReviewCountByUserId: async () => 2
    };

    const result = await getUserExperience({ userId: 'user-1' }, repository);

    assert.deepEqual(result, {
      cumulativeDistanceM: 0,
      cumulativeMinutes: 0,
      reviewCount: 2
    });
  });

  it('口コミが0件でも実績を返す', async () => {
    const repository = {
      getWalkTotalsByUserId: async () => ({
        cumulativeDistanceM: 800,
        cumulativeMinutes: 12
      }),
      getReviewCountByUserId: async () => 0
    };

    const result = await getUserExperience({ userId: 'user-1' }, repository);

    assert.deepEqual(result, {
      cumulativeDistanceM: 800,
      cumulativeMinutes: 12,
      reviewCount: 0
    });
  });

  it('実績が何も無い利用者にはすべて0を返す', async () => {
    const repository = {
      getWalkTotalsByUserId: async () => null,
      getReviewCountByUserId: async () => 0
    };

    const result = await getUserExperience({ userId: 'user-1' }, repository);

    assert.deepEqual(result, {
      cumulativeDistanceM: 0,
      cumulativeMinutes: 0,
      reviewCount: 0
    });
  });
});
