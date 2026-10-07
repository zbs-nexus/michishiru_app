/**
 * @description getSpot関数が使う定数。
 * テーブル名などの環境依存値は環境変数から取得し、ハードコードしない。
 */

/** 口コミ（場所メタ＋口コミ）を格納するテーブル名 */
export const REVIEW_TABLE_NAME = process.env.REVIEW_TABLE_NAME ?? '';

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
