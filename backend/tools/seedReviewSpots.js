import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { marshall } from '@aws-sdk/util-dynamodb';
import {
  calculateDistanceM,
  SAME_PLACE_RADIUS_M,
  toGeoCell
} from '../shared/utils/geo.js';
import { REVIEW_SPOT_SEEDS, SEED_AREA, SEED_GENRES } from './reviewSpotSeeds.js';

/**
 * @description テスト用の口コミの場所（大手町ビル周辺）を Review テーブルへ投入・削除する。
 *
 * 書き込む行は createReview と同じ形（場所メタ `sk='SPOT'` と口コミ `sk='REVIEW#<userId>'`）。
 * 投稿者は架空のテスト用ユーザー（`seed-user-01` 〜）にするため、実際の利用者からは
 * 「他の人の口コミ」（紫のピン・評価のみ）として見える。
 *
 * 座標・評価・投稿者は決まった種の乱数で作るため、何度実行しても同じ内容になる。
 * spotId も名前の並びから決まるため、再投入は上書きになり、行が増え続けない。
 *
 * 使い方（既定は確認だけで、書き込まない）:
 *   REVIEW_TABLE_NAME=Review-dev node tools/seedReviewSpots.js            内容の確認
 *   REVIEW_TABLE_NAME=Review-dev node tools/seedReviewSpots.js --apply    投入
 *   REVIEW_TABLE_NAME=Review-dev node tools/seedReviewSpots.js --delete   投入した行の削除
 *   REVIEW_TABLE_NAME=Review-dev node tools/seedReviewSpots.js --export   CloudShell 用のファイルを書き出す
 *
 * --export は AWS へ接続せず、AWS CLI の `batch-write-item` にそのまま渡せる形
 * （1行に25件ずつのバッチ）で、投入用と削除用のファイルを tools/output/ に書き出す。
 * 手元に認証情報が無くても、AWS コンソールの CloudShell へアップロードして投入できる。
 *
 * 本番テーブルへの手動操作は規約（back-data-access.md）で禁止されているため、
 * テーブル名に prod を含む場合は実行しない。
 */

/** 投入先テーブル名。誤って別のテーブルへ書かないよう、既定値は持たない */
const tableName = process.env.REVIEW_TABLE_NAME ?? '';

/** リージョン */
const region = process.env.AWS_REGION ?? 'ap-northeast-1';

/** 実行モード */
const mode = process.argv.includes('--apply')
  ? 'apply'
  : process.argv.includes('--delete')
    ? 'delete'
    : process.argv.includes('--export')
      ? 'export'
      : 'dry-run';

/** --export の書き出し先（このファイルと同じ tools/ の下。Git の管理外） */
const EXPORT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'output');

/** BatchWrite の1回あたりの最大件数（DynamoDB の制限） */
const BATCH_SIZE = 25;

/** 未処理の行を送り直す最大回数 */
const MAX_UNPROCESSED_RETRY_COUNT = 5;

/** 場所メタ行のソートキー */
const SPOT_SORT_KEY = 'SPOT';

/** ロケーション名の最大文字数（createReview の検証と揃える） */
const SPOT_NAME_MAX_LENGTH = 30;

/** テスト用の投稿者の人数 */
const SEED_USER_COUNT = 8;

/** 1か所あたりの口コミ件数の範囲 */
const REVIEW_COUNT_RANGE = { min: 1, max: 6 };

/**
 * 場所どうしの最小の間隔（m）。
 * 口コミは半径40m以内を同じ場所とみなすため、それより十分に離す。
 */
const MIN_SPOT_GAP_M = SAME_PLACE_RADIUS_M * 2;

/** 投稿日時を散らす期間（日）。新しい順の一覧で実際の投稿より前に並ぶよう、過去へ散らす */
const CREATED_AT_SPREAD_DAYS = 30;

/** 乱数の種。変えると座標・評価がすべて変わる */
const RANDOM_SEED = 20261021;

/**
 * @description 決まった種から同じ並びを返す乱数（mulberry32）
 * @param {number} seed 種
 * @returns {() => number} 0以上1未満の数を返す関数
 */
