import {
  AdminGetUserCommand,
  CognitoIdentityProviderClient
} from '@aws-sdk/client-cognito-identity-provider';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import { USER_POOL_ID } from './constants.js';

/**
 * @description Cognitoユーザープールへのアクセスを担当する。
 * 取得のみを行い、照合の判断は持たない。
 */

/** ユーザーが存在しないことを表すCognitoの例外名 */
const USER_NOT_FOUND_ERROR_NAME = 'UserNotFoundException';

/** クライアントの生成は1度だけ行い、呼び出しごとに作らない */
let client = null;

/**
 * @description Cognitoのクライアントを取得する
 * @returns {CognitoIdentityProviderClient} 生成済みのクライアント
 */
const getClient = () => {
  if (client === null) {
    client = new CognitoIdentityProviderClient({});
  }

  return client;
};

/**
 * @description ユーザーに登録されているメールアドレスを取得する。
 *
 * 利用者自身がパスワードを忘れている状況で呼ばれるため、
 * 本人のトークンでは取得できず、管理者向けのAPI（AdminGetUser）を使う。
 * @param {string} username ユーザー名
 * @returns {Promise<string|null>} 登録済みのメールアドレス。ユーザーが存在しない場合はnull
 * @throws {ApplicationError} Cognitoへのアクセスに失敗した場合
 */
export const findUserEmail = async (username) => {
  if (USER_POOL_ID === '') {
    throw createDataSourceError(
      'ユーザープールIDが未設定のため照合できません（環境変数 USER_POOL_ID）'
    );
  }

  try {
    const response = await getClient().send(
      new AdminGetUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: username
      })
    );

    const emailAttribute = (response.UserAttributes ?? []).find(
      (attribute) => attribute.Name === 'email'
    );

    return emailAttribute?.Value ?? null;
  } catch (error) {
    // 存在しないユーザー名は「見つからなかった」として扱い、上位で不一致にする
    if (error.name === USER_NOT_FOUND_ERROR_NAME) {
      logWarn('指定されたユーザーが見つかりませんでした', { username });

      return null;
    }

    throw createDataSourceError('ユーザー情報の取得に失敗しました', {
      errorName: error.name
    });
  }
};
