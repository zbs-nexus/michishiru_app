import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ERROR_CODES } from '../../../shared/constants/errorCodes.js';

/**
 * @description 口コミの場所を読む Repository のテスト。
 *
 * 確かめたいのは「送る Query の形」と「アプリ形式への変換」「例外の読み替え」。
 * 索引名やキー条件のタイプミスはデプロイするまで現れないため、ここで固定する。
 * AWSへは接続しない。DynamoDBDocumentClient.from を差し替え、送られたコマンドを記録する。
 */

/** テーブル名は constants.js が読み込み時に1度だけ読むため、import より先に設定する */
process.env.REVIEW_TABLE_NAME = 'Review-test';
process.env.AWS_REGION = process.env.AWS_REGION ?? 'ap-northeast-1';

/** 送られたコマンドの記録 */
let sentCommands = [];

/** send の振る舞い。テストごとに差し替える */
let sendImplementation = async () => ({ Items: [] });

// repository はクライアントを1度だけ生成して使い回すため、
// 毎回同じ器を返し、中の振る舞いだけを入れ替える
mock.method(DynamoDBDocumentClient, 'from', () => ({
  send: async (command) => {
    sentCommands.push(command);
    return sendImplementation(command);
  }
}));

const { listReviewSpots } = await import('../repositories/reviewSpotRepository.js');

/**
 * @description DynamoDB の例外を模した値を作る
 * @param {string} name 例外名
 * @returns {Error} 例外
 */
const createAwsError = (name) => Object.assign(new Error(name), { name });

describe('listReviewSpots', () => {
  beforeEach(() => {
    sentCommands = [];
    sendImplementation = async () => ({ Items: [] });
  });

  it('GSI-SpotList を sk=SPOT で新しい順に、件数上限つきで引く（Scan は使わない）', async () => {
    await listReviewSpots();

    assert.equal(sentCommands.length, 1);
    assert.equal(sentCommands[0].constructor.name, 'QueryCommand');
    assert.deepEqual(sentCommands[0].input, {
      TableName: 'Review-test',
      IndexName: 'GSI-SpotList',
      KeyConditionExpression: '#sk = :sk',
      ExpressionAttributeNames: { '#sk': 'sk' },
      ExpressionAttributeValues: { ':sk': 'SPOT' },
      ScanIndexForward: false,
      Limit: 200
    });
  });

  it('場所メタ行を名前・ジャンル・[経度, 緯度]・平均評価へ変換する', async () => {
    sendImplementation = async () => ({
      Items: [
        {
          spotId: 'spot-1',
          sk: 'SPOT',
          spotName: '中央公園の東屋',
          genreId: 'nature',
          genreName: '自然',
          position: { lng: 139.70451, lat: 35.68721 },
          ratingSum: 9,
          ratingCount: 2,
          createdByUserId: 'user-x'
        }
      ]
    });

    const spots = await listReviewSpots();

    // 作成者のIDなど、ルート作成に不要な値は持ち出さない
    assert.deepEqual(spots, [
      {
        name: '中央公園の東屋',
        genreId: 'nature',
        position: [139.70451, 35.68721],
        ratingAverage: 4.5
      }
    ]);
  });

  it('ジャンルを持たない（または文字列でない）場所メタ行は genreId を null にする', async () => {
    sendImplementation = async () => ({
      Items: [
        { spotName: 'ジャンルなし', position: { lng: 139.7, lat: 35.6 } },
        { spotName: '数値のジャンル', genreId: 2, position: { lng: 139.7, lat: 35.6 } }
      ]
    });

    const spots = await listReviewSpots();

    assert.deepEqual(
      spots.map((spot) => spot.genreId),
      [null, null]
    );
  });

  it('評価件数が0のときは平均評価を0にする（0除算でNaNにしない）', async () => {
    sendImplementation = async () => ({
      Items: [{ spotName: 'A', position: { lng: 139.7, lat: 35.6 }, ratingSum: 0, ratingCount: 0 }]
    });

    const [spot] = await listReviewSpots();

    assert.equal(spot.ratingAverage, 0);
  });

  it('座標が欠けた行も落とさず NaN のまま返す（除外は Service が行う）', async () => {
    sendImplementation = async () => ({ Items: [{ spotName: 'B' }] });

    const [spot] = await listReviewSpots();

    assert.ok(Number.isNaN(spot.position[0]));
    assert.ok(Number.isNaN(spot.position[1]));
  });

  it('Items が無い応答は空配列にする', async () => {
    sendImplementation = async () => ({});

    assert.deepEqual(await listReviewSpots(), []);
  });

  it('スロットリングは再試行し、成功すればその結果を返す', async () => {
    let callCount = 0;
    sendImplementation = async () => {
      callCount += 1;

      if (callCount === 1) {
        throw createAwsError('ThrottlingException');
      }

      return { Items: [{ spotName: 'C', position: { lng: 139.7, lat: 35.6 } }] };
    };

    const spots = await listReviewSpots();

    assert.equal(sentCommands.length, 2);
    assert.equal(spots[0].name, 'C');
  });

  it('再試行の対象外の例外は1回で諦め、DATA_SOURCE_ERROR に読み替える', async () => {
    sendImplementation = async () => {
      throw createAwsError('ValidationException');
    };

    await assert.rejects(listReviewSpots(), (error) => {
      assert.equal(error.code, ERROR_CODES.DATA_SOURCE_ERROR);
      assert.equal(error.context.errorName, 'ValidationException');
      return true;
    });
    assert.equal(sentCommands.length, 1);
  });
});
