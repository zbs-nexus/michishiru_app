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

  test('初期状態ではパスワードを隠して表示する', () => {
    const wrapper = mount(LoginForm);

    expect(wrapper.find('#login-password').attributes('type')).toBe('password');
  });
});

describe('LoginForm のパスワード表示切替', () => {
  test('目のアイコンを押すと平文になり、もう一度押すと隠れる', async () => {
    const wrapper = mount(LoginForm);

    await wrapper.find('.password-visibility-btn').trigger('click');
    expect(wrapper.find('#login-password').attributes('type')).toBe('text');

    await wrapper.find('.password-visibility-btn').trigger('click');
    expect(wrapper.find('#login-password').attributes('type')).toBe('password');
  });

  test('状態に応じて読み上げ用のラベルを切り替える', async () => {
    const wrapper = mount(LoginForm);

    expect(
      wrapper.find('.password-visibility-btn').attributes('aria-label')
    ).toBe('パスワードを表示する');

    await wrapper.find('.password-visibility-btn').trigger('click');

    expect(
      wrapper.find('.password-visibility-btn').attributes('aria-label')
    ).toBe('パスワードを隠す');
    expect(
      wrapper.find('.password-visibility-btn').attributes('aria-pressed')
    ).toBe('true');
  });

  test('入力チェックでエラーが出たらアイコンを隠す', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: '', password: '' });

    expect(wrapper.find('.password-visibility-btn').exists()).toBe(false);
  });

  test('平文表示中にエラーが出たら隠した状態へ戻す', async () => {
    const wrapper = mount(LoginForm);

    await wrapper.find('.password-visibility-btn').trigger('click');
    expect(wrapper.find('#login-password').attributes('type')).toBe('text');

    await submitWith(wrapper, { username: '', password: '' });

    expect(wrapper.find('#login-password').attributes('type')).toBe('password');
    expect(wrapper.find('.password-visibility-btn').exists()).toBe(false);
  });

  test('エラー後はパスワードを修正するまでアイコンを出さない', async () => {
    const wrapper = mount(LoginForm);

    await submitWith(wrapper, { username: '', password: '' });

    // ユーザー名を直しただけでは、まだアイコンは出ない
    await wrapper.find('#login-username').setValue('michishiru');
    expect(wrapper.find('.password-visibility-btn').exists()).toBe(false);

    // パスワードを直すと、アイコンが使えるようになる
    await wrapper.find('#login-password').setValue('Abcdef1!');
    expect(wrapper.find('.password-visibility-btn').exists()).toBe(true);
  });

  test('サインインが失敗したときもアイコンを隠す', async () => {
    const wrapper = mount(LoginForm, { props: { errorMessage: null } });

    expect(wrapper.find('.password-visibility-btn').exists()).toBe(true);

    await wrapper.setProps({
      errorMessage: 'ユーザー名またはパスワードが違います'
    });

    expect(wrapper.find('.password-visibility-btn').exists()).toBe(false);
  });
});

