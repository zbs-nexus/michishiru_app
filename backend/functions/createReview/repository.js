import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand
} from '@aws-sdk/lib-dynamodb';
import {
  createConflictError,
  createDataSourceError
} from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import { toNeighborGeoCells } from '../../shared/utils/geo.js';
import {
  GSI_GEO_CELL,
  REVIEW_TABLE_NAME,
  SPOT_SORT_KEY,
  toReviewSortKey
} from './constants.js';

/**
 * @description 口コミ・場所の書き込みを担当する。
 * DynamoDBへのアクセスとアプリ形式への変換のみを行い、業務判断は持たない。
 * 場所メタの集計更新と口コミの作成・更新は、整合のためトランザクションで行う。
 */

/** リトライ対象とするDynamoDBの例外名 */
const RETRYABLE_ERROR_NAMES = [
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded'
];

/** 競合（条件付き書き込みの失敗）とみなす例外名 */
const CONFLICT_ERROR_NAMES = [
  'ConditionalCheckFailedException',
  'TransactionCanceledException'
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
 * @description スロットリング時にリトライしながら読み取りコマンドを実行する
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

  throw createDataSourceError('口コミの読み取りに失敗しました', {
    errorName: lastError?.name
  });
};

/**
 * @description トランザクション書き込みを実行する。
 * 条件付き書き込みが失敗した場合（競合）は、業務が判断できるよう競合エラーへ変換する。
 * @param {TransactWriteCommand} command 実行するトランザクションコマンド
 * @returns {Promise<void>}
 * @throws {ApplicationError} 競合、またはデータストアへのアクセスに失敗した場合
 */
const sendTransaction = async (command) => {
  try {
    await getDocumentClient().send(command);
  } catch (error) {
    if (CONFLICT_ERROR_NAMES.includes(error.name)) {
      throw createConflictError('同じ場所の投稿が競合しました', {
        errorName: error.name
      });
    }

    throw createDataSourceError('口コミの保存に失敗しました', {
      errorName: error.name
    });
  }
};

/**
 * @description DynamoDBの場所メタ項目をアプリ形式へ変換する。
 * 平均評価は保存せず、合計と件数から都度算出する。
 * @param {object} item DynamoDBから取得した項目
 * @returns {object} アプリ形式の場所
 */
export const toSpot = (item) => {
  const ratingCount = Number(item.ratingCount ?? 0);
  const ratingSum = Number(item.ratingSum ?? 0);

  return {
    spotId: item.spotId,
    spotName: item.spotName,
    genreId: item.genreId,
    genreName: item.genreName ?? null,
    position: { lng: Number(item.position?.lng), lat: Number(item.position?.lat) },
    ratingCount,
    ratingAverage: ratingCount === 0 ? 0 : ratingSum / ratingCount,
    photoKeys: item.photoKeys ?? []
  };
};

/**
 * @description 指定座標の周囲（3×3セル）にある場所を取得する
 * @param {{lng: number, lat: number}} position 中心の座標
 * @returns {Promise<object[]>} 候補の場所の一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const findNearbySpots = async (position) => {
  const cells = toNeighborGeoCells(position);

  const responses = await Promise.all(
    cells.map((geoCell) =>
      sendWithRetry(
        new QueryCommand({
          TableName: REVIEW_TABLE_NAME,
          IndexName: GSI_GEO_CELL,
          KeyConditionExpression: '#geoCell = :geoCell',
          ExpressionAttributeNames: { '#geoCell': 'geoCell' },
          ExpressionAttributeValues: { ':geoCell': geoCell }
        })
      )
    )
  );

  return responses.flatMap((response) => (response.Items ?? []).map(toSpot));
};

/**
 * @description 場所を1件取得する
 * @param {string} spotId 場所のID
 * @returns {Promise<object|null>} 見つかった場所。存在しない場合はnull
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getSpotById = async (spotId) => {
  const response = await sendWithRetry(
    new GetCommand({
      TableName: REVIEW_TABLE_NAME,
      Key: { spotId, sk: SPOT_SORT_KEY }
    })
  );

  return response.Item ? toSpot(response.Item) : null;
};

/**
 * @description 指定ユーザーの、その場所への口コミを取得する
 * @param {string} spotId 場所のID
 * @param {string} userId ユーザーID
 * @returns {Promise<{rating: number}|null>} 口コミ。無い場合はnull
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getUserReview = async (spotId, userId) => {
  const response = await sendWithRetry(
    new GetCommand({
      TableName: REVIEW_TABLE_NAME,
      Key: { spotId, sk: toReviewSortKey(userId) }
    })
  );

  return response.Item ? { rating: Number(response.Item.rating) } : null;
};

/**
 * @description 場所メタと初回の口コミを同時に作成する（初回投稿）。
 * 既に同じ場所が存在する場合は条件に反するため競合エラーになる。
 * @param {object} params パラメータ
 * @param {object} params.spot 作成する場所メタ
 * @param {{userId: string, rating: number}} params.review 初回の口コミ
 * @param {string} params.now 現在時刻（ISO文字列）
 * @returns {Promise<void>}
 * @throws {ApplicationError} 競合、またはデータストアへのアクセスに失敗した場合
 */
