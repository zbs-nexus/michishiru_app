import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { UpdateCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * @description カテゴリマスタ（michishiru_categorymaster_akutsu）の既存カテゴリに
 * genre_id = 1 を追加するスクリプト。
 * 
 * 対象カテゴリ:
 * - scenic_overlook_rest_area (景観の良い休憩所)
 * - scenic_point (景観ポイント)
 * - amusement_park (遊園地)
 * - street_or_square (通り・広場)
 * - tourist_information (観光案内所)
 * - gallery (ギャラリー)
 * 
 * 実行例:
 * node backend/tools/updatePhotoCategories.js
 */

/** テーブル名 */
const tableName = process.env.SPOT_CATEGORY_TABLE_NAME ?? 'michishiru_categorymaster_akutsu';

/** リージョン */
const region = process.env.AWS_REGION ?? 'ap-northeast-1';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

/**
 * genre_id = 1 を追加する対象カテゴリ一覧
 */
const TARGET_CATEGORIES = [
  'scenic_overlook_rest_area',
  'scenic_point',
  'amusement_park',
  'street_or_square',
  'tourist_information',
  'gallery'
];

/**
 * @description 指定したカテゴリにgenre_id = 1を追加する
 * @param {string} categoryId カテゴリID
 * @returns {Promise<void>}
 */
const updateCategory = async (categoryId) => {
  try {
    await client.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          category_id: categoryId
        },
        UpdateExpression: 'SET genre_id = :gid',
        ExpressionAttributeValues: {
          ':gid': 1
        }
      })
    );
    console.log(`  ✓ ${categoryId}`);
  } catch (error) {
    console.error(`  ✗ ${categoryId} - ${error.message}`);
  }
};

const main = async () => {
  console.log(`テーブル "${tableName}"（${region}）の ${TARGET_CATEGORIES.length} 件のカテゴリを更新します...\n`);
  console.log('対象カテゴリ:');
  TARGET_CATEGORIES.forEach((cat, index) => {
    console.log(`  ${index + 1}. ${cat}`);
  });
  console.log('\n更新中...');

  for (const categoryId of TARGET_CATEGORIES) {
    await updateCategory(categoryId);
  }

  console.log('\n✓ 更新が完了しました。');
};

main().catch((error) => {
  console.error('✗ 更新に失敗しました:', error);
  process.exit(1);
});
