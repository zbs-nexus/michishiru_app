import { logInfo } from '../../shared/utils/logger.js';
import { findUserEmail } from './repository.js';

/**
 * @description パスワード再設定の対象を照合するビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを受け取って返す。
 *
 * 確認コードを送る前にこの照合を行い、一致した場合だけ送信へ進む。
 * 一致しない理由（ユーザーが居ない／メールアドレスが違う）は返さない。
 * 外部から当て推量でユーザーの情報を探られないようにするため。
 */

/** 既定で使うリポジトリ。テスト時は差し替える */
const defaultRepositories = { findUserEmail };

/**
 * @description メールアドレスを比較用に整える。
 * 大文字小文字の違いと前後の空白は、同じアドレスとして扱う。
 * @param {string} email メールアドレス
 * @returns {string} 比較用の文字列
 */
const normalizeEmail = (email) => email.trim().toLowerCase();

/**
 * @description ユーザー名とメールアドレスの組み合わせが登録内容と一致するかを調べる
 * @param {object} target 照合する対象
 * @param {string} target.username ユーザー名
 * @param {string} target.email メールアドレス
 * @param {object} [repositories] データ取得に使うリポジトリ（テスト時に差し替える）
 * @returns {Promise<{isMatched: boolean}>} 一致したかどうか
 * @throws {ApplicationError} Cognitoへのアクセスに失敗した場合
 */
export const verifyPasswordResetTarget = async (
  { username, email },
  repositories = defaultRepositories
) => {
  const registeredEmail = await repositories.findUserEmail(username);

  if (registeredEmail === null) {
    logInfo('照合の結果、対象のユーザーが見つかりませんでした', { username });

    return { isMatched: false };
  }

  const isMatched = normalizeEmail(registeredEmail) === normalizeEmail(email);

  logInfo('ユーザー名とメールアドレスの組み合わせを照合しました', {
    username,
    isMatched
  });

  return { isMatched };
};
