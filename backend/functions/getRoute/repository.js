import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { logWarn } from '../../shared/utils/logger.js';
import {
  DEFAULT_QUERY_LIMIT,
  GSI_CATEGORY_DISTANCE,
  ROUTE_TABLE_NAME
} from './constants.js';
import { SEED_ROUTES } from './seedRoutes.js';

/**
 * @description ルートデータの取得を担当する。
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
 * @description テーブルが設定されているかどうかを返す
 * @returns {boolean} 設定済みの場合はtrue
 */
export const hasRouteTable = () => ROUTE_TABLE_NAME !== '';

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

  throw createDataSourceError('ルートの取得に失敗しました', {
    errorName: lastError?.name
  });
};

/**
 * @description DynamoDBの項目をアプリで扱う形へ変換する
 * @param {object} item DynamoDBから取得した項目
 * @returns {object} アプリ形式のルート
 */
const toRoute = (item) => ({
  routeId: item.routeId,
  routeName: item.routeName,
  description: item.description ?? '',
  category: item.category,
  purpose: item.purpose ?? null,
  distance: Number(item.distance),
  waypoints: (item.waypoints ?? []).map((waypoint) => ({
    waypointId: waypoint.waypointId,
    name: waypoint.name,
    type: waypoint.type,
    icon: waypoint.icon
  })),
  createdAt: item.createdAt
});

/**
 * @description ルートを1件取得する
 * @param {string} routeId ルートのID
 * @returns {Promise<object|null>} 見つかったルート。存在しない場合はnull
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getRouteById = async (routeId) => {
  if (!hasRouteTable()) {
    return SEED_ROUTES.find((route) => route.routeId === routeId) ?? null;
  }

  const response = await sendWithRetry(
    new GetCommand({
      TableName: ROUTE_TABLE_NAME,
      Key: { routeId }
    })
  );

  return response.Item ? toRoute(response.Item) : null;
};

/**
 * @description カテゴリと距離が一致するルートを取得する
 * @param {object} conditions 検索条件
 * @param {string} conditions.category カテゴリ
 * @param {number} conditions.distance 希望距離（km）
 * @param {number} [conditions.limit] 取得件数の上限
 * @returns {Promise<object[]>} 条件に一致したルートの一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const queryRoutesByCategory = async ({
  category,
  distance,
  limit = DEFAULT_QUERY_LIMIT
}) => {
  if (!hasRouteTable()) {
    return SEED_ROUTES.filter(
      (route) => route.category === category && route.distance === distance
    ).slice(0, limit);
  }

  const response = await sendWithRetry(
    new QueryCommand({
      TableName: ROUTE_TABLE_NAME,
      IndexName: GSI_CATEGORY_DISTANCE,
      KeyConditionExpression: '#category = :category AND #distance = :distance',
      ExpressionAttributeNames: {
        '#category': 'category',
        '#distance': 'distance'
      },
      ExpressionAttributeValues: {
        ':category': category,
        ':distance': distance
      },
      Limit: limit
    })
  );

  return (response.Items ?? []).map(toRoute);
};

/**
 * @description カテゴリが一致するルートを距離を問わず取得する
 * @param {object} conditions 検索条件
 * @param {string} conditions.category カテゴリ
 * @param {number} [conditions.limit] 取得件数の上限
 * @returns {Promise<object[]>} 条件に一致したルートの一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const queryRoutesByCategoryOnly = async ({
  category,
  limit = DEFAULT_QUERY_LIMIT
}) => {
  if (!hasRouteTable()) {
    return SEED_ROUTES.filter((route) => route.category === category).slice(0, limit);
  }

  const response = await sendWithRetry(
    new QueryCommand({
      TableName: ROUTE_TABLE_NAME,
      IndexName: GSI_CATEGORY_DISTANCE,
      KeyConditionExpression: '#category = :category',
      ExpressionAttributeNames: {
        '#category': 'category'
      },
      ExpressionAttributeValues: {
        ':category': category
      },
      Limit: limit
    })
  );

  return (response.Items ?? []).map(toRoute);
};
