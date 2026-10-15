import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchIdToken } from '@/services/authService';
import { saveWalkResult } from '@/services/walkResultService';

/**
 * @description 実績の保存APIとの通信を確かめるテスト。
 * 退避するかどうかは composable が例外の name で判断するため、
 * ここでは「どの失敗にどの name が付くか」を固定する。
 */

// Amplifyの実体を読み込ませないため、トークン取得を差し替える
vi.mock('@/services/authService', () => ({
  fetchIdToken: vi.fn(async () => 'dummy-id-token')
}));

/** 保存APIへ送る最小の実績 */
const WALK_RESULT = {
  walkId: '018f8a6f-0f4a-4a1e-9d6f-2f1c3b4d5e6f',
  totalDistanceM: 1200,
  spotCount: 3,
  elapsedMinutes: 25,
  startedAt: '2026-10-07T01:00:00.000Z',
  endedAt: '2026-10-07T01:25:00.000Z',
  measurementStatus: 'complete',
  routeTitle: '公園めぐりコース',
  genreId: 'nature'
};

/**
 * @description fetch の応答を差し替える
 * @param {object} response 返す応答の内容
 * @returns {void}
 */
const stubFetch = ({
  ok = true,
  status = 200,
  contentType = 'application/json',
  body = {}
}) => {
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

describe('saveWalkResult', () => {
  test('実績をPOSTし、IDトークンと Content-Type をヘッダーに付ける', async () => {
    stubFetch({ body: { walkId: WALK_RESULT.walkId, isAlreadySaved: false } });

    await saveWalkResult(WALK_RESULT);

    const [url, options] = vi.mocked(fetch).mock.calls[0];

    expect(url).toBe('/api/v1/walk-results');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      // Cognitoオーソライザーは値をトークンそのものとして検証するため、
      // `Bearer ` を付けると認可に失敗する
      Authorization: 'dummy-id-token'
    });
    expect(JSON.parse(options.body)).toEqual(WALK_RESULT);
  });

  test('既に保存済みだった場合もレスポンスをそのまま返す', async () => {
    stubFetch({ body: { walkId: WALK_RESULT.walkId, isAlreadySaved: true } });

    // 再送で必ず通る経路のため、失敗として扱ってはいけない
    await expect(saveWalkResult(WALK_RESULT)).resolves.toEqual({
      walkId: WALK_RESULT.walkId,
      isAlreadySaved: true
    });
  });

  test('通信できなかった場合は再試行可として投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

    await expect(saveWalkResult(WALK_RESULT)).rejects.toMatchObject({
      name: 'WalkResultSaveRetryable'
    });
  });

  test('5xx は再試行可として投げる', async () => {
    stubFetch({
      ok: false,
      status: 503,
      body: { code: 'DATA_SOURCE_ERROR', message: '保存できませんでした' }
    });

    await expect(saveWalkResult(WALK_RESULT)).rejects.toMatchObject({
      name: 'WalkResultSaveRetryable',
      message: '保存できませんでした'
    });
  });

  test('429 は再試行可として投げる', async () => {
    stubFetch({ ok: false, status: 429, body: {} });

    await expect(saveWalkResult(WALK_RESULT)).rejects.toMatchObject({
      name: 'WalkResultSaveRetryable'
    });
  });

  test('400 は再試行不可として投げる', async () => {
    stubFetch({
      ok: false,
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: '距離が不正です' }
    });

    // 何度送っても同じ結果になるため、退避させてはいけない
    await expect(saveWalkResult(WALK_RESULT)).rejects.toMatchObject({
      name: 'WalkResultSaveRejected',
      message: '距離が不正です'
    });
  });

  test('JSON以外の200は再試行不可として投げる', async () => {
    stubFetch({ contentType: 'text/html', body: {} });

    // APIが未配線の環境ではSPAのindex.htmlが200で返る
    await expect(saveWalkResult(WALK_RESULT)).rejects.toMatchObject({
      name: 'WalkResultSaveRejected'
    });
  });

  test('セッションが失効している場合は例外をそのまま上位へ伝える', async () => {
    stubFetch({ body: {} });

    const sessionError = new Error('有効なセッションがありません');
    sessionError.name = 'NoValidSession';
    vi.mocked(fetchIdToken).mockRejectedValueOnce(sessionError);

    await expect(saveWalkResult(WALK_RESULT)).rejects.toMatchObject({
      name: 'NoValidSession'
    });

    // トークンが取れない時点で中断するため、APIは呼ばない
    expect(fetch).not.toHaveBeenCalled();
  });
});
