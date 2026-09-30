import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ScanCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * @description カテゴリマスタ（michishiru_categorymaster_akutsu）の全データを取得して表示するスクリプト。
 * 
 * 実行例:
 * node backend/tools/listCategories.js
 */

/** テーブル名 */
const tableName = process.env.SPOT_CATEGORY_TABLE_NAME ?? 'michishiru_categorymaster_akutsu';

/** リージョン */
const region = process.env.AWS_REGION ?? 'ap-northeast-1';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

const main = async () => {
  console.log(`テーブル "${tableName}"（${region}）からデータを取得します...\n`);

  const response = await client.send(
    new ScanCommand({
      TableName: tableName
    })
  );

  const items = response.Items ?? [];
  
  // genre_idごとにグループ化（nullやundefinedは 'null' として扱う）
  const groupedByGenre = items.reduce((acc, item) => {
    const genreId = item.genre_id != null ? String(item.genre_id) : 'null';
    if (!acc[genreId]) {
      acc[genreId] = [];
    }
    acc[genreId].push(item);
    return acc;
  }, {});

  // 結果を表示
  console.log(`取得件数: ${items.length} 件\n`);
  
  Object.keys(groupedByGenre).sort().forEach(genreId => {
    const categories = groupedByGenre[genreId];
    console.log(`\n■ genre_id = ${genreId} (${categories.length}件)`);
    console.log('─'.repeat(70));
    categories.forEach((cat, index) => {
      console.log(`  ${String(index + 1).padStart(2)}. ${cat.category_id}`);
    });
  });
  
  console.log('\n');
};

main().catch((error) => {
  console.error('✗ 取得に失敗しました:', error);
  process.exit(1);
});
