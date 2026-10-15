/**
 * @description getSpot関数が使う定数。
 * テーブル名などの環境依存値は環境変数から取得し、ハードコードしない。
 */

/** 口コミ（場所メタ＋口コミ）を格納するテーブル名 */
export const REVIEW_TABLE_NAME = process.env.REVIEW_TABLE_NAME ?? '';

/** 口コミ写真を格納するS3バケット名 */
export const PHOTO_BUCKET_NAME = process.env.PHOTO_BUCKET_NAME ?? '';

/** 表示用の署名付きGET URLの有効期限（秒） */
export const PHOTO_VIEW_URL_EXPIRES_S = 3600;

/** 近接するスポットをセルで引くためのGSI名 */
export const GSI_GEO_CELL = 'GSI-GeoCell';

/** 場所メタ行のソートキー */
export const SPOT_SORT_KEY = 'SPOT';

/**
 * @description ユーザーの口コミ行のソートキーを組み立てる
 * @param {string} userId ユーザーID
 * @returns {string} ソートキー（例: "REVIEW#<userId>"）
 */
export const toReviewSortKey = (userId) => `REVIEW#${userId}`;
