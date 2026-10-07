/**
 * @description createReview関数が使う定数。
 * テーブル名などの環境依存値は環境変数から取得し、ハードコードしない。
 */

/** 口コミ（場所メタ＋口コミ）を格納するテーブル名 */
export const REVIEW_TABLE_NAME = process.env.REVIEW_TABLE_NAME ?? '';

/** 口コミ写真を格納するS3バケット名（本人編集で削除された写真の実体を消す） */
export const PHOTO_BUCKET_NAME = process.env.PHOTO_BUCKET_NAME ?? '';

/** 近接するスポットをセルで引くためのGSI名 */
export const GSI_GEO_CELL = 'GSI-GeoCell';

/** 場所メタ行のソートキー */
export const SPOT_SORT_KEY = 'SPOT';

/** 評価の最小値 */
export const MIN_RATING = 1;

/** 評価の最大値 */
export const MAX_RATING = 5;

/** ロケーション名の最大文字数 */
export const SPOT_NAME_MAX_LENGTH = 30;

/** 1つの場所に付けられる写真の最大枚数（初回投稿時のみ設定） */
export const PHOTO_MAX_COUNT = 4;

/**
 * @description ユーザーの口コミ行のソートキーを組み立てる
 * @param {string} userId ユーザーID
 * @returns {string} ソートキー（例: "REVIEW#<userId>"）
 */
export const toReviewSortKey = (userId) => `REVIEW#${userId}`;
