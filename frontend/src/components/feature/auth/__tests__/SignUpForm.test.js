import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import SignUpForm from '@/components/feature/auth/SignUpForm.vue';

/** 入力して送信するまでの操作をまとめる */
const submitWith = async (
  wrapper,
  { username, email, password, passwordConfirmation }
) => {
  await wrapper.find('#sign-up-username').setValue(username);
  await wrapper.find('#sign-up-email').setValue(email);
  await wrapper.find('#sign-up-password').setValue(password);
  await wrapper
    .find('#sign-up-password-confirmation')
    .setValue(passwordConfirmation);
  await wrapper.find('form').trigger('submit');
};

/** 問題の無い入力値 */
const validInputs = {
  username: 'michishiru',
  email: 'user@example.com',
  password: 'Abcdef1!',
  passwordConfirmation: 'Abcdef1!'
};

describe('SignUpForm', () => {
  test('入力に問題が無ければ、確認パスワードを除いた値を親へ渡す', async () => {
    const wrapper = mount(SignUpForm);

    await submitWith(wrapper, validInputs);

    expect(wrapper.emitted('submitSignUp')).toEqual([
      [
        {
          username: 'michishiru',
          email: 'user@example.com',
          password: 'Abcdef1!'
        }
      ]
    ]);
  });

  test('ユーザー名とメールアドレスの前後の空白を取り除いて渡す', async () => {
    const wrapper = mount(SignUpForm);

    await submitWith(wrapper, {
      ...validInputs,
      username: '  michishiru  ',
      email: '  user@example.com  '
    });

    const [[payload]] = wrapper.emitted('submitSignUp');

    expect(payload.username).toBe('michishiru');
    expect(payload.email).toBe('user@example.com');
  });

  test('未入力の場合は送信せず、4項目すべてにエラーを出す', async () => {
    const wrapper = mount(SignUpForm);

    await submitWith(wrapper, {
      username: '',
      email: '',
      password: '',
      passwordConfirmation: ''
    });

    expect(wrapper.emitted('submitSignUp')).toBeUndefined();
    expect(wrapper.find('#sign-up-username-error').text()).toBe(
      'ユーザー名を入力してください'
    );
    expect(wrapper.find('#sign-up-email-error').text()).toBe(
      'メールアドレスを入力してください'
    );
    expect(wrapper.find('#sign-up-password-error').text()).toBe(
      'パスワードを入力してください'
    );
    expect(wrapper.find('#sign-up-password-confirmation-error').text()).toBe(
      '確認のためパスワードをもう一度入力してください'
    );
  });

  test('@が無いメールアドレスは送信しない', async () => {
    const wrapper = mount(SignUpForm);

    await submitWith(wrapper, { ...validInputs, email: 'userexample.com' });

    expect(wrapper.emitted('submitSignUp')).toBeUndefined();
    expect(wrapper.find('#sign-up-email-error').text()).toBe(
      'メールアドレスには@を含めてください'
    );
  });

  test('確認パスワードが一致しない場合は送信しない', async () => {
    const wrapper = mount(SignUpForm);

    await submitWith(wrapper, {
      ...validInputs,
      passwordConfirmation: 'Abcdef1?'
    });

    expect(wrapper.emitted('submitSignUp')).toBeUndefined();
    expect(wrapper.find('#sign-up-password-confirmation-error').text()).toBe(
      'パスワードが一致しません'
    );
  });

  test('パスワードを直すと一致のエラーも取り直す', async () => {
    const wrapper = mount(SignUpForm);

    await submitWith(wrapper, {
      ...validInputs,
      passwordConfirmation: 'Abcdef1?'
    });
    await wrapper.find('#sign-up-password').setValue('Abcdef1?');

    expect(wrapper.find('#sign-up-password-confirmation-error').exists()).toBe(
      false
    );
  });

  test('表示ボタンはパスワードと確認パスワードの両方に効く', async () => {
    const wrapper = mount(SignUpForm);

    await wrapper.find('.auth-reveal-btn').trigger('click');

    expect(wrapper.find('#sign-up-password').attributes('type')).toBe('text');
    expect(
      wrapper.find('#sign-up-password-confirmation').attributes('type')
    ).toBe('text');
  });

  test('エラー後はパスワードを修正するまで表示ボタンを出さない', async () => {
    const wrapper = mount(SignUpForm);

    await submitWith(wrapper, {
      username: '',
      email: '',
      password: '',
      passwordConfirmation: ''
    });
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);

    await wrapper.find('#sign-up-username').setValue('michishiru');
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);

    await wrapper.find('#sign-up-password').setValue('Abcdef1!');
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(true);
  });
});
