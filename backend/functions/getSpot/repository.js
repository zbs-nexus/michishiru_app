import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import { toNeighborGeoCells } from '../../shared/utils/geo.js';
import {
  GSI_GEO_CELL,
  PHOTO_BUCKET_NAME,
  PHOTO_VIEW_URL_EXPIRES_S,
  REVIEW_TABLE_NAME,
  SPOT_SORT_KEY,
  toReviewSortKey
} from './constants.js';

/**
 * @description 口コミの場所データの取得を担当する。
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

  throw createDataSourceError('口コミの場所の取得に失敗しました', {
    errorName: lastError?.name
  });
};

/**
 * @description DynamoDBの場所メタ項目をアプリ形式へ変換する。
 * 平均評価は保存せず、合計と件数から都度算出する（ずれを防ぐため）。
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
    photoKeys: item.photoKeys ?? [],
    createdByUserId: item.createdByUserId ?? null
  };
};

/**
 * @description 指定座標の周囲（3×3セル）にある場所を取得する。
 * 半径判定（40m以内か）はService層が距離で行うため、ここではセル内の候補を返すだけにする。
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

/** S3クライアントの生成は1度だけ行い、呼び出しごとに作らない */
let s3Client = null;

/**
 * @description S3クライアントを取得する
 * @returns {S3Client} 生成済みのクライアント
 */
const getS3Client = () => {
  if (s3Client === null) {
    s3Client = new S3Client({});
  }

  return s3Client;
};

/**
 * @description 写真キーの一覧から、表示用の署名付きGET URLを発行する。
 * バケットは非公開のため、ブラウザはこのURLで画像を取得する。
 * @param {string[]} photoKeys 写真のオブジェクトキー
 * @returns {Promise<string[]>} 署名付きのGET URLの一覧
 * @throws {ApplicationError} URLの発行に失敗した場合
 */
export const createPhotoViewUrls = async (photoKeys) => {
  if (photoKeys.length === 0) {
    return [];
  }

  try {
    return await Promise.all(
      photoKeys.map((key) =>
        getSignedUrl(
          getS3Client(),
          new GetObjectCommand({ Bucket: PHOTO_BUCKET_NAME, Key: key }),
          { expiresIn: PHOTO_VIEW_URL_EXPIRES_S }
        )
      )
    );
  } catch (error) {
    throw createDataSourceError('写真の表示URLの発行に失敗しました', {
      errorName: error.name
    });
  }
};
