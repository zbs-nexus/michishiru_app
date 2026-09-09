import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';
import { createRoute } from '../service.js';

/** 検証を通る最小の作成条件 */
const conditions = {
  spotCategory: 'coffee_shop',
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
 * @param {object[]} [options.candidateSpots] 周辺検索が返す候補
 * @param {object[]} [options.plannedSpots] 生成が返す選定済みスポット
 * @param {number[]} [options.distancesM] 経路計算が呼ばれた順に返す総距離（m）
 * @returns {{repositories: object, calls: object}} 差し替え用のリポジトリと呼び出し記録
 */
const createRepositoryStub = ({
  candidateSpots = [createSpot('候補A'), createSpot('候補B')],
  plannedSpots = [createSpot('スポット1'), createSpot('スポット2'), createSpot('スポット3')],
  distancesM = [1000]
} = {}) => {
  const calls = { calculateWalkingRoute: [] };
  let callIndex = 0;

  const repositories = {
    searchNearbySpots: async () => candidateSpots,
    generateRoutePlan: async () => ({
      routeTitle: 'テストコース',
      conceptStory: '説明',
      spots: plannedSpots
    }),
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

  it('周辺スポットが無い場合はROUTE_NOT_FOUNDを投げる', async () => {
    const { repositories } = createRepositoryStub({ candidateSpots: [] });

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
