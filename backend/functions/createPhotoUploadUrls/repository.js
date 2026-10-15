import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createDataSourceError } from '../../shared/utils/errorHandler.js';
import { PHOTO_BUCKET_NAME, UPLOAD_URL_EXPIRES_S } from './constants.js';

/**
 * @description S3への写真アップロード用の署名付きURL発行を担当する。
 * ブラウザはこのURLへ直接PUTするため、キーをフロントに埋め込まずに済む。
 */

/** S3クライアントの生成は1度だけ行い、呼び出しごとに作らない */
let s3Client = null;

/**
 * @description S3クライアントを取得する
 * @returns {S3Client} 生成済みのクライアント
 */
const getS3Client = () => {
  if (s3Client === null) {
    s3Client = new S3Client({});
  }

  return s3Client;
};

/**
 * @description 指定キーへのPUT用の署名付きURLを発行する。
 * ContentTypeは署名に含めず、ブラウザがPUT時に付けるヘッダをそのまま保存させる。
 * @param {string} key 保存先のオブジェクトキー
 * @returns {Promise<string>} 署名付きのアップロードURL
 * @throws {ApplicationError} URLの発行に失敗した場合
 */
export const createUploadUrl = async (key) => {
  try {
    return await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({ Bucket: PHOTO_BUCKET_NAME, Key: key }),
      { expiresIn: UPLOAD_URL_EXPIRES_S }
    );
  } catch (error) {
    throw createDataSourceError('写真アップロードURLの発行に失敗しました', {
      errorName: error.name
    });
  }
};
