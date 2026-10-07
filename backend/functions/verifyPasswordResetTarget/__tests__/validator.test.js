import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateVerifyRequest } from '../validator.js';

/** 検証を通る最小のリクエスト */
const validBody = {
  username: 'michishiru',
  email: 'user@example.com'
};

describe('validateVerifyRequest', () => {
  it('必要な項目が揃っていれば正規化した値を返す', () => {
    const result = validateVerifyRequest(validBody);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.value, {
      username: 'michishiru',
      email: 'user@example.com'
    });
  });

  it('前後の空白を取り除く', () => {
    const result = validateVerifyRequest({
      username: '  michishiru  ',
      email: '  user@example.com  '
    });

    assert.equal(result.isValid, true);
    assert.equal(result.value.username, 'michishiru');
    assert.equal(result.value.email, 'user@example.com');
  });

  it('usernameが無い場合は拒否する', () => {
    const result = validateVerifyRequest({ email: validBody.email });

    assert.equal(result.isValid, false);
    assert.ok(result.errorMessages.some((message) => message.includes('username')));
  });

  it('emailが無い場合は拒否する', () => {
    const result = validateVerifyRequest({ username: validBody.username });

    assert.equal(result.isValid, false);
    assert.ok(result.errorMessages.some((message) => message.includes('email')));
  });

  it('21文字のusernameを拒否する', () => {
    const result = validateVerifyRequest({
      ...validBody,
      username: 'a'.repeat(21)
    });

    assert.equal(result.isValid, false);
  });

  it('全角のusernameを拒否する', () => {
    const result = validateVerifyRequest({ ...validBody, username: 'やまもと' });

    assert.equal(result.isValid, false);
  });

  it('@が無いemailを拒否する', () => {
    const result = validateVerifyRequest({
      ...validBody,
      email: 'userexample.com'
    });

    assert.equal(result.isValid, false);
  });

  it('255文字のemailを拒否する', () => {
    const result = validateVerifyRequest({
      ...validBody,
      email: `${'a'.repeat(248)}@aa.com`
    });

    assert.equal(result.isValid, false);
  });

  it('ボディがnullでも例外にならない', () => {
    const result = validateVerifyRequest(null);

    assert.equal(result.isValid, false);
    assert.equal(result.errorMessages.length, 2);
  });

  it('文字列以外の値を拒否する', () => {
    const result = validateVerifyRequest({ username: 123, email: {} });

    assert.equal(result.isValid, false);
  });
});
