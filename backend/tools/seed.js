import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { SEED_ROUTES } from '../functions/getRoute/seedRoutes.js';

/**
 * @description デプロイ済みの DynamoDB テーブルへ初期データ（SEED_ROUTES）を投入するスクリプト。
 * ローカルのシードデータをそのまま本番テーブルへ書き込む。
 * 実行例: ROUTE_TABLE_NAME=Route AWS_REGION=ap-northeast-1 node tools/seed.js
 */

/** 投入先テーブル名 */
const tableName = process.env.ROUTE_TABLE_NAME ?? 'Route';

/** リージョン */
const region = process.env.AWS_REGION ?? 'ap-northeast-1';

/** BatchWrite の1回あたりの最大件数（DynamoDB の制限） */
const BATCH_SIZE = 25;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

/**
 * @description 配列を指定サイズごとに分割する
 * @param {Array} items 分割対象
 * @param {number} size 1グループのサイズ
 * @returns {Array[]} 分割後の配列
 */
const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const main = async () => {
  console.log(`テーブル "${tableName}"（${region}）へ ${SEED_ROUTES.length} 件を投入します...`);

  for (const group of chunk(SEED_ROUTES, BATCH_SIZE)) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: group.map((route) => ({ PutRequest: { Item: route } }))
        }
      })
    );
  }

  console.log('投入が完了しました。');
};

main().catch((error) => {
  console.error('投入に失敗しました:', error);
  process.exit(1);
});
