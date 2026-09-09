/**
 * @description ルート作成条件に関する定数を定義する。
 * 目的・ジャンル・距離の選択肢はDB（検索条件マスタAPI）から取得するため、
 * ここでは取得結果に依存しない値のみを持つ。
 */

/**
 * 距離の初期値（km）。
 * マスタに既定値が無く、選択中の値が取得した範囲外だった場合のフォールバックにも使う。
 */
export const DEFAULT_DISTANCE_KM = 3;

/** ローディング表示の最短時間（ミリ秒）。表示のちらつきを防ぐ */
export const MIN_LOADING_DURATION_MS = 800;

/**
 * ルート作成の出発地として送る暫定の現在地（東京駅周辺）。
 * TODO: Geolocation APIでの現在地取得に置き換える（課題番号は未採番）。
 * 取得に失敗した場合のフォールバックとしては、置き換え後もこの値を使う。
 */
export const DEFAULT_CURRENT_LOCATION = {
  lng: 139.702973,
  lat: 35.686338
};
