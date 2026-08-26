import { ERROR_CODES, ERROR_STATUS_CODES } from '../constants/errorCodes.js';

/**
 * @description アプリケーション固有のエラー。
 * 外部サービスの例外は、このクラスに変換してから上位層へ渡す。
 */
export class ApplicationError extends Error {
  /**
   * @param {string} code エラーコード
   * @param {string} message 呼び出し元へ返すメッセージ
   * @param {object} [context] 調査用の付随情報
   */
  constructor(code, message, context = {}) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.statusCode = ERROR_STATUS_CODES[code] ?? ERROR_STATUS_CODES[ERROR_CODES.INTERNAL_ERROR];
    this.context = context;
  }
}

/**
 * @description 入力値が不正な場合のエラーを作る
 * @param {string} message 呼び出し元へ返すメッセージ
 * @param {object} [context] 調査用の付随情報
 * @returns {ApplicationError} 生成したエラー
 */
export const createValidationError = (message, context) =>
  new ApplicationError(ERROR_CODES.VALIDATION_ERROR, message, context);

/**
 * @description 該当データが無い場合のエラーを作る
 * @param {string} message 呼び出し元へ返すメッセージ
 * @param {object} [context] 調査用の付随情報
 * @returns {ApplicationError} 生成したエラー
 */
export const createNotFoundError = (message, context) =>
  new ApplicationError(ERROR_CODES.ROUTE_NOT_FOUND, message, context);

/**
 * @description データストアへのアクセスに失敗した場合のエラーを作る
 * @param {string} message 呼び出し元へ返すメッセージ
 * @param {object} [context] 調査用の付随情報
 * @returns {ApplicationError} 生成したエラー
 */
export const createDataSourceError = (message, context) =>
  new ApplicationError(ERROR_CODES.DATA_SOURCE_ERROR, message, context);

/**
 * @description 任意の例外を、応答に使える形へ整える
 * @param {Error} error 発生した例外
 * @returns {{statusCode: number, code: string, message: string}} 応答に使う情報
 */
export const resolveErrorResponse = (error) => {
  if (error instanceof ApplicationError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message
    };
  }

  return {
    statusCode: ERROR_STATUS_CODES[ERROR_CODES.INTERNAL_ERROR],
    code: ERROR_CODES.INTERNAL_ERROR,
    message: '想定外のエラーが発生しました'
  };
};
