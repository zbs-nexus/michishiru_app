import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchIdToken } from '@/services/authService';
import { fetchConditionOptions } from '@/services/conditionService';

// Amplifyの実体を読み込ませないため、トークン取得を差し替える
vi.mock('@/services/authService', () => ({
  fetchIdToken: vi.fn(async () => 'dummy-id-token')
}));

/** 検索条件マスタの最小データ（ジャンル1件・距離2件） */
const CONDITION_ITEMS = [
  {
    pk: 'GENRE#ALL',
    isActive: true,
    sortOrder: 1,
    genreId: 'nature',
    genreName: '自然',
    iconEmoji: '🌳'
  },
  {
    pk: 'DISTANCE#ALL',
    isActive: true,
    sortOrder: 1,
    distanceKm: 1,
    displayLabel: '1km'
  },
  {
    pk: 'DISTANCE#ALL',
    isActive: true,
    sortOrder: 2,
    distanceKm: 5,
    displayLabel: '5km'
  }
];

/**
 * @description fetch の応答を差し替える
 * @param {object} response 返す応答の内容
 * @returns {void}
 */
const stubFetch = ({ ok = true, status = 200, contentType = 'application/json', body = [] }) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status,
      headers: { get: () => contentType },
      json: async () => body
    }))
  );
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(fetchIdToken).mockClear();
});

describe('fetchConditionOptions', () => {
  test('IDトークンをヘッダーに付けて検索条件APIを呼ぶ', async () => {
    stubFetch({ body: CONDITION_ITEMS });

    await fetchConditionOptions();

    expect(fetch).toHaveBeenCalledWith('/api/v1/conditions', {
      // Cognitoオーソライザーは値をトークンそのものとして検証するため、
      // `Bearer ` を付けない
      headers: { Authorization: 'dummy-id-token' }
    });
  });

  test('マスタから選択肢と距離の範囲を組み立てる', async () => {
    stubFetch({ body: CONDITION_ITEMS });

    const { genreOptions, distanceRange } = await fetchConditionOptions();

    expect(genreOptions).toEqual([
      { value: 'nature', label: '自然', icon: '🌳' }
    ]);
    expect(distanceRange).toMatchObject({ minKm: 1, maxKm: 5 });
  });

  test('セッションが失効している場合は例外をそのまま上位へ伝える', async () => {
    stubFetch({ body: CONDITION_ITEMS });

    const sessionError = new Error('有効なセッションがありません');
    sessionError.name = 'NoValidSession';
    vi.mocked(fetchIdToken).mockRejectedValueOnce(sessionError);

    await expect(fetchConditionOptions()).rejects.toMatchObject({
      name: 'NoValidSession'
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});
