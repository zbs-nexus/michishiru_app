import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import { WALK_RESULT_TABLE_NAME } from './constants.js';

/**
 * @description 散歩の実績の書き込みを担当する。
 * DynamoDBへのアクセスとキーの組み立てのみを行い、業務判断は持たない。
 *
 * 1つのテーブルに2種類のアイテムを入れる単一テーブル設計。
 * ・各散歩の実績: pk = `USER#<sub>` / sk = `WALK#<endedAt>#<walkId>`
 * ・ユーザーの累計: pk = `USER#<sub>` / sk = `TOTAL`
 *
 * この関数には書き込み権限しか与えられていないため、読み取り（Query / GetItem）は行わない。
 */

/** リトライ対象とするDynamoDBの例外名 */
const RETRYABLE_ERROR_NAMES = [
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded'
];

/** リトライの最大回数 */
const MAX_RETRY_COUNT = 3;

/** パーティションキーの接頭辞 */
const USER_KEY_PREFIX = 'USER#';

/** 各散歩の実績のソートキー接頭辞 */
const WALK_KEY_PREFIX = 'WALK#';

/** ユーザーの累計のソートキー */
const TOTAL_SORT_KEY = 'TOTAL';

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
 * @description 利用者のパーティションキーを組み立てる
 * @param {string} userId 利用者の識別子（Cognitoのsub）
 * @returns {string} パーティションキー
 */
const toUserPartitionKey = (userId) => `${USER_KEY_PREFIX}${userId}`;

/**
 * @description 各散歩の実績のソートキーを組み立てる
 * @param {object} walkResult 実績
 * @param {string} walkResult.endedAt 散歩の終了時刻（ISO 8601）
 * @param {string} walkResult.walkId 散歩のID
 * @returns {string} ソートキー
 */
const toWalkSortKey = ({ endedAt, walkId }) =>
  `${WALK_KEY_PREFIX}${endedAt}#${walkId}`;

/**
 * @description テーブル名が設定されていることを確かめる
 * @returns {void}
 * @throws {ApplicationError} 未設定の場合
 */
const assertTableConfigured = () => {
  if (WALK_RESULT_TABLE_NAME === '') {
    // getRouteのようなシード値へのフォールバックは行わない。
    // 書き込みに代替手段はなく、保存できていないのに成功を返すと
    // フロントの退避キューも働かず実績が失われる。
    throw createDataSourceError(
      '実績テーブルが未設定のため保存できません（環境変数 WALK_RESULT_TABLE_NAME）'
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
 * @description スロットリング時にリトライしながらコマンドを実行する。
 * 条件エラー（TransactionCanceledException / ConditionalCheckFailedException）は
 * リトライ対象に含めない。何度投げ直しても結果が変わらないため。
 * @param {object} command 実行するコマンド
 * @returns {Promise<object>} DynamoDBの応答
 * @throws {Error} 実行に失敗した場合（呼び出し側で種別を判定する）
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

  throw lastError;
};

/**
 * @description 保存するアイテムの属性を組み立てる
 * @param {object} walkResult 保存する実績
 * @returns {object} DynamoDBへ書き込む項目
 */
const toWalkResultItem = (walkResult) => ({
  pk: toUserPartitionKey(walkResult.userId),
  sk: toWalkSortKey(walkResult),
  walkId: walkResult.walkId,
  userId: walkResult.userId,
  totalDistanceM: walkResult.totalDistanceM,
  spotCount: walkResult.spotCount,
  elapsedMinutes: walkResult.elapsedMinutes,
  startedAt: walkResult.startedAt,
  endedAt: walkResult.endedAt,
  measurementStatus: walkResult.measurementStatus,
  routeTitle: walkResult.routeTitle,
  genreId: walkResult.genreId,
  createdAt: walkResult.createdAt
});

/**
 * @description 各散歩の実績を保存し、同時にユーザーの累計へ加算する。
 * Putは `attribute_not_exists(pk)` を条件に持つため、同じwalkIdの再送では
 * トランザクション全体が止まり、累計も二重に増えない（冪等）。
 * @param {object} walkResult 保存する実績（userId / createdAt を含む）
 * @returns {Promise<{isStored: boolean}>} 書き込めたかどうか。
 *   isStored が false の場合は「同じwalkIdのアイテムが既にある」という事実のみを表す。
 *   それを成功として扱うかはService層が決める。
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const createWalkResultWithTotals = async (walkResult) => {
  assertTableConfigured();

  const now = walkResult.createdAt;

  try {
    await sendWithRetry(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: WALK_RESULT_TABLE_NAME,
              Item: toWalkResultItem(walkResult),
              ConditionExpression: 'attribute_not_exists(pk)'
            }
          },
          {
            Update: {
              TableName: WALK_RESULT_TABLE_NAME,
              Key: {
                pk: toUserPartitionKey(walkResult.userId),
                sk: TOTAL_SORT_KEY
              },
              // ADDはサーバー側で加算するため、累計アイテムを事前に作る必要がない
              UpdateExpression:
                'ADD walkCount :one, cumulativeDistanceM :distanceM, cumulativeSpotCount :spotCount, cumulativeMinutes :minutes SET updatedAt = :now',
              ExpressionAttributeValues: {
                ':one': 1,
                ':distanceM': walkResult.totalDistanceM,
                ':spotCount': walkResult.spotCount,
                ':minutes': walkResult.elapsedMinutes,
                ':now': now
              }
            }
          }
        ]
      })
    );

    return { isStored: true };
  } catch (error) {
    if (
      error?.name === 'TransactionCanceledException' &&
      error.CancellationReasons?.some(
        (reason) => reason.Code === 'ConditionalCheckFailed'
      )
    ) {
      return { isStored: false };
    }

    throw createDataSourceError('散歩の実績の保存に失敗しました', {
      errorName: error?.name
    });
  }
};

/**
 * @description 各散歩の実績のみを保存する（ユーザーの累計へは加算しない）
 * @param {object} walkResult 保存する実績（userId / createdAt を含む）
 * @returns {Promise<{isStored: boolean}>} 書き込めたかどうか。
 *   isStored が false の場合は「同じwalkIdのアイテムが既にある」という事実のみを表す。
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const createWalkResultWithoutTotals = async (walkResult) => {
  assertTableConfigured();

  try {
    await sendWithRetry(
      new PutCommand({
        TableName: WALK_RESULT_TABLE_NAME,
        Item: toWalkResultItem(walkResult),
        ConditionExpression: 'attribute_not_exists(pk)'
      })
    );

    return { isStored: true };
  } catch (error) {
    if (error?.name === 'ConditionalCheckFailedException') {
      return { isStored: false };
    }

    throw createDataSourceError('散歩の実績の保存に失敗しました', {
      errorName: error?.name
    });
  }
};
