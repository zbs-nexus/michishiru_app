/**
 * @description getConditions関数が使う定数。
 * テーブル名などの環境依存値は環境変数から取得し、ハードコードしない。
 */

/** 検索条件マスタ（目的・ジャンル・距離）を格納するテーブル名 */
export const CONDITION_TABLE_NAME = process.env.CONDITION_TABLE_NAME ?? '';