const createRandom = (seed) => {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * @description 名前から UUID v4 の形の ID を決める（再実行しても同じ ID になる）
 * @param {string} name 場所の名前
 * @returns {string} UUID v4 の形の文字列
 */
const toSeedSpotId = (name) => {
  const hex = createHash('sha256').update(`michishiru-seed-review-spot:${name}`).digest('hex');
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(17, 20)}`,
    hex.slice(20, 32)
  ].join('-');
};

/**
 * @description テスト用の投稿者のIDを作る
 * @param {number} index 0始まりの番号
 * @returns {string} 投稿者のID
 */
const toSeedUserId = (index) => `seed-user-${String(index + 1).padStart(2, '0')}`;

/**
 * @description 範囲内で、ほかの場所と十分に離れた座標を決める
 * @param {() => number} random 乱数
 * @param {{lng: number, lat: number}[]} placed 決定済みの座標
 * @returns {{lng: number, lat: number}} 座標
 * @throws {Error} 範囲内に置ききれない場合
 */
const pickPosition = (random, placed) => {
  for (let attempt = 0; attempt < 5000; attempt += 1) {
    const position = {
      // 小数第6位（約10cm）で丸め、投稿時の座標と同じ程度の細かさにする
      lng: Number((SEED_AREA.minLng + random() * (SEED_AREA.maxLng - SEED_AREA.minLng)).toFixed(6)),
      lat: Number((SEED_AREA.minLat + random() * (SEED_AREA.maxLat - SEED_AREA.minLat)).toFixed(6))
    };

    const isFarEnough = placed.every(
      (other) => calculateDistanceM(position, other) >= MIN_SPOT_GAP_M
    );

    if (isFarEnough) {
      return position;
    }
  }

  throw new Error('範囲内に場所を置ききれません。範囲を広げるか件数を減らしてください');
};

/**
 * @description 1か所ぶんの口コミを作る。
 * 場所ごとに「だいたいの評判」を決め、そこから人によってぶれる評価を付ける。
 * 評判が低い場所・高い場所・賛否が割れる場所が混ざるようにする。
 * @param {() => number} random 乱数
 * @returns {{userIndex: number, rating: number}[]} 口コミ（投稿者は重複しない）
 */
const pickReviews = (random) => {
  const count =
    REVIEW_COUNT_RANGE.min +
    Math.floor(random() * (REVIEW_COUNT_RANGE.max - REVIEW_COUNT_RANGE.min + 1));

  // だいたいの評判（1.2〜4.9）と、人による評価のぶれ（0.3〜1.8）
  const reputation = 1.2 + random() * 3.7;
  const spread = 0.3 + random() * 1.5;

  const userIndexes = Array.from({ length: SEED_USER_COUNT }, (_, index) => index);

  // 投稿者を重複なく選ぶ（Fisher-Yates の先頭 count 件）
  for (let index = userIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [userIndexes[index], userIndexes[swapIndex]] = [userIndexes[swapIndex], userIndexes[index]];
  }

  return userIndexes.slice(0, count).map((userIndex) => {
    const rating = Math.round(reputation + (random() * 2 - 1) * spread);
    return { userIndex, rating: Math.min(5, Math.max(1, rating)) };
  });
};

/**
 * @description 投入する行（場所メタと口コミ）を組み立てる
 * @returns {{spots: object[], items: object[]}} 場所の一覧と、書き込む行
 */
const buildSeedItems = () => {
  const random = createRandom(RANDOM_SEED);
  const now = Date.now();
  const placed = [];
  const spots = [];
  const items = [];

  REVIEW_SPOT_SEEDS.forEach((seed) => {
    const position = pickPosition(random, placed);
    placed.push(position);

    const reviews = pickReviews(random);
    const spotId = toSeedSpotId(seed.name);
    const createdAtMs = now - Math.floor(random() * CREATED_AT_SPREAD_DAYS * 24 * 60 * 60 * 1000);
    const createdAt = new Date(createdAtMs).toISOString();
    const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0);

    // 最初の投稿者を場所の作成者にする（作成者は名前・ジャンルを編集できる）
    const createdByUserId = toSeedUserId(reviews[0].userIndex);

    spots.push({
      spotId,
      name: seed.name,
      genreId: seed.genreId,
      position,
      ratings: reviews.map((review) => review.rating),
      ratingAverage: ratingSum / reviews.length
    });

    items.push({
      spotId,
      sk: SPOT_SORT_KEY,
      geoCell: toGeoCell(position),
      spotName: seed.name,
      genreId: seed.genreId,
      genreName: SEED_GENRES[seed.genreId],
      position,
      ratingSum,
      ratingCount: reviews.length,
      photoKeys: [],
      createdByUserId,
      createdAt,
      updatedAt: createdAt
    });

    reviews.forEach((review, order) => {
      const userId = toSeedUserId(review.userIndex);
      // 口コミの日時は場所の作成以降に並べる
      const reviewedAt = new Date(createdAtMs + order * 60 * 60 * 1000).toISOString();

      items.push({
        spotId,
        sk: `REVIEW#${userId}`,
        userId,
        rating: review.rating,
        createdAt: reviewedAt,
        updatedAt: reviewedAt
      });
    });
  });

  return { spots, items };
};

