import { isJsonResponse } from '@/utils/apiResponse';

/**
 * @description パスワード再設定の事前確認のAPI通信を担当する。
 *
 * ユーザー名とメールアドレスの組み合わせは、ブラウザからは確かめられない
 * （Cognito は本人のトークンなしでは登録情報を返さない）。
 * そのため照合だけをサーバー側（`backend/functions/verifyPasswordResetTarget`）へ任せ、
 * 一致した場合だけ確認コードの送信へ進む。
 *
 * 失敗時は例外を投げ、例外名から表示用の文言へ変換するのは authService が行う。
 */

/** APIのベースパス */
const API_BASE_PATH = '/api/v1';

/**
 * @description 例外名を指定したエラーを作る
 * @param {string} name 例外名。表示用の文言へ変換するキーになる
 * @param {string} message 開発者向けの説明
 * @returns {Error} 生成したエラー
 */
const createNamedError = (name, message) => {
  const error = new Error(message);
  error.name = name;

  return error;
};

/**
 * @description ユーザー名とメールアドレスの組み合わせが登録内容と一致するか確かめる。
 * 一致しない場合は例外を投げるため、呼び出し側は成功＝一致として扱える。
 * @param {string} username 入力されたユーザー名
 * @param {string} email 入力されたメールアドレス
 * @returns {Promise<void>} 一致した場合は何も返さない
 * @throws {Error} 一致しない場合（EmailMismatch）、または確認できなかった場合（VerificationUnavailable）
 */
export const verifyPasswordResetTarget = async (username, email) => {
  let response;

  try {
    response = await fetch(`${API_BASE_PATH}/password-reset-verifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email })
    });
  } catch (error) {
    // オフラインや通信の遮断では応答が返らず、fetch が TypeError を投げる。
    // 応答のエラーと同じく「確認できなかった」として扱う
    throw createNamedError(
      'VerificationUnavailable',
      `組み合わせの確認に失敗しました（通信エラー: ${error.message}）`
    );
  }

  // APIが未配線の環境ではSPAのindex.html（HTML）が200で返るため、解析前に判定する
  if (!response.ok || !isJsonResponse(response)) {
    throw createNamedError(
      'VerificationUnavailable',
      `組み合わせの確認に失敗しました（${response.status}）`
    );
  }

  const { isMatched } = await response.json();

  if (!isMatched) {
    throw createNamedError(
      'EmailMismatch',
      'ユーザー名とメールアドレスの組み合わせが一致しません'
    );
  }
};
