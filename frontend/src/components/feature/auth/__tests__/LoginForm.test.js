import { mount } from '@vue/test-utils';
import { describe, expect, test } from 'vitest';
import LoginForm from '@/components/feature/auth/LoginForm.vue';

/** 入力して送信するまでの操作をまとめる */
const submitWith = async (wrapper, { username, password }) => {
  await wrapper.find('#login-username').setValue(username);
  await wrapper.find('#login-password').setValue(password);
  await wrapper.find('form').trigger('submit');
};

describe('LoginForm', () => {
  test('入力に問題が無ければ入力値を親へ渡す', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: 'michishiru', password: 'Abcdef1!' });

    expect(wrapper.emitted('submitLogin')).toEqual([
      [{ username: 'michishiru', password: 'Abcdef1!' }]
    ]);
  });

  test('ユーザー名の前後の空白を取り除いて渡す', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, {
      username: '  michishiru  ',
      password: 'Abcdef1!'
    });

    expect(wrapper.emitted('submitLogin')[0][0].username).toBe('michishiru');
  });

  test('未入力の場合は送信せず、項目ごとのエラーを出す', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: '', password: '' });

    expect(wrapper.emitted('submitLogin')).toBeUndefined();
    expect(wrapper.find('#login-username-error').text()).toBe(
      'ユーザー名を入力してください'
    );
    expect(wrapper.find('#login-password-error').text()).toBe(
      'パスワードを入力してください'
    );
  });

  test('21文字のユーザー名は送信しない', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, {
      username: 'a'.repeat(21),
      password: 'Abcdef1!'
    });

    expect(wrapper.emitted('submitLogin')).toBeUndefined();
    expect(wrapper.find('#login-username-error').text()).toBe(
      'ユーザー名は20文字以内で入力してください'
    );
  });

  test('全角のパスワードは送信しない', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, {
      username: 'michishiru',
      password: 'パスワード12345'
    });

    expect(wrapper.emitted('submitLogin')).toBeUndefined();
    expect(wrapper.find('#login-password-error').text()).toBe(
      'パスワードは半角の英数字と記号で入力してください'
    );
  });

  test('エラーになった項目を直すとその項目のエラーだけ消える', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: '', password: '' });
    await wrapper.find('#login-username').setValue('michishiru');

    expect(wrapper.find('#login-username-error').exists()).toBe(false);
    expect(wrapper.find('#login-password-error').exists()).toBe(true);
  });

  test('入力チェックに引っかかった欄には aria-invalid を付ける', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: '', password: 'Abcdef1!' });

    expect(wrapper.find('#login-username').attributes('aria-invalid')).toBe(
      'true'
    );
    expect(wrapper.find('#login-password').attributes('aria-invalid')).toBe(
      'false'
    );
  });
});

describe('LoginForm のパスワード表示ボタン', () => {
  test('初期状態では表示ボタンがあり、押すと平文になる', async () => {
    const wrapper = mount(LoginForm);
    const revealButton = wrapper.find('.auth-reveal-btn');

    expect(revealButton.exists()).toBe(true);
    expect(wrapper.find('#login-password').attributes('type')).toBe('password');

    await revealButton.trigger('click');

    expect(wrapper.find('#login-password').attributes('type')).toBe('text');
    expect(wrapper.find('.auth-reveal-btn').attributes('aria-pressed')).toBe(
      'true'
    );
  });

  test('入力チェックでエラーが出たら表示ボタンを隠す', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: '', password: '' });

    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);
  });

  test('平文表示中にエラーが出たら隠した状態へ戻す', async () => {
    const wrapper = mount(LoginForm);

    await wrapper.find('.auth-reveal-btn').trigger('click');
    expect(wrapper.find('#login-password').attributes('type')).toBe('text');

    await submitWith(wrapper, { username: '', password: '' });

    expect(wrapper.find('#login-password').attributes('type')).toBe('password');
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);
  });

  test('エラー後はパスワードを修正するまで表示ボタンを出さない', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: '', password: '' });

    // ユーザー名を直しただけでは、まだ表示ボタンは出ない
    await wrapper.find('#login-username').setValue('michishiru');
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);

    // パスワードを直すと、表示ボタンが使えるようになる
    await wrapper.find('#login-password').setValue('Abcdef1!');
    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(true);
  });

  test('サインインが失敗したときも表示ボタンを隠す', async () => {
    const wrapper = mount(LoginForm, {
      props: { errorMessage: null }
    });

    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(true);

    await wrapper.setProps({
      errorMessage: 'ユーザー名またはパスワードが違います'
    });

    expect(wrapper.find('.auth-reveal-btn').exists()).toBe(false);
  });
});
