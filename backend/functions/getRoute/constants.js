/**
 * @description getRoute関数が使う定数。
 * テーブル名などの環境依存値は環境変数から取得し、ハードコードしない。
 */

/** ルートを格納するテーブル名 */
export const ROUTE_TABLE_NAME = process.env.ROUTE_TABLE_NAME ?? '';

/** カテゴリと距離で検索するためのGSI名 */
export const GSI_CATEGORY_DISTANCE = 'GSI-CategoryDistance';

/** 徒歩1kmあたりの所要時間（分） */
export const WALKING_MINUTES_PER_KM = 15;

/** 1回のクエリで取得する最大件数 */
export const DEFAULT_QUERY_LIMIT = 20;

/** 選択できる目的 */
export const ALLOWED_PURPOSES = ['refresh', 'exercise', 'sightseeing', 'cafe'];

/** 選択できるカテゴリ */
export const ALLOWED_CATEGORIES = ['nature', 'city', 'history', 'gourmet'];

/** 選択できる距離（km） */
export const ALLOWED_DISTANCES_KM = [1, 3, 5, 8];
