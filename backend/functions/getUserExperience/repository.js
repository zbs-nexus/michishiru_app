import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import {
  GSI_USER_REVIEW,
  MAX_REVIEW_COUNT_PAGE_COUNT,
  REVIEW_TABLE_NAME,
  TOTAL_SORT_KEY,
  USER_KEY_PREFIX,
  WALK_RESULT_TABLE_NAME
} from './constants.js';

/**
 * @description マスコットの経験値のもとになる実績の取得を担当する。
 * DynamoDBへのアクセスとアプリ形式への変換のみを行い、業務判断は持たない。
 *
 * 参照先は2テーブルだが、どちらもDynamoDBでSDKもエラーの扱いも同じため
 * repositories/ へは分けない（分割は別SDK・別エラー扱いの場合の規定）。
 *
 * 経験値そのものは計算しない。係数とレベル表はフロントが持つ。
 */

/** リトライ対象とするDynamoDBの例外名 */
const RETRYABLE_ERROR_NAMES = [
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded'
];

/** リトライの最大回数 */
const MAX_RETRY_COUNT = 3;

/** DocumentClientの生成は1度だけ行い、呼び出しごとに作らない */
let documentClient = null;

/**
 * @description DynamoDBのDocumentClientを取得する
 * @returns {DynamoDBDocumentClient} 生成済みのクライアント
 */
const getDocumentClient = () => {
  if (documentClient === null) {
    documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  }

  return documentClient;
};

/**
 * @description テーブル名が設定されていることを確かめる
 * @param {string} tableName 確認するテーブル名
 * @param {string} environmentName 未設定のときに案内する環境変数名
 * @returns {void}
 * @throws {ApplicationError} 未設定の場合
 */
const assertTableConfigured = (tableName, environmentName) => {
  if (tableName === '') {
    // getRouteのようなシード値へは落とさない。実績が0なのか読めなかったのかを
    // 取り違えると、経験値が0のままレベルが下がったように見えてしまう
    throw createDataSourceError(
      `実績の参照先が未設定のため取得できません（環境変数 ${environmentName}）`
    );
  }
};

/**
 * @description 指定時間だけ待機する
 * @param {number} durationMs 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
const wait = (durationMs) =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

/**
 * @description スロットリング時にリトライしながらコマンドを実行する
 * @param {object} command 実行するコマンド
 * @returns {Promise<object>} DynamoDBの応答
 * @throws {ApplicationError} リトライしても失敗した場合
 */
const sendWithRetry = async (command) => {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt += 1) {
    try {
      return await getDocumentClient().send(command);
    } catch (error) {
      lastError = error;

      if (!RETRYABLE_ERROR_NAMES.includes(error.name)) {
        break;
      }

      logWarn('DynamoDBのスロットリングを検知したため再試行します', {
        attempt,
        errorName: error.name
      });

      await wait(2 ** attempt * 100);
    }
  }

  throw createDataSourceError('実績の取得に失敗しました', {
    errorName: lastError?.name
  });
};

/**
 * @description 利用者の累計の実績（距離・時間）を取得する。
 * 累計アイテムは createWalkResult が ADD で加算して作るため、
 * まだ1回も散歩を保存していない利用者には存在しない。
 * @param {string} userId 利用者の識別子（Cognitoのsub）
 * @returns {Promise<{cumulativeDistanceM: number, cumulativeMinutes: number}|null>}
 *   累計。アイテムが無い場合はnull
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getWalkTotalsByUserId = async (userId) => {
  assertTableConfigured(WALK_RESULT_TABLE_NAME, 'WALK_RESULT_TABLE_NAME');

  const response = await sendWithRetry(
    new GetCommand({
      TableName: WALK_RESULT_TABLE_NAME,
      Key: {
        pk: `${USER_KEY_PREFIX}${userId}`,
        sk: TOTAL_SORT_KEY
      }
    })
  );

  if (!response.Item) {
    return null;
  }

  return {
    cumulativeDistanceM: Number(response.Item.cumulativeDistanceM ?? 0),
    cumulativeMinutes: Number(response.Item.cumulativeMinutes ?? 0)
  };
};

/**
 * @description 利用者が投稿した口コミの件数を数える。
 *
 * `Select: 'COUNT'` を使い、項目の本体は受け取らない。件数しか要らないため、
 * 読み取り容量は同じでも転送量とLambdaのメモリを使わずに済む。
 * 1回の応答は走査1MBで切れるため、LastEvaluatedKey がある限りページを送って合算する。
 * @param {string} userId 利用者の識別子（Cognitoのsub）
 * @returns {Promise<number>} 口コミの件数
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getReviewCountByUserId = async (userId) => {
  assertTableConfigured(REVIEW_TABLE_NAME, 'REVIEW_TABLE_NAME');

  let reviewCount = 0;
  let exclusiveStartKey = undefined;

  for (let page = 1; page <= MAX_REVIEW_COUNT_PAGE_COUNT; page += 1) {
    const response = await sendWithRetry(
      new QueryCommand({
        TableName: REVIEW_TABLE_NAME,
        IndexName: GSI_USER_REVIEW,
        KeyConditionExpression: '#userId = :userId',
        ExpressionAttributeNames: { '#userId': 'userId' },
        ExpressionAttributeValues: { ':userId': userId },
        Select: 'COUNT',
        ExclusiveStartKey: exclusiveStartKey
      })
    );

    reviewCount += Number(response.Count ?? 0);
    exclusiveStartKey = response.LastEvaluatedKey;

    if (!exclusiveStartKey) {
      break;
    }
  }

  return reviewCount;
};