export const createSpotWithReview = async ({ spot, review, now }) => {
  await sendTransaction(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: REVIEW_TABLE_NAME,
            Item: {
              spotId: spot.spotId,
              sk: SPOT_SORT_KEY,
              geoCell: spot.geoCell,
              spotName: spot.spotName,
              genreId: spot.genreId,
              genreName: spot.genreName,
              position: spot.position,
              ratingSum: review.rating,
              ratingCount: 1,
              photoKeys: spot.photoKeys ?? [],
              createdByUserId: review.userId,
              createdAt: now,
              updatedAt: now
            },
            ConditionExpression: 'attribute_not_exists(spotId)'
          }
        },
        {
          Put: {
            TableName: REVIEW_TABLE_NAME,
            Item: {
              spotId: spot.spotId,
              sk: toReviewSortKey(review.userId),
              userId: review.userId,
              rating: review.rating,
              createdAt: now,
              updatedAt: now
            }
          }
        }
      ]
    })
  );
};

/**
 * @description 既存の場所へ新しいユーザーの口コミを追加し、集計へ加算する（2回目以降・初投稿のユーザー）。
 * 同じユーザーが既に投稿している場合は条件に反するため競合エラーになる。
 * @param {object} params パラメータ
 * @param {string} params.spotId 場所のID
 * @param {string} params.userId ユーザーID
 * @param {number} params.rating 評価
 * @param {string} params.now 現在時刻（ISO文字列）
 * @returns {Promise<void>}
 * @throws {ApplicationError} 競合、またはデータストアへのアクセスに失敗した場合
 */
export const addReview = async ({ spotId, userId, rating, now }) => {
  await sendTransaction(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: REVIEW_TABLE_NAME,
            Item: {
              spotId,
              sk: toReviewSortKey(userId),
              userId,
              rating,
              createdAt: now,
              updatedAt: now
            },
            ConditionExpression: 'attribute_not_exists(sk)'
          }
        },
        {
          Update: {
            TableName: REVIEW_TABLE_NAME,
            Key: { spotId, sk: SPOT_SORT_KEY },
            UpdateExpression:
              'ADD ratingSum :rating, ratingCount :one SET updatedAt = :now',
            ConditionExpression: 'attribute_exists(spotId)',
            ExpressionAttributeValues: { ':rating': rating, ':one': 1, ':now': now }
          }
        }
      ]
    })
  );
};

/**
 * @description 自分の既存の口コミの評価を更新し、集計へ差分を反映する（編集）。
 * @param {object} params パラメータ
 * @param {string} params.spotId 場所のID
 * @param {string} params.userId ユーザーID
 * @param {number} params.rating 新しい評価
 * @param {number} params.delta 旧評価との差分（新 - 旧）
 * @param {string} params.now 現在時刻（ISO文字列）
 * @returns {Promise<void>}
 * @throws {ApplicationError} 競合、またはデータストアへのアクセスに失敗した場合
 */
export const updateReviewRating = async ({ spotId, userId, rating, delta, now }) => {
  await sendTransaction(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: REVIEW_TABLE_NAME,
            Key: { spotId, sk: toReviewSortKey(userId) },
            UpdateExpression: 'SET rating = :rating, updatedAt = :now',
            ConditionExpression: 'attribute_exists(sk)',
            ExpressionAttributeValues: { ':rating': rating, ':now': now }
          }
        },
        {
          Update: {
            TableName: REVIEW_TABLE_NAME,
            Key: { spotId, sk: SPOT_SORT_KEY },
            UpdateExpression: 'ADD ratingSum :delta SET updatedAt = :now',
            ConditionExpression: 'attribute_exists(spotId)',
            ExpressionAttributeValues: { ':delta': delta, ':now': now }
          }
        }
      ]
    })
  );
};
