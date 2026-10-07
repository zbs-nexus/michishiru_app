/**
 * @description createWalkResult関数が使う定数。
 * 環境依存値は環境変数から取得し、ハードコードしない。
 * このファイルだけが process.env を読む。
 */

/** 散歩の実績を格納するDynamoDBのテーブル名 */
export const WALK_RESULT_TABLE_NAME = process.env.WALK_RESULT_TABLE_NAME ?? '';

/**
 * ルートタイトルの最大文字数。
 * AIが生成した見出しをそのまま控えるだけなので、
 * 長すぎる場合はエラーにせず切り詰める（長さで実績の保存を落とさない）。
 */
export const ROUTE_TITLE_MAX_LENGTH = 120;

/** ジャンルIDの最大文字数（`nature` のような短い英語IDしか来ない） */
export const GENRE_ID_MAX_LENGTH = 32;

/**
 * 1回の散歩として受け付ける距離の上限（メートル）。
 * 200km は徒歩の散歩としてあり得ない値であり、
 * 誤った巨大値が累計（cumulativeDistanceM）へ入るのを防ぐために弾く。
 */
export const MAX_TOTAL_DISTANCE_M = 200000;

/**
 * 1回の散歩として受け付けるスポット数の上限。
 * 生成されるルートは2〜5スポットのため、50は十分な余裕がある。
 */
export const MAX_SPOT_COUNT = 50;

/**
 * 1回の散歩として受け付ける経過時間の上限（分）。
 * 24時間を超える散歩は、案内画面を閉じ忘れた等の異常値とみなす。
 */
export const MAX_ELAPSED_MINUTES = 1440;

/**
 * 受け付ける計測状態の3値。
 * フロントの `frontend/src/stores/walkStore.js` の MEASUREMENT_STATUS と同じ値であり、
 * 片方だけを増やすと保存が落ちるため、変更時は両方を揃える。
 */
export const MEASUREMENT_STATUSES = ['complete', 'partial', 'unavailable'];
