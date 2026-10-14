import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createWalkResult } from '../service.js';

/**
 * @description 呼び出しを記録するだけのリポジトリを作る
 * @param {object} [options] 振る舞いの指定
 * @param {boolean} [options.isStored] リポジトリが返す書き込み結果
 * @returns {object} テスト用のリポジトリと呼び出しの記録
 */
const createRepositories = ({ isStored = true } = {}) => {
  const calls = { withTotals: [], withoutTotals: [] };

  return {
    calls,
    repositories: {
      createWalkResultWithTotals: async (walkResult) => {
        calls.withTotals.push(walkResult);

        return { isStored };
      },
      createWalkResultWithoutTotals: async (walkResult) => {
        calls.withoutTotals.push(walkResult);

        return { isStored };
      }
    }
  };
};

/**
 * @description 検証済みの実績に相当するオブジェクトを作る
 * @param {object} [overrides] 上書きする項目
 * @returns {object} Serviceへ渡す実績
 */
const buildWalkResult = (overrides = {}) => ({
  walkId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  userId: 'cognito-sub-0001',
  totalDistanceM: 2500,
  spotCount: 3,
  elapsedMinutes: 42,
  startedAt: '2026-10-07T01:00:00.000Z',
  endedAt: '2026-10-07T01:42:00.000Z',
  measurementStatus: 'complete',
  routeTitle: '川沿いの散歩',
  genreId: 'nature',
  ...overrides
});

describe('createWalkResult', () => {
  it('completeの実績は累計へ加算する経路を通る', async () => {
    const { calls, repositories } = createRepositories();

    await createWalkResult(buildWalkResult(), repositories);

    assert.equal(calls.withTotals.length, 1);
    assert.equal(calls.withoutTotals.length, 0);
  });

  it('partialの実績も累計へ加算する経路を通る', async () => {
    const { calls, repositories } = createRepositories();

    await createWalkResult(
      buildWalkResult({ measurementStatus: 'partial' }),
      repositories
    );

    assert.equal(calls.withTotals.length, 1);
    assert.equal(calls.withoutTotals.length, 0);
  });

  it('unavailableの実績は累計へ加算せず記録だけ残す', async () => {
    const { calls, repositories } = createRepositories();

    await createWalkResult(
      buildWalkResult({ measurementStatus: 'unavailable' }),
      repositories
    );

    assert.equal(calls.withTotals.length, 0);
    assert.equal(calls.withoutTotals.length, 1);
  });

  it('リポジトリへ渡すアイテムにcreatedAtを付与し、userIdとwalkIdをそのまま含める', async () => {
    const { calls, repositories } = createRepositories();

    await createWalkResult(buildWalkResult(), repositories);

    const [item] = calls.withTotals;

    assert.equal(item.walkId, '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    assert.equal(item.userId, 'cognito-sub-0001');
    assert.equal(typeof item.createdAt, 'string');
    assert.equal(Number.isNaN(Date.parse(item.createdAt)), false);
    assert.equal(item.createdAt, new Date(item.createdAt).toISOString());
  });

  it('既に同じwalkIdが保存済みの場合はisAlreadySavedをtrueにして例外を投げない', async () => {
    const { repositories } = createRepositories({ isStored: false });

    const result = await createWalkResult(buildWalkResult(), repositories);

    assert.deepEqual(result, {
      walkId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      isAlreadySaved: true
    });
  });

  it('保存できた場合はisAlreadySavedをfalseにする', async () => {
    const { repositories } = createRepositories();

    const result = await createWalkResult(buildWalkResult(), repositories);

    assert.deepEqual(result, {
      walkId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      isAlreadySaved: false
    });
  });

  it('リポジトリの例外はそのまま上位へ渡す', async () => {
    await assert.rejects(
      createWalkResult(buildWalkResult(), {
        createWalkResultWithTotals: async () => {
          throw new Error('DynamoDBへのアクセスに失敗');
        },
        createWalkResultWithoutTotals: async () => ({ isStored: true })
      }),
      /DynamoDB/
    );
  });
});
