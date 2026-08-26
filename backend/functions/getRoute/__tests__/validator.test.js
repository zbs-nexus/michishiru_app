import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateGetRouteRequest } from '../validator.js';

describe('validateGetRouteRequest', () => {
  it('正しい条件を受け付け、distanceを数値へ正規化する', () => {
    const result = validateGetRouteRequest({
      purpose: 'refresh',
      category: 'nature',
      distance: '3'
    });

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errorMessages, []);
    assert.deepEqual(result.value, {
      purpose: 'refresh',
      category: 'nature',
      distance: 3
    });
  });

  it('必須項目が無い場合はすべてエラーとして返す', () => {
    const result = validateGetRouteRequest({});

    assert.equal(result.isValid, false);
    assert.equal(result.value, null);
    assert.equal(result.errorMessages.length, 3);
  });

  it('許可されていないpurposeを拒否する', () => {
    const result = validateGetRouteRequest({
      purpose: 'unknown',
      category: 'nature',
      distance: '3'
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errorMessages.some((message) => message.includes('purpose')));
  });

  it('許可されていないdistanceを拒否する', () => {
    const result = validateGetRouteRequest({
      purpose: 'refresh',
      category: 'nature',
      distance: '4'
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errorMessages.some((message) => message.includes('distance')));
  });

  it('数値に変換できないdistanceを拒否する', () => {
    const result = validateGetRouteRequest({
      purpose: 'refresh',
      category: 'nature',
      distance: 'abc'
    });

    assert.equal(result.isValid, false);
    assert.ok(result.errorMessages.some((message) => message.includes('数値')));
  });

  it('引数を渡さない場合も例外にならない', () => {
    const result = validateGetRouteRequest();

    assert.equal(result.isValid, false);
  });
});
