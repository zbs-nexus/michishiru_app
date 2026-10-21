import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import { logError, logWarn } from '../../../shared/utils/logger.js';
import {
  AWS_REGION,
  GSI_SPOT_LIST,
  GSI_USER_REVIEW,
  REVIEW_SPOT_QUERY_LIMIT,
  REVIEW_SPOT_SORT_KEY,
  REVIEW_TABLE_NAME,
  USER_REVIEW_QUERY_LIMIT
} from '../constants.js';

/**
 * @description 口コミが付いた場所と、利用者が口コミを投稿した場所をDynamoDBから取得する。
 * データの取得とアプリ形式への変換のみを行い、距離による絞り込みや
 * 自分の口コミかどうかの判定はService層が行う。
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
    documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: AWS_REGION }));
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
 * @param {string} failureMessage 失敗したときのログとエラーの文言
 * @returns {Promise<object>} DynamoDBの応答
 * @throws {ApplicationError} リトライしても失敗した場合
 */
const sendWithRetry = async (command, failureMessage) => {
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

  // ApplicationError の context は上位でログに出ないため、ここで原因を残す
  logError(failureMessage, {
    indexName: command.input.IndexName,
    errorName: lastError?.name,
    errorMessage: lastError?.message
  });

  throw createDataSourceError(failureMessage, {
    errorName: lastError?.name
  });
};

/**
 * @description 口コミが付いた場所を新しい順に取得する。
 *
 * 場所メタ行は `sk = 'SPOT'` で揃っているため、GSI-SpotList（PK=sk）を使うと
 * Scan を使わずに Query 1回で引ける。現在地からの距離による絞り込みはService層が行う。
 * GSI-GeoCell（40m四方のセル）で数kmの範囲を引くと数千回の Query が必要になるため使わない。
 * @returns {Promise<Array<{spotId: string, name: string, genreId: string|null, position: number[], ratingAverage: number}>>} 口コミの場所の一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const listReviewSpots = async () => {
  const response = await sendWithRetry(
    new QueryCommand({
      TableName: REVIEW_TABLE_NAME,
      IndexName: GSI_SPOT_LIST,
      KeyConditionExpression: '#sk = :sk',
      ExpressionAttributeNames: { '#sk': 'sk' },
      ExpressionAttributeValues: { ':sk': REVIEW_SPOT_SORT_KEY },
      // 新しい順に返す
      ScanIndexForward: false,
      Limit: REVIEW_SPOT_QUERY_LIMIT
    }),
    '口コミの場所の取得に失敗しました'
  );

  return (response.Items ?? []).map((item) => {
    const ratingCount = Number(item.ratingCount ?? 0);
    const ratingSum = Number(item.ratingSum ?? 0);

    return {
      // 自分が口コミ投稿済みの場所かを、口コミ行の spotId と突き合わせて見分けるために使う
      spotId: item.spotId,
      name: item.spotName,
      // 投稿時に選んだジャンル（検索条件マスタの genreId）。検索条件との突き合わせに使う
      genreId: typeof item.genreId === 'string' ? item.genreId : null,
      // Places の候補と同じ [経度, 緯度] の形に揃える
      position: [Number(item.position?.lng), Number(item.position?.lat)],
      // 平均評価は保存せず、合計と件数から都度算出する（getSpot と同じ扱い）
      ratingAverage: ratingCount === 0 ? 0 : ratingSum / ratingCount
    };
  });
};

/**
 * @description 指定ユーザーが口コミを投稿した場所のIDを、新しい順に取得する。
 *
 * 口コミ行だけが userId を持つため、GSI-UserReview（PK=userId）を引くと
 * そのユーザーの口コミ行だけが返る。件数は地図のオレンジのピン（getUserReviews）と揃える。
 * @param {string} userId ユーザーID（Cognito の sub）
 * @returns {Promise<string[]>} 口コミを投稿した場所のIDの一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const queryReviewedSpotIdsByUserId = async (userId) => {
  const response = await sendWithRetry(
    new QueryCommand({
      TableName: REVIEW_TABLE_NAME,
      IndexName: GSI_USER_REVIEW,
      KeyConditionExpression: '#userId = :userId',
      ExpressionAttributeNames: { '#userId': 'userId', '#spotId': 'spotId' },
      ExpressionAttributeValues: { ':userId': userId },
      // 場所の見分けに使うのは spotId だけのため、ほかの属性は受け取らない
      ProjectionExpression: '#spotId',
      // 新しい順に返す
      ScanIndexForward: false,
      Limit: USER_REVIEW_QUERY_LIMIT
    }),
    '自分の口コミの取得に失敗しました'
  );

  return (response.Items ?? []).map((item) => item.spotId);
};
