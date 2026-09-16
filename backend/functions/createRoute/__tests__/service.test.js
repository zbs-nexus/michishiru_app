import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';
import { createRoute } from '../service.js';

/** 検証を通る最小の作成条件 */
const conditions = {
  genreId: 'nature',
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
 * @param {string|null} [options.genreNumber] ジャンルマスタが返す数値ジャンルキー
 * @param {string[]} [options.spotCategoryIds] カテゴリマスタが返すカテゴリID
 * @param {object} [options.spotsByCategoryId] カテゴリIDごとに返す候補スポット
 * @param {string[]} [options.failingCategoryIds] 検索が失敗するカテゴリID
 * @param {object[][]} [options.plannedSpotsSequence] 生成が返すスポットの配列（呼び出し順）
 * @param {number[]} [options.distancesM] 経路計算が呼ばれた順に返す総距離（m）
 * @param {string[]} [options.strandedSpotNames] 経路から大きく外れている（乖離大）とみなすスポット名
 * @returns {{repositories: object, calls: object}} 差し替え用のリポジトリと呼び出し記録
 */
const createRepositoryStub = ({
  genreNumber = '2',
  spotCategoryIds = ['park', 'garden'],
  spotsByCategoryId = {
    park: [createSpot('公園A'), createSpot('共通スポット')],
    garden: [createSpot('共通スポット'), createSpot('庭園B')]
  },
  failingCategoryIds = [],
  plannedSpotsSequence = [[createSpot('スポット1'), createSpot('スポット2'), createSpot('スポット3')]],
  distancesM = [3000],
  strandedSpotNames = []
} = {}) => {
  const calls = { calculateWalkingRoute: [], searchNearbySpots: [], prompts: [] };
  let callIndex = 0;
  let planCallIndex = 0;

  const repositories = {
    queryGenreNumberByGenreId: async () => genreNumber,
    querySpotCategoryIdsByGenreNumber: async () => spotCategoryIds,
    searchNearbySpots: async ({ spotCategoryId }) => {
      calls.searchNearbySpots.push(spotCategoryId);

      if (failingCategoryIds.includes(spotCategoryId)) {
        throw new Error(`検索失敗: ${spotCategoryId}`);
      }

      return spotsByCategoryId[spotCategoryId] ?? [];
    },
    generateRoutePlan: async (promptText) => {
      calls.prompts.push(promptText);
      const spots = plannedSpotsSequence[Math.min(planCallIndex, plannedSpotsSequence.length - 1)];
      planCallIndex += 1;

      return {
        routeTitle: 'テストコース',
        conceptStory: '説明',
        spots
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
        totalDurationS: 600,
        // スナップ後座標は元座標と同一とし、乖離は strandedSpotNames のスポットだけ大きくする
        spotSnappedPositions: spots.map((spot) => spot.position),
        spotStrayDistancesM: spots.map((spot) =>
          strandedSpotNames.includes(spot.name) ? 500 : 0
        )
      };
    }
  };

  return { repositories, calls };
};

describe('createRoute', () => {
  it('生成したルートを座標列とスポット一覧に整えて返す', async () => {
    const { repositories } = createRepositoryStub({ distancesM: [3000] });

    const result = await createRoute(conditions, repositories);

    assert.equal(result.routeTitle, 'テストコース');
    assert.equal(result.conceptStory, '説明');
    assert.equal(result.totalDistanceM, 3000);
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
    const { repositories } = createRepositoryStub({ genreNumber: null });

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

  it('目標距離を大きく超えた場合は許容範囲内になるまでスポットを削って再計算する', async () => {
    // 目標3km に対して 1回目は 6km（許容 3.75km 超）、2回目は 5km（超）、3回目は 3.5km（許容範囲内）
    const { repositories, calls } = createRepositoryStub({
      plannedSpotsSequence: [
        [
          createSpot('スポット1'),
          createSpot('スポット2'),
          createSpot('スポット3'),
          createSpot('スポット4')
        ]
      ],
      distancesM: [6000, 5000, 3500]
    });

    const result = await createRoute(conditions, repositories);

    // 3回呼ばれ、4スポット → 3スポット → 2スポットになったことを確認
    assert.deepEqual(calls.calculateWalkingRoute, [4, 3, 2]);
    assert.equal(result.spots.length, 2);
    assert.equal(result.totalDistanceM, 3500);
  });

  it('距離が短すぎる場合（目標-1km未満）はスポットを増やして再生成する', async () => {
    // 1回目: 2スポットで1.5km（短すぎる） → 2回目: 3スポットで3km（OK）
    const { repositories, calls } = createRepositoryStub({
      plannedSpotsSequence: [
        [createSpot('スポット1'), createSpot('スポット2')],
        [createSpot('スポット1'), createSpot('スポット2'), createSpot('スポット3')]
      ],
      distancesM: [1500, 3000]
    });

    const result = await createRoute(conditions, repositories);

    // AIを2回呼び、経路計算も2回実行
    assert.equal(calls.prompts.length, 2);
    assert.deepEqual(calls.calculateWalkingRoute, [2, 3]);
    assert.equal(result.spots.length, 3);
    assert.equal(result.totalDistanceM, 3000);
  });

  it('許容範囲外のルートしか作れない場合はROUTE_NOT_FOUNDを投げる', async () => {
    // スポット1個で5km（目標3kmの上限4.2km超）、削れないし短くもできない
    const { repositories } = createRepositoryStub({
      plannedSpotsSequence: [[createSpot('スポット1')]],
      distancesM: [5000]
    });

    await assert.rejects(
      () => createRoute(conditions, repositories),
      (error) => {
        assert.equal(error.code, ERROR_CODES.ROUTE_NOT_FOUND);
        assert.match(error.message, /ジャンルと距離/);
        return true;
      }
    );
  });

  it('スポットが最小数（1個）の場合は超過していても削らない', async () => {
    const { repositories, calls } = createRepositoryStub({
      plannedSpotsSequence: [[createSpot('スポット1')]],
      distancesM: [3500]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(calls.calculateWalkingRoute, [1]);
    assert.equal(result.totalDistanceM, 3500);
  });

  it('目標距離の許容範囲（±1km）内の場合は調整しない', async () => {
    // 目標3km に対して 3.5km（許容範囲内: 2km〜4km）
    const { repositories, calls } = createRepositoryStub({
      distancesM: [3500]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(calls.calculateWalkingRoute, [3]);
    assert.equal(result.totalDistanceM, 3500);
  });

  it('経路から大きく外れたスポット（徒歩到達困難）を除外して再計算する', async () => {
    // スポット1が経路から500m外れている（例: 皇居内の施設）。除外して残り2スポットで再計算する
    const { repositories, calls } = createRepositoryStub({
      plannedSpotsSequence: [
        [createSpot('スポット1'), createSpot('スポット2'), createSpot('スポット3')]
      ],
      strandedSpotNames: ['スポット1'],
      distancesM: [3000, 3000]
    });

    const result = await createRoute(conditions, repositories);

    // 3スポットで計算 → 乖離スポットを除外 → 2スポットで再計算
    assert.deepEqual(calls.calculateWalkingRoute, [3, 2]);
    assert.equal(result.spots.length, 2);
    assert.deepEqual(
      result.spots.map((spot) => spot.name),
      ['スポット2', 'スポット3']
    );
  });

  it('乖離スポットを除外すると最小数を下回る場合は除外しない', async () => {
    // 1スポットだけで、それが乖離大でも、除外すると0件になるため残す
    const { repositories, calls } = createRepositoryStub({
      plannedSpotsSequence: [[createSpot('スポット1')]],
      strandedSpotNames: ['スポット1'],
      distancesM: [3000]
    });

    const result = await createRoute(conditions, repositories);

    // 除外せず1回のみ計算し、スポットは残る
    assert.deepEqual(calls.calculateWalkingRoute, [1]);
    assert.equal(result.spots.length, 1);
  });
});
