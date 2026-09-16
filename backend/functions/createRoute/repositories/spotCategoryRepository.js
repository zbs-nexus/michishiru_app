import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import {
  AWS_REGION,
  CONDITION_TABLE_NAME,
  GENRE_CONDITION_PK,
  GENRE_CONDITION_SK_PREFIX,
  GENRE_ID_ATTRIBUTE,
  SPOT_CATEGORY_ID_ATTRIBUTE,
  SPOT_CATEGORY_TABLE_NAME
} from '../constants.js';

/**
 * @description ジャンルから検索対象のスポットカテゴリを引くマスタ参照を担当する。
 * DynamoDBへのアクセスとアプリ形式への変換のみを行い、業務判断は持たない。
 *
 * フロントは英語のジャンルID（genreId。例: food / nature）を送る。検索条件マスタ
 * （michimaster）のジャンル項目でこれを、両マスタを紐づける数値ジャンルキー
 * （genre_id。例: 2 / 4）へ変換し、その数値でカテゴリマスタを引く。
 *
 * 検索条件マスタは pk / sk 設計のため、ジャンル項目は GetItem で1件引ける。
 * カテゴリマスタは数値ジャンルキーをキーに持たないため Scan を使う。
 * TODO(NZ未採番): カテゴリマスタも CDK管理へ移すときにキー設計を見直し Query へ切り替える
 * （`back-data-access.md` は Scan を既定手段にしないこと、としている）。
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
 * @description 英語のジャンルID（genreId）から、カテゴリマスタと紐づく
 * 数値ジャンルキー（genre_id）を取得する。
 * 検索条件マスタのジャンル項目（pk=GENRE#ALL, sk=METADATA#<genreId>）を GetItem で引く。
 * @param {string} genreId ジャンルID（英語。例: food）
 * @returns {Promise<string|null>} 数値ジャンルキー。存在しない場合はnull
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const queryGenreNumberByGenreId = async (genreId) => {
  assertTableName(CONDITION_TABLE_NAME, '検索条件マスタ');

  try {
    const response = await getDocumentClient().send(
      new GetCommand({
        TableName: CONDITION_TABLE_NAME,
        Key: {
          pk: GENRE_CONDITION_PK,
          sk: `${GENRE_CONDITION_SK_PREFIX}${genreId}`
        }
      })
    );

    const item = response.Item ?? null;

    return item ? (item[GENRE_ID_ATTRIBUTE] ?? null) : null;
  } catch (error) {
    throw createDataSourceError('ジャンルマスタの取得に失敗しました', {
      errorName: error.name,
      genreId
    });
  }
};

/**
 * @description 数値ジャンルキー（genre_id）に紐づくスポットカテゴリIDの一覧を取得する
 * @param {string} genreNumber 数値ジャンルキー（例: 2）
 * @returns {Promise<string[]>} PlacesのカテゴリIDの一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const querySpotCategoryIdsByGenreNumber = async (genreNumber) => {
  assertTableName(SPOT_CATEGORY_TABLE_NAME, 'カテゴリマスタ');

  try {
    const response = await getDocumentClient().send(
      new ScanCommand({
        TableName: SPOT_CATEGORY_TABLE_NAME,
        FilterExpression: '#genreNumber = :genreNumber',
        ExpressionAttributeNames: { '#genreNumber': GENRE_ID_ATTRIBUTE },
        ExpressionAttributeValues: { ':genreNumber': genreNumber }
      })
    );

    return (response.Items ?? [])
      .map((item) => item[SPOT_CATEGORY_ID_ATTRIBUTE])
      .filter((spotCategoryId) => typeof spotCategoryId === 'string' && spotCategoryId !== '');
  } catch (error) {
    throw createDataSourceError('カテゴリマスタの取得に失敗しました', {
      errorName: error.name,
      genreNumber
    });
  }
};
