import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';
import { createRoute } from '../service.js';

/** 検証を通る最小の作成条件 */
const conditions = {
  genreName: '自然',
  targetDistanceKm: 3,
  currentLocation: { lat: 35.6862, lng: 139.7036 }
};

/**
 * @description テスト用のスポットを作る
 * @param {string} name スポット名
 * @returns {{name: string, position: number[]}} スポット
 */
const createSpot = (name) => ({ name, position: [139.703, 35.686] });

/**
 * @description テスト用のリポジトリを作る
 * @param {object} options 各リポジトリの振る舞い
 * @param {string|null} [options.genreId] ジャンルマスタが返すジャンルID
 * @param {string[]} [options.spotCategoryIds] カテゴリマスタが返すカテゴリID
 * @param {object} [options.spotsByCategoryId] カテゴリIDごとに返す候補スポット
 * @param {string[]} [options.failingCategoryIds] 検索が失敗するカテゴリID
 * @param {object[]} [options.plannedSpots] 生成が返す選定済みスポット
 * @param {number[]} [options.distancesM] 経路計算が呼ばれた順に返す総距離（m）
 * @returns {{repositories: object, calls: object}} 差し替え用のリポジトリと呼び出し記録
 */
const createRepositoryStub = ({
  genreId = 'g-nature',
  spotCategoryIds = ['park', 'garden'],
  spotsByCategoryId = {
    park: [createSpot('公園A'), createSpot('共通スポット')],
    garden: [createSpot('共通スポット'), createSpot('庭園B')]
  },
  failingCategoryIds = [],
  plannedSpots = [createSpot('スポット1'), createSpot('スポット2'), createSpot('スポット3')],
  distancesM = [1000]
} = {}) => {
  const calls = { calculateWalkingRoute: [], searchNearbySpots: [], prompts: [] };
  let callIndex = 0;

  const repositories = {
    queryGenreIdByName: async () => genreId,
    querySpotCategoryIdsByGenreId: async () => spotCategoryIds,
    searchNearbySpots: async ({ spotCategoryId }) => {
      calls.searchNearbySpots.push(spotCategoryId);

      if (failingCategoryIds.includes(spotCategoryId)) {
        throw new Error(`検索失敗: ${spotCategoryId}`);
      }

      return spotsByCategoryId[spotCategoryId] ?? [];
    },
    generateRoutePlan: async (promptText) => {
      calls.prompts.push(promptText);

      return {
        routeTitle: 'テストコース',
        conceptStory: '説明',
        spots: plannedSpots
      };
    },
    calculateWalkingRoute: async ({ spots }) => {
      calls.calculateWalkingRoute.push(spots.length);
      const totalDistanceM = distancesM[Math.min(callIndex, distancesM.length - 1)];
      callIndex += 1;

      return {
        coordinates: [
          [139.703, 35.686],
          [139.704, 35.687]
        ],
        totalDistanceM,
        totalDurationS: 600
      };
    }
  };

  return { repositories, calls };
};

describe('createRoute', () => {
  it('生成したルートを座標列とスポット一覧に整えて返す', async () => {
    const { repositories } = createRepositoryStub();

    const result = await createRoute(conditions, repositories);

    assert.equal(result.routeTitle, 'テストコース');
    assert.equal(result.conceptStory, '説明');
    assert.equal(result.totalDistanceM, 1000);
    assert.equal(result.totalDurationS, 600);
    assert.equal(result.coordinates.length, 2);
    // position を lng / lat へ展開していること
    assert.deepEqual(result.spots[0], { name: 'スポット1', lng: 139.703, lat: 35.686 });
  });

  it('カテゴリごとに検索し、スポット名の重複を除いて候補にする', async () => {
    const { repositories, calls } = createRepositoryStub();

    await createRoute(conditions, repositories);

    assert.deepEqual(calls.searchNearbySpots, ['park', 'garden']);

    // 公園A / 共通スポット / 庭園B の3件（共通スポットは1件に畳まれる）
    const candidateNames = JSON.parse(
      calls.prompts[0].match(/【候補スポットリスト】\n(.+)\n/)[1]
    ).map((spot) => spot.name);
    assert.deepEqual(candidateNames, ['公園A', '共通スポット', '庭園B']);
  });

  it('一部のカテゴリの検索が失敗しても残りの候補で続行する', async () => {
    const { repositories, calls } = createRepositoryStub({
      failingCategoryIds: ['park']
    });

    const result = await createRoute(conditions, repositories);

    assert.equal(result.routeTitle, 'テストコース');

    const candidateNames = JSON.parse(
      calls.prompts[0].match(/【候補スポットリスト】\n(.+)\n/)[1]
    ).map((spot) => spot.name);
    assert.deepEqual(candidateNames, ['共通スポット', '庭園B']);
  });

  it('ジャンルがマスタに無い場合はROUTE_NOT_FOUNDを投げる', async () => {
    const { repositories } = createRepositoryStub({ genreId: null });

    await assert.rejects(
      () => createRoute(conditions, repositories),
      (error) => {
        assert.equal(error.code, ERROR_CODES.ROUTE_NOT_FOUND);
        assert.match(error.message, /ジャンル/);
        return true;
      }
    );
  });

  it('ジャンルに紐づくカテゴリが無い場合はROUTE_NOT_FOUNDを投げる', async () => {
    const { repositories } = createRepositoryStub({ spotCategoryIds: [] });

    await assert.rejects(
      () => createRoute(conditions, repositories),
      (error) => {
        assert.equal(error.code, ERROR_CODES.ROUTE_NOT_FOUND);
        assert.match(error.message, /カテゴリ/);
        return true;
      }
    );
  });

  it('すべてのカテゴリで候補が無い場合はROUTE_NOT_FOUNDを投げる', async () => {
    const { repositories } = createRepositoryStub({ spotsByCategoryId: {} });

    await assert.rejects(
      () => createRoute(conditions, repositories),
      (error) => {
        assert.equal(error.code, ERROR_CODES.ROUTE_NOT_FOUND);
        assert.equal(error.statusCode, 404);
        return true;
      }
    );
  });

  it('目標距離を大きく超えた場合はスポットを1つ削って再計算する', async () => {
    // 目標3km に対して 1回目は 5km（許容 3.75km 超）、2回目は 3km
    const { repositories, calls } = createRepositoryStub({ distancesM: [5000, 3000] });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(calls.calculateWalkingRoute, [3, 2]);
    assert.equal(result.spots.length, 2);
    assert.equal(result.totalDistanceM, 3000);
  });

  it('スポットが最小数の場合は超過していても再計算しない', async () => {
    const { repositories, calls } = createRepositoryStub({
      plannedSpots: [createSpot('スポット1'), createSpot('スポット2')],
      distancesM: [5000, 3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(calls.calculateWalkingRoute, [2]);
    assert.equal(result.totalDistanceM, 5000);
  });
});
