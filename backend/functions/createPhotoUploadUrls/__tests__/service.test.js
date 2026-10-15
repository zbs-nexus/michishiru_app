import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPhotoUploadUrls } from '../service.js';

describe('createPhotoUploadUrls', () => {
  it('要求枚数ぶんのキーとURLを発行し、キーは重複しない', async () => {
    const repository = {
      createUploadUrl: async (key) => `https://example.com/${key}?signed`
    };

    const result = await createPhotoUploadUrls({ count: 3 }, repository);

    assert.equal(result.uploads.length, 3);

    const keys = result.uploads.map((upload) => upload.key);
    assert.equal(new Set(keys).size, 3);

    for (const upload of result.uploads) {
      assert.ok(upload.key.startsWith('review-photos/'));
      assert.ok(upload.uploadUrl.includes(upload.key));
    }
  });
});
