/**
 * @description createPhotoUploadUrls関数が使う定数。
 * 環境依存値は環境変数から取得し、ハードコードしない。
 */

/** 口コミ写真を格納するS3バケット名 */
export const PHOTO_BUCKET_NAME = process.env.PHOTO_BUCKET_NAME ?? '';

/** 1回に発行できる写真アップロードURLの最大数（場所あたりの写真上限） */
export const MAX_PHOTO_COUNT = 4;

/** 署名付きURLの有効期限（秒） */
export const UPLOAD_URL_EXPIRES_S = 300;

/** 写真オブジェクトのキーの接頭辞。CloudFrontの配信経路（review-photos/*）と一致させる */
export const PHOTO_KEY_PREFIX = 'review-photos/';
