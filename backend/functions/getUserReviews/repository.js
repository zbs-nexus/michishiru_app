import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import {
  DEFAULT_QUERY_LIMIT,
  GSI_USER_REVIEW,
  REVIEW_TABLE_NAME,
  SPOT_SORT_KEY
} from './constants.js';

/**
 * @description ユーザーの口コミとその場所の取得を担当する。
 * DynamoDBへのアクセスとアプリ形式への変換のみを行い、業務判断は持たない。
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

  throw createDataSourceError('口コミ一覧の取得に失敗しました', {
    errorName: lastError?.name
  });
};

/**
 * @description 指定ユーザーの口コミ行を新しい順に取得する
 * @param {string} userId ユーザーID
 * @returns {Promise<Array<{spotId: string, rating: number, createdAt: string}>>} 口コミの一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const listReviewsByUser = async (userId) => {
  const response = await sendWithRetry(
    new QueryCommand({
      TableName: REVIEW_TABLE_NAME,
      IndexName: GSI_USER_REVIEW,
      KeyConditionExpression: '#userId = :userId',
      ExpressionAttributeNames: { '#userId': 'userId' },
      ExpressionAttributeValues: { ':userId': userId },
      // 新しい順に返す
      ScanIndexForward: false,
      Limit: DEFAULT_QUERY_LIMIT
    })
  );

  return (response.Items ?? []).map((item) => ({
    spotId: item.spotId,
    rating: Number(item.rating),
    createdAt: item.createdAt
  }));
};

/**
 * @description 複数の場所メタをまとめて取得し、spotIdをキーにしたMapで返す
 * @param {string[]} spotIds 場所IDの一覧
 * @returns {Promise<Map<string, {position: {lng: number, lat: number}, spotName: string}>>} 場所の情報
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getSpotsByIds = async (spotIds) => {
  const result = new Map();

  if (spotIds.length === 0) {
    return result;
  }

  const response = await sendWithRetry(
    new BatchGetCommand({
      RequestItems: {
        [REVIEW_TABLE_NAME]: {
          Keys: spotIds.map((spotId) => ({ spotId, sk: SPOT_SORT_KEY }))
        }
      }
    })
  );

  const items = response.Responses?.[REVIEW_TABLE_NAME] ?? [];

  for (const item of items) {
    result.set(item.spotId, {
      position: { lng: Number(item.position?.lng), lat: Number(item.position?.lat) },
      spotName: item.spotName
    });
  }

  return result;
};
