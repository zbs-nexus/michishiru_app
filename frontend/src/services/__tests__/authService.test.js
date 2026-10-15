import { afterEach, describe, expect, test, vi } from 'vitest';
import { signIn } from 'aws-amplify/auth';
import {
  signInWithPassword,
  toAuthErrorMessage
} from '@/services/authService';

vi.mock('aws-amplify/auth', () => ({
  confirmResetPassword: vi.fn(),
  confirmSignUp: vi.fn(),
  fetchAuthSession: vi.fn(),
  getCurrentUser: vi.fn(),
  resendSignUpCode: vi.fn(),
  resetPassword: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn()
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('signInWithPassword', () => {
  test('サインインが完了すれば例外を投げない', async () => {
    signIn.mockResolvedValue({ isSignedIn: true, nextStep: { signInStep: 'DONE' } });

    await expect(
      signInWithPassword('michishiru', 'Abcdef1!')
    ).resolves.toBeUndefined();
  });

  test('未確認のユーザー（CONFIRM_SIGN_UP）は UserNotConfirmedException として投げる', async () => {
    signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_UP' }
    });

    await expect(
      signInWithPassword('michishiru', 'Abcdef1!')
    ).rejects.toMatchObject({ name: 'UserNotConfirmedException' });
  });

  test('未確認のユーザーには有効化されていない旨の文言を出す', async () => {
    signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_UP' }
    });

    const error = await signInWithPassword('michishiru', 'Abcdef1!').catch(
      (caught) => caught
    );

    expect(toAuthErrorMessage(error)).toBe(
      'このユーザーは有効化されていません。管理者に連絡してください'
    );
  });

  test('ほかの手続きは手続き名のまま投げる', async () => {
    signIn.mockResolvedValue({
      isSignedIn: false,
      nextStep: { signInStep: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED' }
    });

    await expect(
      signInWithPassword('michishiru', 'Abcdef1!')
    ).rejects.toMatchObject({
      name: 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED'
    });
  });
});
