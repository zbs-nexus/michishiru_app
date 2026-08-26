/**
 * @description ルート作成条件の選択肢を定義する。
 * 表示ラベルは日本語、値は用語辞書に沿った英語とする。
 */

/** 目的の選択肢 */
export const PURPOSE_OPTIONS = [
  { value: 'refresh', label: '気分転換', icon: '😊' },
  { value: 'exercise', label: '運動', icon: '👟' },
  { value: 'sightseeing', label: '観光', icon: '📷' },
  { value: 'cafe', label: 'カフェ巡り', icon: '☕' }
];

/** カテゴリの選択肢 */
export const CATEGORY_OPTIONS = [
  { value: 'nature', label: '自然', icon: '🍃' },
  { value: 'city', label: '街歩き', icon: '🏛️' },
  { value: 'history', label: '歴史', icon: '⛩️' },
  { value: 'gourmet', label: 'グルメ', icon: '🍴' }
];

/** 選択できる距離（km）。スライダーのつまみ位置と対応する */
export const DISTANCE_OPTIONS_KM = [1, 3, 5, 8];

/** 距離の初期値（km） */
export const DEFAULT_DISTANCE_KM = 3;

/** ローディング表示の最短時間（ミリ秒）。表示のちらつきを防ぐ */
export const MIN_LOADING_DURATION_MS = 800;
