import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateCreateReviewRequest } from '../validator.js';

/** 妥当なリクエストボディを作る */
const createBody = (overrides = {}) => ({
  position: { lng: 139.7, lat: 35.68 },
  rating: 4,
  spotName: '中央公園',
  genreId: 'nature',
  genreName: '自然',
  ...overrides
});

describe('validateCreateReviewRequest', () => {
  it('妥当なボディを受理し正規化する', () => {
    const result = validateCreateReviewRequest(createBody());

    assert.equal(result.isValid, true);
    assert.deepEqual(result.value.position, { lng: 139.7, lat: 35.68 });
    assert.equal(result.value.rating, 4);
    assert.equal(result.value.spotName, '中央公園');
    assert.equal(result.value.genreId, 'nature');
  });

  it('ロケーション名の前後の空白を除き、空文字はnullにする', () => {
    const result = validateCreateReviewRequest(createBody({ spotName: '  　' }));

    assert.equal(result.isValid, true);
    assert.equal(result.value.spotName, null);
  });

  it('名前・ジャンル未指定でも形式としては妥当（初回要否はService判定）', () => {
    const result = validateCreateReviewRequest(
      createBody({ spotName: undefined, genreId: undefined, genreName: undefined })
    );

    assert.equal(result.isValid, true);
    assert.equal(result.value.spotName, null);
    assert.equal(result.value.genreId, null);
  });

  it('評価が範囲外・整数でない場合は不正とする', () => {
    for (const rating of [0, 6, 3.5, 'x']) {
      const result = validateCreateReviewRequest(createBody({ rating }));
      assert.equal(result.isValid, false);
    }
  });

  it('座標が不正な場合は不正とする', () => {
    const result = validateCreateReviewRequest(
      createBody({ position: { lng: 999, lat: 35.68 } })
    );

    assert.equal(result.isValid, false);
  });

  it('ロケーション名が30文字を超える場合は不正とする', () => {
    const result = validateCreateReviewRequest(
      createBody({ spotName: 'あ'.repeat(31) })
    );

    assert.equal(result.isValid, false);
  });
});
