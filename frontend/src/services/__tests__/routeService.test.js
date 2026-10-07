import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchIdToken } from '@/services/authService';
import { createRoute, fetchRoute } from '@/services/routeService';

// Amplifyの実体を読み込ませないため、トークン取得を差し替える
vi.mock('@/services/authService', () => ({
  fetchIdToken: vi.fn(async () => 'dummy-id-token')
}));

// レスポンスの変換はこのテストの関心事ではないため恒等にしておく
vi.mock('@/utils/routeResponse', () => ({
  toRoute: (payload) => payload
}));

/**
 * @description fetch の応答を差し替える
 * @param {object} response 返す応答の内容
 * @returns {void}
 */
const stubFetch = ({ ok = true, status = 200, contentType = 'application/json', body = {} }) => {
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

/** ルート作成APIに渡す最小の検索条件 */
const CREATE_ROUTE_CONDITIONS = {
  genreId: 'nature',
  distanceKm: 3,
  currentLocation: { lng: 139.767, lat: 35.681 }
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(fetchIdToken).mockClear();
});

describe('createRoute', () => {
  test('IDトークンと Content-Type の両方をヘッダーに付けてPOSTする', async () => {
    stubFetch({ body: {} });

    await createRoute(CREATE_ROUTE_CONDITIONS);

    const [, options] = vi.mocked(fetch).mock.calls[0];

    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'dummy-id-token'
    });
  });

  test('トークンにスキーム接頭辞を付けない', async () => {
    stubFetch({ body: {} });

    await createRoute(CREATE_ROUTE_CONDITIONS);

    const [, options] = vi.mocked(fetch).mock.calls[0];

    // Cognitoオーソライザーは値をトークンそのものとして検証するため、
    // `Bearer ` を付けると認可に失敗する
    expect(options.headers.Authorization).toBe('dummy-id-token');
  });

  test('セッションが失効している場合は例外をそのまま上位へ伝える', async () => {
    stubFetch({ body: {} });

    const sessionError = new Error('有効なセッションがありません');
    sessionError.name = 'NoValidSession';
    vi.mocked(fetchIdToken).mockRejectedValueOnce(sessionError);

    await expect(createRoute(CREATE_ROUTE_CONDITIONS)).rejects.toMatchObject({
      name: 'NoValidSession'
    });

    // トークンが取れない時点で中断するため、APIは呼ばない
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('fetchRoute', () => {
  test('IDトークンをヘッダーに付けてGETする', async () => {
    stubFetch({ body: {} });

    await fetchRoute({ genre: 'nature', distanceKm: 3 });

    const [url, options] = vi.mocked(fetch).mock.calls[0];

    expect(url).toContain('/api/v1/routes?');
    expect(options).toEqual({ headers: { Authorization: 'dummy-id-token' } });
  });
});
