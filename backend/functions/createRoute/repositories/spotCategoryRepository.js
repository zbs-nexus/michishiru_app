import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import {
  AWS_REGION,
  GENRE_ID_ATTRIBUTE,
  GENRE_NAME_ATTRIBUTE,
  GENRE_TABLE_NAME,
  SPOT_CATEGORY_ID_ATTRIBUTE,
  SPOT_CATEGORY_TABLE_NAME
} from '../constants.js';

/**
 * @description ジャンルから検索対象のスポットカテゴリを引くマスタ参照を担当する。
 * DynamoDBへのアクセスとアプリ形式への変換のみを行い、業務判断は持たない。
 *
 * どちらのマスタも件数が少ない参照専用テーブルで、ジャンル名・ジャンルIDを
 * キーに持たないため Scan を使う。
 * TODO(NZ未採番): CDK管理へ移すときにジャンル名をパーティションキーにして
 * Query へ切り替える（`back-data-access.md` は Scan を既定手段にしないこと、としている）。
 */

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
 * @description テーブル名が設定されているかを確かめる
 * @param {string} tableName 確かめるテーブル名
 * @param {string} label エラーメッセージに載せる対象名
 * @returns {void}
 * @throws {ApplicationError} 環境変数が未設定の場合
 */
const assertTableName = (tableName, label) => {
  if (tableName === '') {
    throw createDataSourceError(`${label}のテーブル名が設定されていません`, { label });
  }
};

/**
 * @description ジャンル名からジャンルIDを取得する
 * @param {string} genreName ジャンル名（例: 自然）
 * @returns {Promise<string|null>} 見つかったジャンルID。存在しない場合はnull
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const queryGenreIdByName = async (genreName) => {
  assertTableName(GENRE_TABLE_NAME, 'ジャンルマスタ');

  try {
    const response = await getDocumentClient().send(
      new ScanCommand({
        TableName: GENRE_TABLE_NAME,
        FilterExpression: '#genreName = :genreName',
        // 属性名が日本語のため、予約語回避と合わせて別名で指定する
        ExpressionAttributeNames: { '#genreName': GENRE_NAME_ATTRIBUTE },
        ExpressionAttributeValues: { ':genreName': genreName }
      })
    );

    const item = (response.Items ?? []).at(0);

    return item ? (item[GENRE_ID_ATTRIBUTE] ?? null) : null;
  } catch (error) {
    throw createDataSourceError('ジャンルマスタの取得に失敗しました', {
      errorName: error.name,
      genreName
    });
  }
};

/**
 * @description ジャンルIDに紐づくスポットカテゴリIDの一覧を取得する
 * @param {string} genreId ジャンルID
 * @returns {Promise<string[]>} PlacesのカテゴリIDの一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const querySpotCategoryIdsByGenreId = async (genreId) => {
  assertTableName(SPOT_CATEGORY_TABLE_NAME, 'カテゴリマスタ');

  try {
    const response = await getDocumentClient().send(
      new ScanCommand({
        TableName: SPOT_CATEGORY_TABLE_NAME,
        FilterExpression: '#genreId = :genreId',
        ExpressionAttributeNames: { '#genreId': GENRE_ID_ATTRIBUTE },
        ExpressionAttributeValues: { ':genreId': genreId }
      })
    );

    return (response.Items ?? [])
      .map((item) => item[SPOT_CATEGORY_ID_ATTRIBUTE])
      .filter((spotCategoryId) => typeof spotCategoryId === 'string' && spotCategoryId !== '');
  } catch (error) {
    throw createDataSourceError('カテゴリマスタの取得に失敗しました', {
      errorName: error.name,
      genreId
    });
  }
};
