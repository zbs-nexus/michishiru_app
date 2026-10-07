import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import PasswordResetRequestForm from '@/components/feature/auth/PasswordResetRequestForm.vue';

/** 入力して送信するまでの操作をまとめる */
const submitWith = async (wrapper, { username, email }) => {
  await wrapper.find('#password-reset-username').setValue(username);
  await wrapper.find('#password-reset-email').setValue(email);
  await wrapper.find('form').trigger('submit');
};

describe('PasswordResetRequestForm', () => {
  test('ユーザー名とメールアドレスの両方を親へ渡す', async () => {
    const wrapper = mount(PasswordResetRequestForm);

    await submitWith(wrapper, {
      username: 'michishiru',
      email: 'user@example.com'
    });

    expect(wrapper.emitted('submitPasswordResetRequest')).toEqual([
      [{ username: 'michishiru', email: 'user@example.com' }]
    ]);
  });

  test('未入力の場合は送信せず、両方にエラーを出す', async () => {
    const wrapper = mount(PasswordResetRequestForm);

    await submitWith(wrapper, { username: '', email: '' });

    expect(wrapper.emitted('submitPasswordResetRequest')).toBeUndefined();
    expect(wrapper.find('#password-reset-username-error').text()).toBe(
      'ユーザー名を入力してください'
    );
    expect(wrapper.find('#password-reset-email-error').text()).toBe(
      'メールアドレスを入力してください'
    );
  });

  test('@が無いメールアドレスは送信しない', async () => {
    const wrapper = mount(PasswordResetRequestForm);

    await submitWith(wrapper, {
      username: 'michishiru',
      email: 'userexample.com'
    });

    expect(wrapper.emitted('submitPasswordResetRequest')).toBeUndefined();
    expect(wrapper.find('#password-reset-email-error').text()).toBe(
      'メールアドレスには@を含めてください'
    );
  });

  test('前後の空白を取り除いて渡す', async () => {
    const wrapper = mount(PasswordResetRequestForm);

    await submitWith(wrapper, {
      username: ' michishiru ',
      email: ' user@example.com '
    });

    const [[payload]] = wrapper.emitted('submitPasswordResetRequest');

    expect(payload).toEqual({
      username: 'michishiru',
      email: 'user@example.com'
    });
  });

  test('組み合わせが一致しなかったときのエラーを表示する', () => {
    const wrapper = mount(PasswordResetRequestForm, {
      props: {
        errorMessage: 'ユーザー名とメールアドレスの組み合わせが一致しません'
      }
    });

    expect(wrapper.find('[role="alert"]').text()).toBe(
      'ユーザー名とメールアドレスの組み合わせが一致しません'
    );
  });
});
