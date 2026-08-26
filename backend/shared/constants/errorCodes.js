/**
 * @description アプリケーション全体で使うエラーコード。
 * 外部サービス固有のエラーは、この一覧のいずれかに変換して上位へ渡す。
 */
export const ERROR_CODES = {
  /** 入力値が不正 */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** 条件に合うデータが存在しない */
  ROUTE_NOT_FOUND: 'ROUTE_NOT_FOUND',
  /** データストアへのアクセスに失敗 */
  DATA_SOURCE_ERROR: 'DATA_SOURCE_ERROR',
  /** 想定外の失敗 */
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/** エラーコードとHTTPステータスコードの対応 */
export const ERROR_STATUS_CODES = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.ROUTE_NOT_FOUND]: 404,
  [ERROR_CODES.DATA_SOURCE_ERROR]: 503,
  [ERROR_CODES.INTERNAL_ERROR]: 500
};
