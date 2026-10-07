import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import PasswordResetConfirmForm from '@/components/feature/auth/PasswordResetConfirmForm.vue';

/** 入力して送信するまでの操作をまとめる */
const submitWith = async (
  wrapper,
  { confirmationCode, newPassword, passwordConfirmation }
) => {
  await wrapper.find('#password-reset-code').setValue(confirmationCode);
  await wrapper.find('#password-reset-new-password').setValue(newPassword);
  await wrapper
    .find('#password-reset-password-confirmation')
    .setValue(passwordConfirmation);
  await wrapper.find('form').trigger('submit');
};

/** 問題の無い入力値 */
const validInputs = {
  confirmationCode: '123456',
  newPassword: 'Abcdef1!',
  passwordConfirmation: 'Abcdef1!'
};

describe('PasswordResetConfirmForm', () => {
  test('入力に問題が無ければ、確認パスワードを除いた値を親へ渡す', async () => {
    const wrapper = mount(PasswordResetConfirmForm);

    await submitWith(wrapper, validInputs);

    expect(wrapper.emitted('submitPasswordReset')).toEqual([
      [{ confirmationCode: '123456', newPassword: 'Abcdef1!' }]
    ]);
  });

  test('未入力の場合は送信せず、3項目すべてにエラーを出す', async () => {
    const wrapper = mount(PasswordResetConfirmForm);

    await submitWith(wrapper, {
      confirmationCode: '',
      newPassword: '',
      passwordConfirmation: ''
    });

    expect(wrapper.emitted('submitPasswordReset')).toBeUndefined();
    expect(wrapper.find('#password-reset-code-error').text()).toBe(
      '確認コードを入力してください'
    );
    expect(wrapper.find('#password-reset-new-password-error').text()).toBe(
      '新しいパスワードを入力してください'
    );
    expect(
      wrapper.find('#password-reset-password-confirmation-error').text()
    ).toBe('確認のため新しいパスワードをもう一度入力してください');
  });

  test('確認コードが6桁でない場合は送信しない', async () => {
    const wrapper = mount(PasswordResetConfirmForm);

    await submitWith(wrapper, { ...validInputs, confirmationCode: '12345' });

    expect(wrapper.emitted('submitPasswordReset')).toBeUndefined();
    expect(wrapper.find('#password-reset-code-error').text()).toBe(
      '確認コードは半角数字6桁で入力してください'
    );
  });

  test('確認パスワードが一致しない場合は送信しない', async () => {
    const wrapper = mount(PasswordResetConfirmForm);

    await submitWith(wrapper, {
      ...validInputs,
      passwordConfirmation: 'Abcdef1?'
    });

    expect(wrapper.emitted('submitPasswordReset')).toBeUndefined();
    expect(
      wrapper.find('#password-reset-password-confirmation-error').text()
    ).toBe('新しいパスワードが一致しません');
  });

  test('7文字の新しいパスワードは送信しない', async () => {
    const wrapper = mount(PasswordResetConfirmForm);

    await submitWith(wrapper, {
      ...validInputs,
      newPassword: 'Abcdef1',
      passwordConfirmation: 'Abcdef1'
    });

    expect(wrapper.emitted('submitPasswordReset')).toBeUndefined();
    expect(wrapper.find('#password-reset-new-password-error').text()).toBe(
      '新しいパスワードは8文字以上64文字以内で入力してください'
    );
  });

  test('エラー後は新しいパスワードを修正するまで表示ボタンを出さない', async () => {
    const wrapper = mount(PasswordResetConfirmForm);

    await submitWith(wrapper, {
      confirmationCode: '',
      newPassword: '',
      passwordConfirmation: ''
    });
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);

    await wrapper.find('#password-reset-code').setValue('123456');
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);

    await wrapper.find('#password-reset-new-password').setValue('Abcdef1!');
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(true);
  });

  test('確認コードの再送を親へ知らせる', async () => {
    const wrapper = mount(PasswordResetConfirmForm);

    await wrapper.find('.secondary-btn').trigger('click');

    expect(wrapper.emitted('resendCode')).toHaveLength(1);
  });
});
