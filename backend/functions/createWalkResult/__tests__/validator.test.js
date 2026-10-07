import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_TOTAL_DISTANCE_M,
  ROUTE_TITLE_MAX_LENGTH
} from '../constants.js';
import { validateCreateWalkResultRequest } from '../validator.js';

/**
 * @description 正常なリクエストボディを作る
 * @param {object} [overrides] 上書きする項目
 * @returns {object} リクエストボディ
 */
const buildBody = (overrides = {}) => ({
  walkId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
  totalDistanceM: 2500.4,
  spotCount: 3,
  elapsedMinutes: 42,
  startedAt: '2026-10-07T01:00:00.000Z',
  endedAt: '2026-10-07T01:42:00.000Z',
  measurementStatus: 'complete',
  routeTitle: '川沿いの散歩',
  genreId: 'nature',
  ...overrides
});

describe('validateCreateWalkResultRequest', () => {
  it('必要な項目が揃っていれば正規化した値を返す', () => {
    const result = validateCreateWalkResultRequest(buildBody());

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errorMessages, []);
    // 距離は整数へ丸める
    assert.equal(result.value.totalDistanceM, 2500);
    assert.equal(result.value.walkId, '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
    assert.equal(result.value.measurementStatus, 'complete');
  });

  it('walkIdがUUID v4でない場合は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ walkId: 'walk-0001' })
    );

    assert.equal(result.isValid, false);
  });

  it('walkIdに区切り文字の#が含まれる場合は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ walkId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301#TOTAL' })
    );

    assert.equal(result.isValid, false);
  });

  it('負の距離は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ totalDistanceM: -1 })
    );

    assert.equal(result.isValid, false);
  });

  it('上限を超える距離は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ totalDistanceM: MAX_TOTAL_DISTANCE_M + 1 })
    );

    assert.equal(result.isValid, false);
  });

  it('spotCountが小数の場合は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ spotCount: 2.5 })
    );

    assert.equal(result.isValid, false);
  });

  it('measurementStatusが3値以外の場合は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ measurementStatus: 'unknown' })
    );

    assert.equal(result.isValid, false);
  });

  it('endedAtがISO 8601として解釈できない場合は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ endedAt: '昨日' })
    );

    assert.equal(result.isValid, false);
  });

  it('endedAtが非ISO形式の日付の場合は拒否する', () => {
    // Date.parse は通るが、ソートキーに入ると辞書順が崩れる
    const result = validateCreateWalkResultRequest(
      buildBody({ endedAt: '2026/10/07' })
    );

    assert.equal(result.isValid, false);
  });

  it('endedAtに区切り文字の#が含まれる場合は拒否する', () => {
    // 制御文字を挟むと Date.parse は通ってしまうため、書式で弾く
    const result = validateCreateWalkResultRequest(
      buildBody({ endedAt: '2026-10-07T01:42:00Z\u0000#TOTAL#x' })
    );

    assert.equal(result.isValid, false);
  });

  it('ミリ秒のないISO 8601の日時は受け付ける', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({
        startedAt: '2026-10-07T01:00:00Z',
        endedAt: '2026-10-07T01:42:00Z'
      })
    );

    assert.equal(result.isValid, true);
  });

  it('startedAtがオフセット付きの日時の場合は拒否する', () => {
    // フロントは常にUTC（toISOString）を送るため、オフセット付きは受け付けない
    const result = validateCreateWalkResultRequest(
      buildBody({ startedAt: '2026-10-07T10:00:00+09:00' })
    );

    assert.equal(result.isValid, false);
  });

  it('endedAtがstartedAtより前の場合は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ endedAt: '2026-10-07T00:30:00.000Z' })
    );

    assert.equal(result.isValid, false);
  });

  it('genreIdに半角英数字以外が含まれる場合は拒否する', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ genreId: '自然' })
    );

    assert.equal(result.isValid, false);
  });

  it('routeTitleが上限を超えてもエラーにせず切り詰める', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ routeTitle: 'あ'.repeat(ROUTE_TITLE_MAX_LENGTH + 20) })
    );

    assert.equal(result.isValid, true);
    assert.equal(result.value.routeTitle.length, ROUTE_TITLE_MAX_LENGTH);
  });

  it('routeTitleとgenreIdは未指定でもエラーにせず空文字にする', () => {
    const body = buildBody();
    delete body.routeTitle;
    delete body.genreId;

    const result = validateCreateWalkResultRequest(body);

    assert.equal(result.isValid, true);
    assert.equal(result.value.routeTitle, '');
    assert.equal(result.value.genreId, '');
  });

  it('ボディがnullでも例外にならない', () => {
    const result = validateCreateWalkResultRequest(null);

    assert.equal(result.isValid, false);
    assert.equal(result.errorMessages.length > 0, true);
  });

  it('ボディのuserIdは検証も採用もせず、valueに含めない', () => {
    const result = validateCreateWalkResultRequest(
      buildBody({ userId: 'other-user' })
    );

    assert.equal(result.isValid, true);
    assert.equal(Object.hasOwn(result.value, 'userId'), false);
  });
});
