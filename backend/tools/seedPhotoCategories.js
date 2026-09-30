import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * @description カテゴリマスタ（michishiru_categorymaster_akutsu）へ
 * 写真映えスポット用のカテゴリを追加するスクリプト。
 * 
 * 追加するカテゴリ（すべて genre_id = 1）:
 * - Art, Monument, Sculpture
 * - Landmark, Tourist Attraction
 * - Observation Deck, Viewpoint
 * - Historic Place, Nightlife Zone
 * - Architecture, Point of Interest
 * 
 * 実行例:
 * node backend/tools/seedPhotoCategories.js
 * 
 * または環境変数を指定:
 * SPOT_CATEGORY_TABLE_NAME=michishiru_categorymaster_akutsu AWS_REGION=ap-northeast-1 node backend/tools/seedPhotoCategories.js
 */

/** 投入先テーブル名 */
const tableName = process.env.SPOT_CATEGORY_TABLE_NAME ?? 'michishiru_categorymaster_akutsu';

/** リージョン */
const region = process.env.AWS_REGION ?? 'ap-northeast-1';

/** BatchWrite の1回あたりの最大件数（DynamoDB の制限） */
const BATCH_SIZE = 25;

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

/**
 * 写真映えスポット用のカテゴリ一覧。
 * すべて genre_id = 1 を設定する。
 */
const PHOTO_CATEGORIES = [
  // パブリックアート・モニュメント
  { category_id: 'Art', genre_id: 1 },
  { category_id: 'Monument', genre_id: 1 },
  { category_id: 'Sculpture', genre_id: 1 },
  
  // ランドマーク・観光名所
  { category_id: 'Landmark', genre_id: 1 },
  { category_id: 'Tourist Attraction', genre_id: 1 },
  
  // 展望台・夜景スポット
  { category_id: 'Observation Deck', genre_id: 1 },
  { category_id: 'Viewpoint', genre_id: 1 },
  
  // レトロな街並み・横丁
  { category_id: 'Historic Place', genre_id: 1 },
  { category_id: 'Nightlife Zone', genre_id: 1 },
  
  // 現代建築・デザイン
  { category_id: 'Architecture', genre_id: 1 },
  { category_id: 'Point of Interest', genre_id: 1 }
];

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
  console.log(`テーブル "${tableName}"（${region}）へ ${PHOTO_CATEGORIES.length} 件を投入します...`);
  console.log('\n追加カテゴリ:');
  PHOTO_CATEGORIES.forEach((cat, index) => {
    console.log(`  ${index + 1}. ${cat.category_id} (genre_id: ${cat.genre_id})`);
  });
  console.log('');

  for (const group of chunk(PHOTO_CATEGORIES, BATCH_SIZE)) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: group.map((category) => ({ PutRequest: { Item: category } }))
        }
      })
    );
  }

  console.log('✓ 投入が完了しました。');
};

main().catch((error) => {
  console.error('✗ 投入に失敗しました:', error);
  process.exit(1);
});
