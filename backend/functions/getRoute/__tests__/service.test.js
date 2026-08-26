import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';
import { getRoute } from '../service.js';

/**
 * @description テスト用のリポジトリを作る
 * @param {object} responses 各関数が返す値
 * @returns {object} 差し替え用のリポジトリ
 */
const createRepositoryStub = ({ byCategoryAndDistance = [], byCategoryOnly = [] }) => ({
  queryRoutesByCategory: async () => byCategoryAndDistance,
  queryRoutesByCategoryOnly: async () => byCategoryOnly
});

/**
 * @description テスト用のルートを作る
 * @param {object} overrides 上書きする項目
 * @returns {object} ルート
 */
const createRoute = (overrides = {}) => ({
  routeId: 'route-1',
  routeName: 'テストコース',
  description: '説明',
  category: 'nature',
  purpose: 'refresh',
  distance: 3,
  waypoints: [{ waypointId: 'w-1', name: '公園', type: 'park', icon: '🌳' }],
  createdAt: '2026-08-01T00:00:00.000Z',
  ...overrides
});

describe('getRoute', () => {
  it('距離が一致するルートを返し、所要時間を距離から算出する', async () => {
    const repository = createRepositoryStub({
      byCategoryAndDistance: [createRoute({ distance: 3 })]
    });

    const result = await getRoute(
      { purpose: 'refresh', category: 'nature', distance: 3 },
      repository
    );

    assert.equal(result.routeId, 'route-1');
    assert.equal(result.distance, 3);
    assert.equal(result.duration, 45);
    assert.equal(result.waypoints.length, 1);
  });

  it('距離が一致しない場合はカテゴリ内で最も近い距離を選ぶ', async () => {
    const repository = createRepositoryStub({
      byCategoryAndDistance: [],
      byCategoryOnly: [
        createRoute({ routeId: 'far', distance: 8 }),
        createRoute({ routeId: 'near', distance: 3 })
      ]
    });

    const result = await getRoute(
      { purpose: 'refresh', category: 'nature', distance: 5 },
      repository
    );

    assert.equal(result.routeId, 'near');
  });

  it('目的が一致するルートを優先する', async () => {
    const repository = createRepositoryStub({
      byCategoryAndDistance: [
        createRoute({ routeId: 'other-purpose', purpose: 'exercise' }),
        createRoute({ routeId: 'same-purpose', purpose: 'cafe' })
      ]
    });

    const result = await getRoute(
      { purpose: 'cafe', category: 'nature', distance: 3 },
      repository
    );

    assert.equal(result.routeId, 'same-purpose');
  });

  it('候補が無い場合はROUTE_NOT_FOUNDを投げる', async () => {
    const repository = createRepositoryStub({});

    await assert.rejects(
      () => getRoute({ purpose: 'refresh', category: 'nature', distance: 3 }, repository),
      (error) => {
        assert.equal(error.code, ERROR_CODES.ROUTE_NOT_FOUND);
        assert.equal(error.statusCode, 404);
        return true;
      }
    );
  });
});
