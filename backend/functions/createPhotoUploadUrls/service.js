import { randomUUID } from 'node:crypto';
import * as photoRepository from './repository.js';
import { PHOTO_KEY_PREFIX } from './constants.js';

/**
 * @description 写真アップロード用URLの発行を担うビジネスロジック。
 * HTTPに依存せず、プレーンなオブジェクトを入出力する。
 */

/**
 * @description 要求された枚数ぶんの、重複しないキーとアップロードURLを発行する
 * @param {object} input 入力
 * @param {number} input.count 発行する枚数（1〜4）
 * @param {object} [repository] データアクセス（テスト用に差し替え可能）
 * @returns {Promise<{uploads: Array<{key: string, uploadUrl: string}>}>} 発行結果
 * @throws {ApplicationError} URLの発行に失敗した場合
 */
export const createPhotoUploadUrls = async (
  { count },
  repository = photoRepository
) => {
  const uploads = await Promise.all(
    Array.from({ length: count }, async () => {
      const key = `${PHOTO_KEY_PREFIX}${randomUUID()}`;
      const uploadUrl = await repository.createUploadUrl(key);
      return { key, uploadUrl };
    })
  );

  return { uploads };
};
