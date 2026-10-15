import { afterEach, describe, expect, test, vi } from 'vitest';
import { verifyPasswordResetTarget } from '@/services/passwordResetService';

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('verifyPasswordResetTarget', () => {
  test('照合用のAPIへユーザー名とメールアドレスを送る', async () => {
    stubFetch({ body: { isMatched: true } });

    await verifyPasswordResetTarget('michishiru', 'user@example.com');

    expect(fetch).toHaveBeenCalledWith('/api/v1/password-reset-verifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'michishiru',
        email: 'user@example.com'
      })
    });
  });

  test('一致した場合は例外を投げない', async () => {
    stubFetch({ body: { isMatched: true } });

    await expect(
      verifyPasswordResetTarget('michishiru', 'user@example.com')
    ).resolves.toBeUndefined();
  });

  test('一致しない場合は EmailMismatch を投げる', async () => {
    stubFetch({ body: { isMatched: false } });

    await expect(
      verifyPasswordResetTarget('michishiru', 'other@example.com')
    ).rejects.toMatchObject({ name: 'EmailMismatch' });
  });

  test('APIがエラーを返した場合は VerificationUnavailable を投げる', async () => {
    stubFetch({ ok: false, status: 503 });

    await expect(
      verifyPasswordResetTarget('michishiru', 'user@example.com')
    ).rejects.toMatchObject({ name: 'VerificationUnavailable' });
  });

  test('通信自体が失敗した場合も VerificationUnavailable を投げる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );

    await expect(
      verifyPasswordResetTarget('michishiru', 'user@example.com')
    ).rejects.toMatchObject({ name: 'VerificationUnavailable' });
  });

  test('JSON以外が返った場合も VerificationUnavailable を投げる', async () => {
    stubFetch({ contentType: 'text/html' });

    await expect(
      verifyPasswordResetTarget('michishiru', 'user@example.com')
    ).rejects.toMatchObject({ name: 'VerificationUnavailable' });
  });
});
