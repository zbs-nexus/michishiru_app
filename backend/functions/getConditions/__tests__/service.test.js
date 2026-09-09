import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import { getConditions } from '../service.js';

/**
 * @description テスト用のリポジトリを作る
 * @param {object} options listConditionsの挙動
 * @returns {object} 差し替え用のリポジトリ
 */
const createRepositoryStub = ({ items = [], error = null } = {}) => ({
  listConditions: async () => {
    if (error) {
      throw error;
    }

    return items;
  }
});

describe('getConditions', () => {
  it('マスタ項目をそのまま返す', async () => {
    const items = [
      { pk: 'PURPOSE#ALL', purposeId: 'refresh', purposeName: '気分転換', isActive: true },
      { pk: 'GENRE#ALL', genreId: 'nature', genreName: '自然', isActive: true },
      { pk: 'DISTANCE#ALL', distanceKm: 1, displayLabel: '1km', isActive: true }
    ];
    const repository = createRepositoryStub({ items });

    const result = await getConditions(repository);

    assert.deepEqual(result, items);
    assert.equal(result.length, 3);
  });

  it('項目が無い場合は空配列を返す', async () => {
    const repository = createRepositoryStub({ items: [] });

    const result = await getConditions(repository);

    assert.deepEqual(result, []);
  });

  it('リポジトリのエラーはそのまま伝搬する', async () => {
    const repository = createRepositoryStub({
      error: createDataSourceError('取得に失敗しました')
    });

    await assert.rejects(
      () => getConditions(repository),
      (error) => {
        assert.equal(error.code, ERROR_CODES.DATA_SOURCE_ERROR);
        assert.equal(error.statusCode, 503);
        return true;
      }
    );
  });
});
