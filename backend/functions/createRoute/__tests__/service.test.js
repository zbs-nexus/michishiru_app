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
 * @param {object[]} [options.reviewSpots] 口コミの場所として返す一覧
 * @param {boolean} [options.isReviewSpotsFailing] 口コミの場所の取得を失敗させるか
 * @param {number} [options.legCountOffset] 経路計算が返す区間の数を「スポット数+1」からずらす量
 * @param {boolean} [options.hasShortLeg] 先頭の区間を1点だけにするか
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
  strandedSpotNames = [],
  reviewSpots = [],
  isReviewSpotsFailing = false,
  legCountOffset = 0,
  hasShortLeg = false
} = {}) => {
  const calls = {
    calculateWalkingRoute: [],
    calculatedSpotNames: [],
    searchNearbySpots: [],
    prompts: []
  };
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
    listReviewSpots: async () => {
      if (isReviewSpotsFailing) {
        throw new Error('口コミの取得失敗');
      }

      return reviewSpots;
    },
    calculateWalkingRoute: async ({ spots }) => {
      calls.calculateWalkingRoute.push(spots.length);
      calls.calculatedSpotNames.push(spots.map((spot) => spot.name));
      const totalDistanceM = distancesM[Math.min(callIndex, distancesM.length - 1)];
      callIndex += 1;

      return {
        coordinates: [
          [139.703, 35.686],
          [139.704, 35.687]
        ],
        // 区間は2点の線。添字を経度に混ぜ、どの区間かを見分けられるようにする
        legCoordinates: Array.from(
          { length: spots.length + 1 + legCountOffset },
          (_, index) =>
            hasShortLeg && index === 0
              ? [[139.7, 35.686]]
              : [
                  [139.7 + index * 0.001, 35.686],
                  [139.7 + (index + 1) * 0.001, 35.686]
                ]
        ),
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
    assert.deepEqual(result.spots[0], {
      name: 'スポット1',
      lng: 139.703,
      lat: 35.686,
      isReviewSpot: false
    });
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

  it('距離が短すぎる場合（目標×DISTANCE_LOWER_RATIO未満）はスポットを増やして再生成する', async () => {
    // 1回目: 2スポットで1.4km（目標3kmの下限1.5km未満） → 2回目: 3スポットで3km（OK）
    const { repositories, calls } = createRepositoryStub({
      plannedSpotsSequence: [
        [createSpot('スポット1'), createSpot('スポット2')],
        [createSpot('スポット1'), createSpot('スポット2'), createSpot('スポット3')]
      ],
      distancesM: [1400, 3000]
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

  describe('区間ごとの線', () => {
    it('スポット数+1の区間を巡る順のまま返す', async () => {
      const { repositories } = createRepositoryStub({ distancesM: [3000] });

      const result = await createRoute(conditions, repositories);

      assert.equal(result.spots.length, 3);
      assert.equal(result.legs.length, 4);
      result.legs.forEach((leg, index) => {
        assert.deepEqual(leg, {
          coordinates: [
            [139.7 + index * 0.001, 35.686],
            [139.7 + (index + 1) * 0.001, 35.686]
          ]
        });
      });
    });

    it('区間の数がスポット数+1と異なる場合は区間を返さない', async () => {
      for (const legCountOffset of [-1, 1]) {
        const { repositories } = createRepositoryStub({ distancesM: [3000], legCountOffset });

        const result = await createRoute(conditions, repositories);

        assert.deepEqual(result.legs, []);
        // 全体の線は従来どおり返す
        assert.equal(result.coordinates.length, 2);
      }
    });

    it('2点未満の区間を含む場合は区間を返さない', async () => {
      const { repositories } = createRepositoryStub({ distancesM: [3000], hasShortLeg: true });

      const result = await createRoute(conditions, repositories);

      assert.deepEqual(result.legs, []);
    });

    it('区間の座標列を返さない経路計算でも、空の区間でルートを返す', async () => {
      const { repositories } = createRepositoryStub({ distancesM: [3000] });
      const calculate = repositories.calculateWalkingRoute;
      repositories.calculateWalkingRoute = async (args) => {
        const { legCoordinates: _legCoordinates, ...route } = await calculate(args);
        return route;
      };

      const result = await createRoute(conditions, repositories);

      assert.deepEqual(result.legs, []);
    });

    it('スポットを削って再計算した場合も、最終のスポット数+1の区間を返す', async () => {
      const { repositories } = createRepositoryStub({
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

      assert.equal(result.spots.length, 2);
      assert.equal(result.legs.length, 3);
    });
  });

  describe('おまかせ', () => {
    /** おまかせで参照するマスタ（ジャンル3件・距離1〜10km・無効ジャンル1件） */
    const conditionItems = [
      { pk: 'GENRE#ALL', genreId: 'nature', genreName: '自然', isActive: true },
      { pk: 'GENRE#ALL', genreId: 'city', genreName: '街歩き', isActive: true },
      { pk: 'GENRE#ALL', genreId: 'history', genreName: '歴史', isActive: true },
      { pk: 'GENRE#ALL', genreId: 'disabled', genreName: '無効', isActive: false },
      { pk: 'DISTANCE#ALL', distanceKm: 1, isActive: true },
      { pk: 'DISTANCE#ALL', distanceKm: 10, isActive: true }
    ];

    /**
     * @description マスタ参照と、距離に応じて許容範囲内の総距離を返す経路計算を持つスタブを作る
     * @returns {{repositories: object, calls: object}} スタブと呼び出し記録
     */
    const createRandomStub = () => {
      const stub = createRepositoryStub();
      const queriedGenreIds = [];

      stub.repositories.listConditions = async () => conditionItems;
      stub.repositories.queryGenreNumberByGenreId = async (genreId) => {
        queriedGenreIds.push(genreId);
        return genreId;
      };
      stub.repositories.querySpotCategoryIdsByGenreNumber = async () => ['park', 'garden'];

      // 経路の総距離をプロンプトの目標距離に合わせ、どの距離が選ばれても許容範囲に収める
      const calculateWalkingRoute = stub.repositories.calculateWalkingRoute;
      stub.repositories.calculateWalkingRoute = async (request) => {
        const route = await calculateWalkingRoute(request);
        const targetKm = Number(stub.calls.prompts.at(-1).match(/目標距離: ([\d.]+) km/)[1]);

        return { ...route, totalDistanceM: targetKm * 1000 };
      };

      return { ...stub, queriedGenreIds };
    };

    it('ジャンルのおまかせは有効なジャンルから1件以上を選び、選んだ値を返す', async () => {
      for (let trial = 0; trial < 20; trial += 1) {
        const { repositories, queriedGenreIds } = createRandomStub();

        const result = await createRoute(
          { targetDistanceKm: 3, currentLocation: conditions.currentLocation, isGenreRandom: true },
          repositories
        );

        const selectedIds = result.selectedGenres.map((genre) => genre.genreId);
        assert.ok(selectedIds.length >= 1 && selectedIds.length <= 3);
        assert.ok(selectedIds.every((id) => ['nature', 'city', 'history'].includes(id)));
        assert.equal(new Set(selectedIds).size, selectedIds.length);
        assert.deepEqual([...queriedGenreIds].sort(), [...selectedIds].sort());
        assert.equal(result.selectedDistanceKm, undefined);
      }
    });

    it('距離のおまかせはマスタの最小〜最大から1km単位で選ぶ', async () => {
      for (let trial = 0; trial < 30; trial += 1) {
        const { repositories, calls } = createRandomStub();

        const result = await createRoute(
          { genreId: 'nature', currentLocation: conditions.currentLocation, isDistanceRandom: true },
          repositories
        );

        assert.ok(Number.isInteger(result.selectedDistanceKm));
        assert.ok(result.selectedDistanceKm >= 1 && result.selectedDistanceKm <= 10);
        assert.match(calls.prompts[0], new RegExp(`目標距離: ${result.selectedDistanceKm} km`));
        assert.equal(result.selectedGenres, undefined);
      }
    });

    it('おまかせを使わない場合はマスタを全件取得しない', async () => {
      const { repositories } = createRandomStub();
      let isListed = false;
      repositories.listConditions = async () => {
        isListed = true;
        return conditionItems;
      };

      const result = await createRoute(conditions, repositories);

      assert.equal(isListed, false);
      assert.equal(result.selectedGenres, undefined);
    });
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

describe('createRoute（口コミの場所とチェーン店）', () => {
  /** 現在地から約150mの口コミの場所（目標距離3kmの範囲内） */
  const nearReviewSpot = {
    name: '口コミ近',
    genreId: 'nature',
    position: [139.7045, 35.6872],
    ratingAverage: 4
  };

  /** 現在地から約4.6kmの口コミの場所（目標距離3kmの範囲外） */
  const farReviewSpot = {
    name: '口コミ遠',
    genreId: 'nature',
    position: [139.75, 35.7],
    ratingAverage: 5
  };

  /**
   * @description プロンプトに渡った候補を取り出す
   * @param {string} promptText プロンプト
   * @returns {object[]} 候補
   */
  const extractCandidates = (promptText) =>
    JSON.parse(promptText.match(/【候補スポットリスト】\n(.+)\n/)[1]);

  it('距離以内の口コミの場所を目印付きで先頭に入れ、範囲外は入れず、チェーン店は後ろへ回す', async () => {
    const { repositories, calls } = createRepositoryStub({
      spotsByCategoryId: {
        park: [{ ...createSpot('チェーンX'), isChain: true }, createSpot('公園A')],
        garden: [createSpot('庭園B')]
      },
      reviewSpots: [farReviewSpot, nearReviewSpot]
    });

    await createRoute(conditions, repositories);

    assert.deepEqual(extractCandidates(calls.prompts[0]), [
      { name: '口コミ近', position: nearReviewSpot.position, isReviewSpot: true, ratingAverage: 4 },
      { name: '公園A', position: [139.703, 35.686] },
      { name: '庭園B', position: [139.703, 35.686] },
      { name: 'チェーンX', position: [139.703, 35.686], isChain: true }
    ]);
  });

  it('口コミの場所と同じ場所にあるPlacesの候補は外す', async () => {
    const { repositories, calls } = createRepositoryStub({
      spotsByCategoryId: {
        park: [{ name: '同じ場所の公園', position: [139.70451, 35.68721] }, createSpot('公園A')],
        garden: []
      },
      reviewSpots: [nearReviewSpot]
    });

    await createRoute(conditions, repositories);

    const names = extractCandidates(calls.prompts[0]).map((spot) => spot.name);
    assert.deepEqual(names, ['口コミ近', '公園A']);
  });

  it('Bedrockが口コミの場所を選んだ場合は、そのまま星の目印を付けて返す', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [nearReviewSpot],
      plannedSpotsSequence: [[{ name: '口コミ近', position: nearReviewSpot.position }, createSpot('スポット1')]],
      distancesM: [3000]
    });

    const result = await createRoute(conditions, repositories);

    // 差し込みは行わない（経路計算は1回）
    assert.deepEqual(calls.calculateWalkingRoute, [2]);
    assert.deepEqual(
      result.spots.map((spot) => [spot.name, spot.isReviewSpot]),
      [
        ['口コミ近', true],
        ['スポット1', false]
      ]
    );
  });

  it('口コミの場所を通らない場合は、距離が収まる範囲で1か所差し込む', async () => {
    const { repositories } = createRepositoryStub({
      reviewSpots: [nearReviewSpot],
      distancesM: [3000, 3200]
    });

    const result = await createRoute(conditions, repositories);

    assert.equal(result.totalDistanceM, 3200);
    assert.equal(result.spots.length, 4);
    assert.equal(result.spots.filter((spot) => spot.isReviewSpot).length, 1);
    assert.equal(result.spots.find((spot) => spot.isReviewSpot).name, '口コミ近');
  });

  it('差し込むと距離が条件を外れる場合は、口コミの場所を通らないルートのままにする', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [nearReviewSpot],
      distancesM: [3000, 9000]
    });

    const result = await createRoute(conditions, repositories);

    assert.equal(result.totalDistanceM, 3000);
    assert.deepEqual(
      result.spots.map((spot) => spot.name),
      ['スポット1', 'スポット2', 'スポット3']
    );
    // 差し込み・入れ替えを試したうえで諦めている
    assert.ok(calls.calculateWalkingRoute.length > 1);
  });

  it('距離以内に口コミの場所が無ければ、差し込みを試さない', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [farReviewSpot],
      distancesM: [3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(calls.calculateWalkingRoute, [3]);
    assert.ok(result.spots.every((spot) => spot.isReviewSpot === false));
  });

  it('距離超過でスポットを削るときは、口コミの場所を残して口コミでないスポットから外す', async () => {
    // 口コミの場所を最後尾に置く。単純に最後尾を外す実装だと口コミの場所が消えるため、
    // 「口コミでないスポットから外す」ことをこの並びで見分けられる
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [nearReviewSpot],
      plannedSpotsSequence: [
        [createSpot('スポット1'), createSpot('スポット2'), { name: '口コミ近', position: nearReviewSpot.position }]
      ],
      distancesM: [9000, 3000]
    });

    const result = await createRoute(conditions, repositories);

    // 最後尾の口コミの場所ではなく、その手前の口コミでないスポットを外している
    assert.deepEqual(calls.calculatedSpotNames[1], ['スポット1', '口コミ近']);
    assert.deepEqual(
      result.spots.map((spot) => [spot.name, spot.isReviewSpot]),
      [
        ['スポット1', false],
        ['口コミ近', true]
      ]
    );
  });

  it('口コミの場所の取得に失敗しても、口コミの場所なしでルートを作る', async () => {
    const { repositories, calls } = createRepositoryStub({
      isReviewSpotsFailing: true,
      distancesM: [3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.equal(result.routeTitle, 'テストコース');
    assert.deepEqual(calls.calculateWalkingRoute, [3]);
  });
});

describe('createRoute（口コミの場所の境界ケース）', () => {
  /** 現在地から約150mの口コミの場所 */
  const nearReviewSpot = {
    name: '口コミ近',
    genreId: 'nature',
    position: [139.7045, 35.6872],
    ratingAverage: 4
  };

  /**
   * @description 現在地から少しずつ離れた口コミの場所を作る（すべて3km以内）
   * @param {number} count 作る件数
   * @returns {object[]} 口コミの場所（近い順）
   */
  const createReviewSpots = (count) =>
    Array.from({ length: count }, (_, index) => ({
      name: `口コミ${index + 1}`,
      genreId: 'nature',
      position: [139.7036 + (index + 1) * 0.001, 35.6862],
      ratingAverage: 3
    }));

  /**
   * @description プロンプトに渡った候補を取り出す
   * @param {string} promptText プロンプト
   * @returns {object[]} 候補
   */
  const extractCandidates = (promptText) =>
    JSON.parse(promptText.match(/【候補スポットリスト】\n(.+)\n/)[1]);

  it('差し込むと距離を超え、入れ替えなら収まる場合は入れ替えを採用する', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [nearReviewSpot],
      // 初回 3000 → 差し込み 9000（不採用）→ 入れ替え 3100（採用）
      distancesM: [3000, 9000, 3100]
    });

    const result = await createRoute(conditions, repositories);

    assert.equal(calls.calculateWalkingRoute.length, 3);
    assert.equal(result.totalDistanceM, 3100);
    // 入れ替えなのでスポット数は変わらず、口コミの場所が1か所入る
    assert.equal(result.spots.length, 3);
    assert.deepEqual(
      result.spots.filter((spot) => spot.isReviewSpot).map((spot) => spot.name),
      ['口コミ近']
    );
  });

  it('口コミの場所が徒歩で到達できない（経路から大きく外れる）場合は、距離が収まっても採用しない', async () => {
    const { repositories } = createRepositoryStub({
      reviewSpots: [nearReviewSpot],
      strandedSpotNames: ['口コミ近'],
      distancesM: [3000, 3000, 3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(
      result.spots.map((spot) => spot.name),
      ['スポット1', 'スポット2', 'スポット3']
    );
  });

  it('差し込みの経路計算が失敗しても、元のルートを返す（エラーにしない）', async () => {
    const { repositories } = createRepositoryStub({
      reviewSpots: [nearReviewSpot],
      distancesM: [3000]
    });

    const calculate = repositories.calculateWalkingRoute;
    let callCount = 0;
    repositories.calculateWalkingRoute = async (args) => {
      callCount += 1;

      if (callCount === 2) {
        throw new Error('経路計算失敗');
      }

      return calculate(args);
    };

    const result = await createRoute(conditions, repositories);

    assert.equal(result.totalDistanceM, 3000);
    assert.ok(result.spots.every((spot) => spot.isReviewSpot === false));
  });

  it('差し込みの試行は上限回数（3回）までにする（タイムアウト対策）', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: createReviewSpots(3),
      // 差し込みはすべて距離超過で不採用
      distancesM: [3000, 9000]
    });

    await createRoute(conditions, repositories);

    // 初回1回 + 試行3回
    assert.equal(calls.calculateWalkingRoute.length, 4);
  });

  it('プロンプトへ渡す口コミの場所は、近い順に上限件数（5件）までにする', async () => {
    const { repositories, calls } = createRepositoryStub({
      // あえて遠い順に返し、並べ替えを確かめる
      reviewSpots: createReviewSpots(7).reverse()
    });

    await createRoute(conditions, repositories);

    const reviewNames = extractCandidates(calls.prompts[0])
      .filter((spot) => spot.isReviewSpot)
      .map((spot) => spot.name);
    assert.deepEqual(reviewNames, ['口コミ1', '口コミ2', '口コミ3', '口コミ4', '口コミ5']);
  });

  it('名前が空・座標が不正な口コミの場所は候補にしない', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [
        { name: '', genreId: 'nature', position: [139.7045, 35.6872] },
        { name: '座標なし', genreId: 'nature', position: [Number.NaN, Number.NaN] },
        nearReviewSpot
      ]
    });

    await createRoute(conditions, repositories);

    const reviewNames = extractCandidates(calls.prompts[0])
      .filter((spot) => spot.isReviewSpot)
      .map((spot) => spot.name);
    assert.deepEqual(reviewNames, ['口コミ近']);
  });

  it('Placesの候補が無くても、口コミの場所があればルートを作る', async () => {
    const { repositories, calls } = createRepositoryStub({
      spotsByCategoryId: { park: [], garden: [] },
      reviewSpots: [nearReviewSpot],
      plannedSpotsSequence: [[{ name: '口コミ近', position: nearReviewSpot.position }]],
      distancesM: [3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(
      extractCandidates(calls.prompts[0]).map((spot) => spot.name),
      ['口コミ近']
    );
    assert.equal(result.spots[0].isReviewSpot, true);
  });

  it('Placesの候補も口コミの場所も無ければ、従来どおり ROUTE_NOT_FOUND にする', async () => {
    const { repositories } = createRepositoryStub({
      spotsByCategoryId: { park: [], garden: [] },
      reviewSpots: []
    });

    await assert.rejects(
      () => createRoute(conditions, repositories),
      (error) => {
        assert.equal(error.code, ERROR_CODES.ROUTE_NOT_FOUND);
        return true;
      }
    );
  });

  it('すべて口コミの場所のルートで距離を超えた場合は、距離を優先して最後尾を外す', async () => {
    const reviewSpots = createReviewSpots(2);
    const { repositories, calls } = createRepositoryStub({
      reviewSpots,
      plannedSpotsSequence: [
        reviewSpots.map((spot) => ({ name: spot.name, position: spot.position }))
      ],
      distancesM: [9000, 3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(calls.calculatedSpotNames[1], ['口コミ1']);
    assert.equal(result.totalDistanceM, 3000);
    // 口コミの場所が既に含まれるため、差し込みは行わない
    assert.equal(calls.calculateWalkingRoute.length, 2);
  });

  it('チェーン店しか無い場合も、チェーン店を候補から消さずにルートを作る', async () => {
    const { repositories, calls } = createRepositoryStub({
      spotsByCategoryId: {
        park: [{ ...createSpot('チェーンX'), isChain: true }],
        garden: [{ ...createSpot('チェーンY'), isChain: true }]
      }
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(
      extractCandidates(calls.prompts[0]).map((spot) => spot.name),
      ['チェーンX', 'チェーンY']
    );
    assert.equal(result.routeTitle, 'テストコース');
  });
});

describe('createRoute（口コミの場所とジャンル）', () => {
  /**
   * @description 現在地から約150mの口コミの場所を作る
   * @param {string} name 名前
   * @param {string|null|undefined} genreId 投稿時に選んだジャンル
   * @returns {object} 口コミの場所
   */
  const createReviewSpot = (name, genreId) => ({
    name,
    genreId,
    position: [139.7045, 35.6872],
    ratingAverage: 4
  });

  /**
   * @description プロンプトに渡った口コミの場所の名前を取り出す
   * @param {string} promptText プロンプト
   * @returns {string[]} 口コミの場所の名前
   */
  const reviewNamesInPrompt = (promptText) =>
    JSON.parse(promptText.match(/【候補スポットリスト】\n(.+)\n/)[1])
      .filter((spot) => spot.isReviewSpot)
      .map((spot) => spot.name);

  it('検索条件のジャンルと同じジャンルの口コミの場所だけを候補にする', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [
        createReviewSpot('自然の口コミ', 'nature'),
        createReviewSpot('グルメの口コミ', 'gourmet'),
        createReviewSpot('歴史の口コミ', 'history')
      ]
    });

    // conditions.genreId は nature
    await createRoute(conditions, repositories);

    assert.deepEqual(reviewNamesInPrompt(calls.prompts[0]), ['自然の口コミ']);
  });

  it('ジャンルが合う口コミの場所が無ければ、差し込みも行わない', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [createReviewSpot('グルメの口コミ', 'gourmet')],
      distancesM: [3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(reviewNamesInPrompt(calls.prompts[0]), []);
    // 初回の経路計算のみ（差し込みを試していない）
    assert.equal(calls.calculateWalkingRoute.length, 1);
    assert.ok(result.spots.every((spot) => spot.isReviewSpot === false));
  });

  it('ジャンルを持たない口コミの場所は、条件に合うか判断できないため候補にしない', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [
        createReviewSpot('ジャンルなし', null),
        createReviewSpot('ジャンル未設定', undefined),
        createReviewSpot('自然の口コミ', 'nature')
      ]
    });

    await createRoute(conditions, repositories);

    assert.deepEqual(reviewNamesInPrompt(calls.prompts[0]), ['自然の口コミ']);
  });

  it('ジャンルのおまかせでは、選ばれたいずれかのジャンルに合う口コミの場所を候補にする', async () => {
    const stub = createRepositoryStub({
      reviewSpots: [
        createReviewSpot('自然の口コミ', 'nature'),
        createReviewSpot('街歩きの口コミ', 'city'),
        createReviewSpot('グルメの口コミ', 'gourmet')
      ]
    });

    // おまかせで選べるジャンルを nature と city の2つに限り、必ず両方が選ばれる状況を作る
    stub.repositories.listConditions = async () => [
      { pk: 'GENRE#ALL', genreId: 'nature', genreName: '自然', isActive: true },
      { pk: 'GENRE#ALL', genreId: 'city', genreName: '街歩き', isActive: true }
    ];
    stub.repositories.queryGenreNumberByGenreId = async (genreId) => genreId;

    for (let trial = 0; trial < 10; trial += 1) {
      stub.calls.prompts.length = 0;

      const result = await createRoute(
        { targetDistanceKm: 3, currentLocation: conditions.currentLocation, isGenreRandom: true },
        stub.repositories
      );

      const selectedIds = result.selectedGenres.map((genre) => genre.genreId);
      const expectedNames = [
        ['自然の口コミ', 'nature'],
        ['街歩きの口コミ', 'city']
      ]
        .filter(([, genreId]) => selectedIds.includes(genreId))
        .map(([name]) => name);

      // 選ばれなかったジャンル・どれにも当たらないジャンル（gourmet）の口コミの場所は入らない
      assert.deepEqual(
        [...reviewNamesInPrompt(stub.calls.prompts[0])].sort(),
        [...expectedNames].sort()
      );
    }
  });
});

describe('createRoute（口コミの場所の評価の優先と、地図で開くための情報）', () => {
  /**
   * @description 現在地から少しずつ離れた口コミの場所を作る（すべて3km以内・ジャンルは nature）
   * @param {string} name 名前
   * @param {number} order 現在地から何番目に近いか（1始まり）
   * @param {number} ratingAverage 平均評価
   * @param {number} [ratingCount] 口コミの件数
   * @returns {object} 口コミの場所
   */
  const createRatedSpot = (name, order, ratingAverage, ratingCount = 1) => ({
    spotId: `review-${name}`,
    name,
    genreId: 'nature',
    position: [139.7036 + order * 0.001, 35.6862],
    ratingAverage,
    ratingCount
  });

  /**
   * @description プロンプトに渡った口コミの場所を取り出す
   * @param {string} promptText プロンプト
   * @returns {object[]} 口コミの場所の候補
   */
  const reviewCandidatesInPrompt = (promptText) =>
    JSON.parse(promptText.match(/【候補スポットリスト】\n(.+)\n/)[1]).filter(
      (spot) => spot.isReviewSpot
    );

  it('口コミの場所は、近さより評価の高さを優先して上限件数（5件）まで候補に入れる', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [
        createRatedSpot('近いが★1', 1, 1),
        createRatedSpot('★5', 7, 5),
        createRatedSpot('★2', 2, 2),
        createRatedSpot('★4.5', 6, 4.5),
        createRatedSpot('★3', 3, 3),
        createRatedSpot('★4', 5, 4),
        createRatedSpot('★3.5', 4, 3.5)
      ]
    });

    await createRoute(conditions, repositories);

    assert.deepEqual(
      reviewCandidatesInPrompt(calls.prompts[0]).map((spot) => spot.name),
      ['★5', '★4.5', '★4', '★3.5', '★3']
    );
  });

  it('平均評価が同じなら口コミの多い場所、それも同じなら近い場所を先にする', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [
        createRatedSpot('★4・1件・近い', 1, 4, 1),
        createRatedSpot('★4・3件・遠い', 5, 4, 3),
        createRatedSpot('★4・1件・遠い', 4, 4, 1)
      ]
    });

    await createRoute(conditions, repositories);

    assert.deepEqual(
      reviewCandidatesInPrompt(calls.prompts[0]).map((spot) => spot.name),
      ['★4・3件・遠い', '★4・1件・近い', '★4・1件・遠い']
    );
  });

  it('Bedrockへは口コミの場所の平均評価を小数第1位で渡す', async () => {
    const { repositories, calls } = createRepositoryStub({
      reviewSpots: [createRatedSpot('口コミA', 1, 4.666, 3)]
    });

    await createRoute(conditions, repositories);

    assert.equal(reviewCandidatesInPrompt(calls.prompts[0])[0].ratingAverage, 4.7);
  });

  it('差し込みは評価の高い口コミの場所から試す', async () => {
    const { repositories, calls } = createRepositoryStub({
      // 近い（遠回りが小さい）ほど評価が低い並び
      reviewSpots: [
        createRatedSpot('近いが★2', 1, 2),
        createRatedSpot('遠いが★5', 6, 5)
      ],
      distancesM: [3000, 3200]
    });

    const result = await createRoute(conditions, repositories);

    // 初回の経路計算の次（1回目の差し込み）で、★5 の場所を試している
    assert.ok(calls.calculatedSpotNames[1].includes('遠いが★5'));
    assert.deepEqual(
      result.spots.filter((spot) => spot.isReviewSpot).map((spot) => spot.name),
      ['遠いが★5']
    );
  });

  it('口コミの場所のスポットには、口コミを開くためのIDと元の座標を付ける', async () => {
    const reviewSpot = createRatedSpot('口コミA', 2, 4);
    const { repositories } = createRepositoryStub({
      reviewSpots: [reviewSpot],
      plannedSpotsSequence: [
        [{ name: '口コミA', position: reviewSpot.position }, createSpot('スポット1')]
      ],
      distancesM: [3000]
    });

    // 経路へ寄せた座標（スナップ後）を元の座標と変え、取り違えていないかを見分ける
    const calculate = repositories.calculateWalkingRoute;
    repositories.calculateWalkingRoute = async (args) => {
      const route = await calculate(args);
      return {
        ...route,
        spotSnappedPositions: args.spots.map((spot) => [spot.position[0] + 0.0005, spot.position[1]])
      };
    };

    const result = await createRoute(conditions, repositories);
    const [reviewResult, normalResult] = result.spots;

    assert.equal(reviewResult.reviewSpotId, 'review-口コミA');
    assert.equal(reviewResult.reviewLng, reviewSpot.position[0]);
    assert.equal(reviewResult.reviewLat, reviewSpot.position[1]);
    // 案内に使う座標（lng / lat）は従来どおり経路へ寄せた座標
    assert.equal(reviewResult.lng, reviewSpot.position[0] + 0.0005);

    // 口コミでないスポットには付けない
    assert.equal('reviewSpotId' in normalResult, false);
    assert.equal('reviewLng' in normalResult, false);
  });

  it('差し込んだ口コミの場所にも、口コミを開くためのIDを付ける', async () => {
    const { repositories } = createRepositoryStub({
      reviewSpots: [createRatedSpot('口コミA', 2, 4)],
      distancesM: [3000, 3200]
    });

    const result = await createRoute(conditions, repositories);
    const inserted = result.spots.find((spot) => spot.isReviewSpot);

    assert.equal(inserted.reviewSpotId, 'review-口コミA');
  });

  it('プロンプトに入れなかった口コミの場所と同名のスポットは、口コミの場所として扱わない', async () => {
    const reviewSpots = [
      createRatedSpot('★5', 1, 5),
      createRatedSpot('★4.9', 2, 4.9),
      createRatedSpot('★4.8', 3, 4.8),
      createRatedSpot('★4.7', 4, 4.7),
      createRatedSpot('★4.6', 5, 4.6),
      // 上限（5件）から漏れる
      createRatedSpot('漏れた★1', 6, 1)
    ];
    const { repositories } = createRepositoryStub({
      reviewSpots,
      plannedSpotsSequence: [
        [createSpot('漏れた★1'), { name: '★5', position: reviewSpots[0].position }]
      ],
      distancesM: [3000]
    });

    const result = await createRoute(conditions, repositories);

    assert.deepEqual(
      result.spots.map((spot) => [spot.name, spot.isReviewSpot]),
      [
        ['漏れた★1', false],
        ['★5', true]
      ]
    );
  });
});
