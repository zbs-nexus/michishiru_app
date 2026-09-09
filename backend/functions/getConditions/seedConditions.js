/**
 * @description DynamoDBのテーブルが未設定の場合に使うローカル開発用の検索条件マスタ。
 * 本番では使用しない。テーブル投入用の初期データとしても利用できる。
 * 項目の形は本番の michimaster テーブルに合わせる
 * （pk で種別を判別し、isActive / sortOrder で表示を制御する）。
 */
export const SEED_CONDITIONS = [
  // 目的（purpose）
  {
    pk: 'PURPOSE#ALL',
    purposeId: 'refresh',
    purposeName: '気分転換',
    iconEmoji: '🍃',
    sortOrder: 1,
    isActive: true
  },
  {
    pk: 'PURPOSE#ALL',
    purposeId: 'exercise',
    purposeName: '運動',
    iconEmoji: '🏃',
    sortOrder: 2,
    isActive: true
  },
  {
    pk: 'PURPOSE#ALL',
    purposeId: 'sightseeing',
    purposeName: '観光',
    iconEmoji: '📷',
    sortOrder: 3,
    isActive: true
  },
  {
    pk: 'PURPOSE#ALL',
    purposeId: 'cafe',
    purposeName: 'カフェ',
    iconEmoji: '☕',
    sortOrder: 4,
    isActive: true
  },
  // ジャンル（genre）
  {
    pk: 'GENRE#ALL',
    genreId: 'nature',
    genreName: '自然',
    iconEmoji: '🌳',
    sortOrder: 1,
    isActive: true
  },
  {
    pk: 'GENRE#ALL',
    genreId: 'city',
    genreName: '街歩き',
    iconEmoji: '🏙️',
    sortOrder: 2,
    isActive: true
  },
  {
    pk: 'GENRE#ALL',
    genreId: 'history',
    genreName: '歴史',
    iconEmoji: '⛩️',
    sortOrder: 3,
    isActive: true
  },
  {
    pk: 'GENRE#ALL',
    genreId: 'gourmet',
    genreName: 'グルメ',
    iconEmoji: '🍴',
    sortOrder: 4,
    isActive: true
  },
  // 距離（distance）。先頭を下限、末尾を上限として扱う
  {
    pk: 'DISTANCE#ALL',
    distanceKm: 1,
    displayLabel: '1km',
    sortOrder: 1,
    isActive: true,
    isDefault: false
  },
  {
    pk: 'DISTANCE#ALL',
    distanceKm: 10,
    displayLabel: '10km',
    sortOrder: 2,
    isActive: true,
    isDefault: false
  }
];
