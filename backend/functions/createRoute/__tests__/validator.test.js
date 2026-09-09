import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateCreateRouteRequest } from '../validator.js';

/** 検証を通る最小のリクエスト */
const validBody = {
  purposeCategory: 'coffee_shop',
  targetDistanceKm: 3,
  currentLocation: { lat: 35.6862, lng: 139.7036 }
};

describe('validateCreateRouteRequest', () => {
  it('必要な項目が揃っていれば正規化した値を返す', () => {
    const result = validateCreateRouteRequest(validBody);

    assert.equal(result.isValid, true);
    assert.deepEqual(result.value, {
      spotCategory: 'coffee_shop',
      targetDistanceKm: 3,
      currentLocation: { lat: 35.6862, lng: 139.7036 }
    });
  });

  it('カテゴリと距離が未指定なら既定値を補う', () => {
    const result = validateCreateRouteRequest({ currentLocation: validBody.currentLocation });

    assert.equal(result.isValid, true);
    assert.equal(result.value.spotCategory, 'coffee_shop');
    assert.equal(result.value.targetDistanceKm, 3);
  });

  it('現在地が無い場合は不正とする', () => {
    const result = validateCreateRouteRequest({ purposeCategory: 'park' });

    assert.equal(result.isValid, false);
    assert.equal(result.value, null);
    assert.match(result.errorMessages.join(' '), /currentLocation/);
  });

  it('緯度・経度が範囲外の場合は不正とする', () => {
    const result = validateCreateRouteRequest({
      ...validBody,
      currentLocation: { lat: 100, lng: 200 }
    });

    assert.equal(result.isValid, false);
    assert.match(result.errorMessages.join(' '), /lat/);
    assert.match(result.errorMessages.join(' '), /lng/);
  });

  it('目標距離が範囲外の場合は不正とする', () => {
    const result = validateCreateRouteRequest({ ...validBody, targetDistanceKm: 50 });

    assert.equal(result.isValid, false);
    assert.match(result.errorMessages.join(' '), /targetDistanceKm/);
  });

  it('文字列で渡された目標距離は数値へ変換する', () => {
    const result = validateCreateRouteRequest({ ...validBody, targetDistanceKm: '5' });

    assert.equal(result.isValid, true);
    assert.equal(result.value.targetDistanceKm, 5);
  });
});
