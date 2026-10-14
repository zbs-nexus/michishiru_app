import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * @description 冪等性を支えている書き込みの形を固定するテスト。
 *
 * ここで確かめたいのは「送るコマンドの形」と「DynamoDBの例外の読み替え」である。
 * どちらも式やエラー名のタイプミスがデプロイして再送を起こすまで現れないため、
 * Service のテスト（累計へ足す／足さないの分岐）とは別に押さえておく。
 *
 * AWSへは接続しない。`DynamoDBDocumentClient.from` を差し替え、
 * 送られたコマンドを記録するだけのクライアントを返す。
 */

/** テーブル名は constants.js が読み込み時に1度だけ読むため、import より先に設定する */
process.env.WALK_RESULT_TABLE_NAME = 'WalkResult-test';
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

const { createWalkResultWithoutTotals, createWalkResultWithTotals } =
  await import('../repository.js');

/**
 * @description Service が渡してくる形の実績を作る
 * @param {object} [overrides] 上書きする項目
 * @returns {object} 保存する実績
 */
const buildWalkResult = (overrides = {}) => ({
  walkId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  userId: 'cognito-sub-0001',
  totalDistanceM: 2500,
  spotCount: 3,
  elapsedMinutes: 42,
  startedAt: '2026-10-07T01:00:00.000Z',
  endedAt: '2026-10-07T01:42:00.000Z',
  measurementStatus: 'complete',
  routeTitle: '川沿いの散歩',
  genreId: 'nature',
  createdAt: '2026-10-07T01:42:03.000Z',
  ...overrides
});

/**
 * @description 指定した名前の例外を作る
 * @param {string} name 例外の名前
 * @param {object} [extraProperties] 例外に持たせる追加の情報
 * @returns {Error} 生成した例外
 */
const createAwsError = (name, extraProperties = {}) =>
  Object.assign(new Error(name), { name }, extraProperties);

/**
 * @description 条件エラーでトランザクションが止まった場合の例外を作る
 * @returns {Error} 生成した例外
 */
const createConditionalTransactionError = () =>
  createAwsError('TransactionCanceledException', {
    CancellationReasons: [
      { Code: 'ConditionalCheckFailed' },
      { Code: 'None' }
    ]
  });

beforeEach(() => {
  sentCommands = [];
  sendImplementation = async () => ({});
});

describe('createWalkResultWithTotals', () => {
  it('実績のPutと累計のUpdateを1回のトランザクションで送る', async () => {
    const result = await createWalkResultWithTotals(buildWalkResult());

    assert.deepEqual(result, { isStored: true });
    assert.equal(sentCommands.length, 1);

    const { TransactItems } = sentCommands[0].input;

    assert.equal(TransactItems.length, 2);
    assert.equal(TransactItems[0].Put.TableName, 'WalkResult-test');
    assert.equal(TransactItems[1].Update.TableName, 'WalkResult-test');
  });

  it('実績のPutに同じwalkIdを弾く条件を付ける', async () => {
    await createWalkResultWithTotals(buildWalkResult());

    const [{ Put }] = sentCommands[0].input.TransactItems;

    // この条件が外れると、再送のたびに累計が二重に増える
    assert.equal(Put.ConditionExpression, 'attribute_not_exists(pk)');
    assert.equal(Put.Item.pk, 'USER#cognito-sub-0001');
    assert.equal(
      Put.Item.sk,
      'WALK#2026-10-07T01:42:00.000Z#3f2504e0-4f89-41d3-9a0c-0305e82c3301'
    );
    assert.equal(Put.Item.totalDistanceM, 2500);
    assert.equal(Put.Item.createdAt, '2026-10-07T01:42:03.000Z');
  });

  it('累計へは4つの属性をADDで加算し、同じ利用者のTOTALを指す', async () => {
    await createWalkResultWithTotals(buildWalkResult());

    const [, { Update }] = sentCommands[0].input.TransactItems;

    assert.deepEqual(Update.Key, {
      pk: 'USER#cognito-sub-0001',
      sk: 'TOTAL'
    });
    assert.equal(
      Update.UpdateExpression,
      'ADD walkCount :one, cumulativeDistanceM :distanceM, cumulativeSpotCount :spotCount, cumulativeMinutes :minutes SET updatedAt = :now'
    );
    assert.deepEqual(Update.ExpressionAttributeValues, {
      ':one': 1,
      ':distanceM': 2500,
      ':spotCount': 3,
      ':minutes': 42,
      ':now': '2026-10-07T01:42:03.000Z'
    });
  });

  it('同じwalkIdが既にある場合はisStoredをfalseにして例外を投げない', async () => {
    sendImplementation = async () => {
      throw createConditionalTransactionError();
    };

    const result = await createWalkResultWithTotals(buildWalkResult());

    assert.deepEqual(result, { isStored: false });
  });

  it('条件エラーは再試行しない', async () => {
    sendImplementation = async () => {
      throw createConditionalTransactionError();
    };

    await createWalkResultWithTotals(buildWalkResult());

    // 何度投げ直しても結果が変わらないため、1回で切り上げる
    assert.equal(sentCommands.length, 1);
  });

  it('条件エラー以外でトランザクションが止まった場合はデータソースのエラーにする', async () => {
    sendImplementation = async () => {
      throw createAwsError('TransactionCanceledException', {
        CancellationReasons: [{ Code: 'TransactionConflict' }]
      });
    };

    await assert.rejects(createWalkResultWithTotals(buildWalkResult()), {
      name: 'ApplicationError',
      code: 'DATA_SOURCE_ERROR'
    });
  });

  it('スロットリングは再試行し、通ったら保存できたとして返す', async () => {
    let attemptCount = 0;

    sendImplementation = async () => {
      attemptCount += 1;

      if (attemptCount === 1) {
        throw createAwsError('ThrottlingException');
      }

      return {};
    };

    const result = await createWalkResultWithTotals(buildWalkResult());

    assert.deepEqual(result, { isStored: true });
    assert.equal(sentCommands.length, 2);
  });
});

describe('createWalkResultWithoutTotals', () => {
  it('累計を触らず実績のPutだけを送る', async () => {
    const result = await createWalkResultWithoutTotals(
      buildWalkResult({ measurementStatus: 'unavailable' })
    );

    assert.deepEqual(result, { isStored: true });
    assert.equal(sentCommands.length, 1);

    const { Item, ConditionExpression, TableName } = sentCommands[0].input;

    assert.equal(TableName, 'WalkResult-test');
    assert.equal(ConditionExpression, 'attribute_not_exists(pk)');
    assert.equal(Item.measurementStatus, 'unavailable');
    // トランザクションではないため TransactItems は持たない
    assert.equal(sentCommands[0].input.TransactItems, undefined);
  });

  it('同じwalkIdが既にある場合はisStoredをfalseにして例外を投げない', async () => {
    sendImplementation = async () => {
      throw createAwsError('ConditionalCheckFailedException');
    };

    const result = await createWalkResultWithoutTotals(buildWalkResult());

    assert.deepEqual(result, { isStored: false });
  });

  it('その他の例外はデータソースのエラーにする', async () => {
    sendImplementation = async () => {
      throw createAwsError('ResourceNotFoundException');
    };

    await assert.rejects(createWalkResultWithoutTotals(buildWalkResult()), {
      name: 'ApplicationError',
      code: 'DATA_SOURCE_ERROR'
    });
  });
});
