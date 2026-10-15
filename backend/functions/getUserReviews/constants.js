/**
 * @description getUserReviews関数が使う定数。
 * 環境依存値は環境変数から取得し、ハードコードしない。
 */

/** 口コミ（場所メタ＋口コミ）を格納するテーブル名 */
export const REVIEW_TABLE_NAME = process.env.REVIEW_TABLE_NAME ?? '';

/** ユーザーの口コミを引くためのGSI名 */
export const GSI_USER_REVIEW = 'GSI-UserReview';

/** 場所メタ行のソートキー */
export const SPOT_SORT_KEY = 'SPOT';

/** 1回に返す口コミの最大件数 */
export const DEFAULT_QUERY_LIMIT = 100;
