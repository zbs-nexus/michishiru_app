import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { validateCreatePhotoUploadUrlsRequest } from '../validator.js';

describe('validateCreatePhotoUploadUrlsRequest', () => {
  it('1〜4の整数を受理する', () => {
    for (const count of [1, 2, 3, 4]) {
      const result = validateCreatePhotoUploadUrlsRequest({ count });
      assert.equal(result.isValid, true);
      assert.equal(result.value.count, count);
    }
  });

  it('0・5・小数・非数値を拒否する', () => {
    for (const count of [0, 5, 2.5, 'x', undefined]) {
      const result = validateCreatePhotoUploadUrlsRequest({ count });
      assert.equal(result.isValid, false);
    }
  });
});
