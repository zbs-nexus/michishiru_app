import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { verifyPasswordResetTarget } from '../service.js';

/**
 * @description 登録済みのメールアドレスを返すだけのリポジトリを作る
 * @param {string|null} registeredEmail 登録済みのメールアドレス
 * @returns {object} テスト用のリポジトリ
 */
const createRepositories = (registeredEmail) => ({
  findUserEmail: async () => registeredEmail
});

describe('verifyPasswordResetTarget', () => {
  it('登録内容と一致する場合はisMatchedをtrueにする', async () => {
    const result = await verifyPasswordResetTarget(
      { username: 'michishiru', email: 'user@example.com' },
      createRepositories('user@example.com')
    );

    assert.deepEqual(result, { isMatched: true });
  });

  it('大文字小文字の違いは同じアドレスとして扱う', async () => {
    const result = await verifyPasswordResetTarget(
      { username: 'michishiru', email: 'USER@EXAMPLE.COM' },
      createRepositories('user@example.com')
    );

    assert.equal(result.isMatched, true);
  });

  it('前後に空白が入っていても同じアドレスとして扱う', async () => {
    const result = await verifyPasswordResetTarget(
      { username: 'michishiru', email: ' user@example.com ' },
      createRepositories('user@example.com')
    );

    assert.equal(result.isMatched, true);
  });

  it('別のアドレスの場合はisMatchedをfalseにする', async () => {
    const result = await verifyPasswordResetTarget(
      { username: 'michishiru', email: 'other@example.com' },
      createRepositories('user@example.com')
    );

    assert.equal(result.isMatched, false);
  });

  it('ユーザーが見つからない場合もisMatchedをfalseにする', async () => {
    const result = await verifyPasswordResetTarget(
      { username: 'unknown', email: 'user@example.com' },
      createRepositories(null)
    );

    assert.equal(result.isMatched, false);
  });

  it('照合するユーザー名をリポジトリへ渡す', async () => {
    const passedUsernames = [];
    const result = await verifyPasswordResetTarget(
      { username: 'michishiru', email: 'user@example.com' },
      {
        findUserEmail: async (username) => {
          passedUsernames.push(username);

          return 'user@example.com';
        }
      }
    );

    assert.deepEqual(passedUsernames, ['michishiru']);
    assert.equal(result.isMatched, true);
  });

  it('リポジトリの例外はそのまま上位へ渡す', async () => {
    await assert.rejects(
      verifyPasswordResetTarget(
        { username: 'michishiru', email: 'user@example.com' },
        {
          findUserEmail: async () => {
            throw new Error('Cognitoへのアクセスに失敗');
          }
        }
      ),
      /Cognito/
    );
  });
});
