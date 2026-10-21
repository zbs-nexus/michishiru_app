import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * @description 実績の読み取りで送るコマンドの形を固定するテスト。
 *
 * キーの組み立て（`USER#<sub>` / `TOTAL`）と索引名・COUNTの指定を間違えても、
 * 例外にはならず「実績0」として静かに返るため画面からは気付けない。
 * 件数のページ送りも、口コミが増えて1MBを超えるまで現れない。
 * どちらもここで押さえておく。
 *
 * AWSへは接続しない。`DynamoDBDocumentClient.from` を差し替え、
 * 送られたコマンドを記録するだけのクライアントを返す。
 */

/** テーブル名は constants.js が読み込み時に1度だけ読むため、import より先に設定する */
process.env.WALK_RESULT_TABLE_NAME = 'WalkResult-test';
process.env.REVIEW_TABLE_NAME = 'Review-test';
// リージョンの解決はクライアントの生成時に行われるため、未設定の環境でも通るよう与える
process.env.AWS_REGION = process.env.AWS_REGION ?? 'ap-northeast-1';

/** 送られたコマンドの記録 */
let sentCommands = [];

/** send の振る舞い。テストごとに差し替える */
let sendImplementation = async () => ({});

// repository は最初の呼び出しでクライアントを1度だけ生成して使い回すため、
// 差し替えは「毎回同じ器を返し、中の振る舞いだけを入れ替える」形にする
mock.method(DynamoDBDocumentClient, 'from', () => ({
  send: async (command) => {
    sentCommands.push(command);

    return sendImplementation(command);
  }
}));

const { getReviewCountByUserId, getWalkTotalsByUserId } = await import(
  '../repository.js'
);

/**
 * @description 指定した名前の例外を作る
 * @param {string} name 例外の名前
 * @returns {Error} 生成した例外
 */
const createAwsError = (name) => Object.assign(new Error(name), { name });

beforeEach(() => {
  sentCommands = [];
  sendImplementation = async () => ({});
});

describe('getWalkTotalsByUserId', () => {
  it('累計アイテムを pk / sk で1件だけ取得する', async () => {
    sendImplementation = async () => ({
      Item: { cumulativeDistanceM: 12500, cumulativeMinutes: 210 }
    });

    const totals = await getWalkTotalsByUserId('cognito-sub-0001');

    assert.deepEqual(totals, {
      cumulativeDistanceM: 12500,
      cumulativeMinutes: 210
    });
    assert.equal(sentCommands.length, 1);
    assert.equal(sentCommands[0].input.TableName, 'WalkResult-test');
    assert.deepEqual(sentCommands[0].input.Key, {
      pk: 'USER#cognito-sub-0001',
      sk: 'TOTAL'
    });
  });

  it('累計アイテムが無ければnullを返す', async () => {
    sendImplementation = async () => ({});

    assert.equal(await getWalkTotalsByUserId('cognito-sub-0001'), null);
  });

  it('累計の属性が欠けている場合は0として扱う', async () => {
    sendImplementation = async () => ({ Item: { walkCount: 1 } });

    assert.deepEqual(await getWalkTotalsByUserId('cognito-sub-0001'), {
      cumulativeDistanceM: 0,
      cumulativeMinutes: 0
    });
  });

  it('スロットリングは再試行し、通ったら結果を返す', async () => {
    let attemptCount = 0;

    sendImplementation = async () => {
      attemptCount += 1;

      if (attemptCount === 1) {
        throw createAwsError('ThrottlingException');
      }

      return { Item: { cumulativeDistanceM: 100, cumulativeMinutes: 2 } };
    };

    const totals = await getWalkTotalsByUserId('cognito-sub-0001');

    assert.deepEqual(totals, { cumulativeDistanceM: 100, cumulativeMinutes: 2 });
    assert.equal(sentCommands.length, 2);
  });

  it('その他の例外はデータソースのエラーにする', async () => {
    sendImplementation = async () => {
      throw createAwsError('ResourceNotFoundException');
    };

    await assert.rejects(getWalkTotalsByUserId('cognito-sub-0001'), {
      name: 'ApplicationError',
      code: 'DATA_SOURCE_ERROR'
    });
  });
});

describe('getReviewCountByUserId', () => {
  it('GSI-UserReview を Select COUNT で引く', async () => {
    sendImplementation = async () => ({ Count: 4 });

    const reviewCount = await getReviewCountByUserId('cognito-sub-0001');

    assert.equal(reviewCount, 4);
    assert.equal(sentCommands.length, 1);

    const { TableName, IndexName, Select, ExpressionAttributeValues } =
      sentCommands[0].input;

    assert.equal(TableName, 'Review-test');
    assert.equal(IndexName, 'GSI-UserReview');
    // 項目の本体を読まないため転送量が小さい。ここが外れると全項目を受け取ってしまう
    assert.equal(Select, 'COUNT');
    assert.deepEqual(ExpressionAttributeValues, {
      ':userId': 'cognito-sub-0001'
    });
  });

  it('LastEvaluatedKey があるとページを送って件数を合算する', async () => {
    let pageCount = 0;

    sendImplementation = async () => {
      pageCount += 1;

      if (pageCount === 1) {
        return { Count: 3, LastEvaluatedKey: { spotId: 's-3', sk: 'REVIEW#u' } };
      }

      return { Count: 2 };
    };

    const reviewCount = await getReviewCountByUserId('cognito-sub-0001');

    assert.equal(reviewCount, 5);
    assert.equal(sentCommands.length, 2);
    assert.equal(sentCommands[0].input.ExclusiveStartKey, undefined);
    assert.deepEqual(sentCommands[1].input.ExclusiveStartKey, {
      spotId: 's-3',
      sk: 'REVIEW#u'
    });
  });

  it('鍵が返り続けてもページ数の上限で打ち切る', async () => {
    sendImplementation = async () => ({
      Count: 1,
      LastEvaluatedKey: { spotId: 's-1', sk: 'REVIEW#u' }
    });

    const reviewCount = await getReviewCountByUserId('cognito-sub-0001');

    // MAX_REVIEW_COUNT_PAGE_COUNT（10）で止まる
    assert.equal(sentCommands.length, 10);
    assert.equal(reviewCount, 10);
  });

  it('その他の例外はデータソースのエラーにする', async () => {
    sendImplementation = async () => {
      throw createAwsError('ValidationException');
    };

    await assert.rejects(getReviewCountByUserId('cognito-sub-0001'), {
      name: 'ApplicationError',
      code: 'DATA_SOURCE_ERROR'
    });
  });
});