/**
 * @description 投入する内容が createReview の規則に沿っているかを確かめる。
 * 書き込む前に止められるよう、1つでも外れたら例外にする。
 * @param {{spots: object[], items: object[]}} seedData 投入する内容
 * @returns {void}
 * @throws {Error} 規則に沿わない内容がある場合
 */
const validateSeedItems = ({ spots, items }) => {
  const errors = [];
  const names = new Set();
  const spotIds = new Set();

  spots.forEach((spot) => {
    if (names.has(spot.name)) errors.push(`名前が重複しています: ${spot.name}`);
    if (spotIds.has(spot.spotId)) errors.push(`spotId が重複しています: ${spot.name}`);
    names.add(spot.name);
    spotIds.add(spot.spotId);

    if ([...spot.name].length > SPOT_NAME_MAX_LENGTH) {
      errors.push(`名前が${SPOT_NAME_MAX_LENGTH}文字を超えています: ${spot.name}`);
    }

    if (!(spot.genreId in SEED_GENRES)) {
      errors.push(`ジャンルが不正です: ${spot.name}（${spot.genreId}）`);
    }

    if (
      spot.position.lng < SEED_AREA.minLng ||
      spot.position.lng > SEED_AREA.maxLng ||
      spot.position.lat < SEED_AREA.minLat ||
      spot.position.lat > SEED_AREA.maxLat
    ) {
      errors.push(`範囲外の座標です: ${spot.name}`);
    }

    if (!spot.ratings.every((rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5)) {
      errors.push(`評価が1〜5の整数ではありません: ${spot.name}`);
    }
  });

  // 半径40m以内に別の場所があると、投稿時に同じ場所として扱われてしまう
  spots.forEach((spot, index) => {
    spots.slice(index + 1).forEach((other) => {
      const distanceM = calculateDistanceM(spot.position, other.position);

      if (distanceM <= SAME_PLACE_RADIUS_M) {
        errors.push(`近すぎる場所があります: ${spot.name} / ${other.name}（${Math.round(distanceM)}m）`);
      }
    });
  });

  // 場所メタの集計と、口コミ行の評価が一致すること
  items
    .filter((item) => item.sk === SPOT_SORT_KEY)
    .forEach((spotItem) => {
      const reviewItems = items.filter(
        (item) => item.spotId === spotItem.spotId && item.sk !== SPOT_SORT_KEY
      );
      const sum = reviewItems.reduce((total, item) => total + item.rating, 0);

      if (reviewItems.length !== spotItem.ratingCount || sum !== spotItem.ratingSum) {
        errors.push(`評価の集計が口コミと一致しません: ${spotItem.spotName}`);
      }
    });

  if (errors.length > 0) {
    throw new Error(`投入内容に問題があります:\n- ${errors.join('\n- ')}`);
  }
};

/**
 * @description 配列を指定サイズごとに分割する
 * @param {Array} values 分割対象
 * @param {number} size 1グループのサイズ
 * @returns {Array[]} 分割後の配列
 */
const chunk = (values, size) => {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
};

/**
 * @description BatchWrite を実行し、未処理の行が返されたら送り直す
 * @param {DynamoDBDocumentClient} client クライアント
 * @param {object[]} requests PutRequest / DeleteRequest の配列（25件以内）
 * @returns {Promise<void>}
 * @throws {Error} 送り直しても未処理の行が残る場合
 */
const sendBatch = async (client, requests) => {
  let pending = requests;

  for (let attempt = 0; attempt <= MAX_UNPROCESSED_RETRY_COUNT; attempt += 1) {
    const response = await client.send(
      new BatchWriteCommand({ RequestItems: { [tableName]: pending } })
    );

    pending = response.UnprocessedItems?.[tableName] ?? [];

    if (pending.length === 0) {
      return;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 2 ** attempt * 100);
    });
  }

  throw new Error(`未処理の行が ${pending.length} 件残りました`);
};

