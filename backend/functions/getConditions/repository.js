import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import { CONDITION_TABLE_NAME } from './constants.js';
import { SEED_CONDITIONS } from './seedConditions.js';

/**
 * @description 検索条件マスタの取得を担当する。
 * DynamoDBへのアクセスのみを行い、業務判断は持たない。
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

  throw createDataSourceError('検索条件マスタの取得に失敗しました', {
    errorName: lastError?.name
  });
};

/**
 * @description テーブルが設定されているかどうかを返す
 * @returns {boolean} 設定済みの場合はtrue
 */
export const hasConditionTable = () => CONDITION_TABLE_NAME !== '';

/**
 * @description 検索条件マスタの全項目を取得する。
 * マスタは件数が少なく全件を必要とするため、Scanで取得する。
 * テーブル未設定（ローカル開発）の場合はseedデータを返す。
 * @returns {Promise<object[]>} マスタ項目の一覧（目的・ジャンル・距離を含む）
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const listConditions = async () => {
  if (!hasConditionTable()) {
    return SEED_CONDITIONS;
  }

  const response = await sendWithRetry(
    new ScanCommand({
      TableName: CONDITION_TABLE_NAME
    })
  );

  return response.Items ?? [];
};
