/**
 * @description getUserExperience関数が使う定数。
 * 環境依存値は環境変数から取得し、ハードコードしない。
 * このファイルだけが process.env を読む。
 */

/** 散歩の実績（各散歩と累計）を格納するDynamoDBのテーブル名 */
export const WALK_RESULT_TABLE_NAME = process.env.WALK_RESULT_TABLE_NAME ?? '';

/** 口コミ（場所メタ＋口コミ）を格納するテーブル名 */
export const REVIEW_TABLE_NAME = process.env.REVIEW_TABLE_NAME ?? '';

/** ユーザーの口コミを引くためのGSI名（getUserReviewsと同じ索引を使う） */
export const GSI_USER_REVIEW = 'GSI-UserReview';

/** 利用者のパーティションキーの接頭辞 */
export const USER_KEY_PREFIX = 'USER#';

/** ユーザーの累計のソートキー */
export const TOTAL_SORT_KEY = 'TOTAL';

/**
 * 口コミ件数を数えるときに送るページの上限。
 * DynamoDBのQueryは1回の走査が1MBで切れるため、件数を数えるには
 * LastEvaluatedKey を辿る必要がある。応答が壊れていて鍵が返り続けた場合に
 * 無限ループへ落ちないよう、上限を置いて打ち切る。
 * 1ページあたり数千件を数えられるため、この上限に当たることは実質ない。
 */
export const MAX_REVIEW_COUNT_PAGE_COUNT = 10;