/**
 * @description 投入する内容を一覧で表示する
 * @param {object[]} spots 場所の一覧
 * @returns {void}
 */
const printSummary = (spots) => {
  const byGenre = Object.keys(SEED_GENRES).map(
    (genreId) => `${SEED_GENRES[genreId]} ${spots.filter((spot) => spot.genreId === genreId).length}件`
  );
  const reviewCount = spots.reduce((total, spot) => total + spot.ratings.length, 0);

  console.log(`場所 ${spots.length}件（${byGenre.join(' / ')}）・口コミ ${reviewCount}件`);
  console.log('');

  spots.forEach((spot) => {
    const distanceM = Math.round(calculateDistanceM(SEED_AREA.center, spot.position));
    console.log(
      `★${spot.ratingAverage.toFixed(1)}（${spot.ratings.length}件: ${spot.ratings.join(',')}）` +
        ` [${SEED_GENRES[spot.genreId]}] ${spot.name}  大手町ビルから約${distanceM}m`
    );
  });
};

/**
 * @description CloudShell で投入・削除できるよう、AWS CLI に渡すファイルを書き出す。
 * 1行が1回分の `batch-write-item --request-items` に渡す JSON（25件ずつ）になる。
 * @param {object[]} items 投入する行
 * @returns {void}
 */
const exportForCloudShell = (items) => {
  mkdirSync(EXPORT_DIR, { recursive: true });

  const toLines = (requests) =>
    chunk(requests, BATCH_SIZE)
      .map((group) => JSON.stringify({ [tableName]: group }))
      .join('\n');

  const putRequests = items.map((item) => ({
    PutRequest: { Item: marshall(item, { removeUndefinedValues: true }) }
  }));
  const deleteRequests = items.map((item) => ({
    DeleteRequest: { Key: marshall({ spotId: item.spotId, sk: item.sk }) }
  }));

  const putPath = resolve(EXPORT_DIR, 'seed-review-spots-put.jsonl');
  const deletePath = resolve(EXPORT_DIR, 'seed-review-spots-delete.jsonl');

  writeFileSync(putPath, `${toLines(putRequests)}\n`, 'utf8');
  writeFileSync(deletePath, `${toLines(deleteRequests)}\n`, 'utf8');

  console.log(`投入用: ${putPath}（${items.length}行・${Math.ceil(items.length / BATCH_SIZE)}回分）`);
  console.log(`削除用: ${deletePath}`);
};

const main = async () => {
  const seedData = buildSeedItems();
  validateSeedItems(seedData);

  if (mode === 'dry-run') {
    printSummary(seedData.spots);
    console.log('');
    console.log('確認のみで終了しました。書き込むには --apply を付けて実行してください。');
    return;
  }

  if (tableName === '') {
    throw new Error('REVIEW_TABLE_NAME を指定してください（例: Review-dev）');
  }

  if (/prod/i.test(tableName)) {
    throw new Error(`本番テーブル（${tableName}）へは投入できません。dev のテーブルを指定してください`);
  }

  if (mode === 'export') {
    exportForCloudShell(seedData.items);
    return;
  }

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));

  const requests =
    mode === 'apply'
      ? seedData.items.map((item) => ({ PutRequest: { Item: item } }))
      : seedData.items.map((item) => ({
        DeleteRequest: { Key: { spotId: item.spotId, sk: item.sk } }
      }));

  console.log(
    `テーブル "${tableName}"（${region}）の ${requests.length} 行を${mode === 'apply' ? '投入' : '削除'}します...`
  );

  for (const group of chunk(requests, BATCH_SIZE)) {
    await sendBatch(client, group);
  }

  console.log(mode === 'apply' ? '投入が完了しました。' : '削除が完了しました。');
};

main().catch((error) => {
  console.error('失敗しました:', error.message);
  process.exit(1);
});
