import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logError, logWarn } from '../../shared/utils/logger.js';
import {
  DEFAULT_QUERY_LIMIT,
  GSI_SPOT_LIST,
  REVIEW_TABLE_NAME,
  SPOT_SORT_KEY
} from './constants.js';

/**
 * @description 口コミが付いた場所の一覧取得を担当する。
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

  /*
   * ApplicationError の context は上位でログに出ないため、ここで原因を残す。
   * GSI を増やした直後は索引の作り直し（backfill）が終わるまで読めず、
   * ValidationException が返る。ピンが出ない原因がこれかどうかを
   * 切り分けられるよう、例外名とメッセージを記録する。
   */
  logError('口コミの場所の一覧のQueryに失敗しました', {
    indexName: GSI_SPOT_LIST,
    tableName: REVIEW_TABLE_NAME,
    errorName: lastError?.name,
    errorMessage: lastError?.message
  });

  throw createDataSourceError('口コミの場所の一覧の取得に失敗しました', {
    errorName: lastError?.name
  });
};

/**
 * @description 口コミが付いた場所を新しい順に取得する。
 *
 * 場所メタ行は `sk = 'SPOT'` で揃っているため、GSI-SpotList（PK=sk）を使うと
 * Scan を使わずに Query 1回で一覧が引ける。
 * 件数の上限は DEFAULT_QUERY_LIMIT に任せ、ページングは行わない
 * （地図のピン表示という用途では、新しい順の一定件数で足りる）。
 * @returns {Promise<Array<{spotId: string, position: {lng: number, lat: number}, spotName: string, createdByUserId: string|null}>>} 場所の一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const listSpots = async () => {
  const response = await sendWithRetry(
    new QueryCommand({
      TableName: REVIEW_TABLE_NAME,
      IndexName: GSI_SPOT_LIST,
      KeyConditionExpression: '#sk = :sk',
      ExpressionAttributeNames: { '#sk': 'sk' },
      ExpressionAttributeValues: { ':sk': SPOT_SORT_KEY },
      // 新しい順に返す
      ScanIndexForward: false,
      Limit: DEFAULT_QUERY_LIMIT
    })
  );

  return (response.Items ?? []).map((item) => ({
    spotId: item.spotId,
    position: { lng: Number(item.position?.lng), lat: Number(item.position?.lat) },
    spotName: item.spotName,
    createdByUserId: item.createdByUserId ?? null
  }));
};
