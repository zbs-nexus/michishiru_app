import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { getConditions } from './service.js';

/**
 * @description 検索条件マスタ（目的・ジャンル・距離）の全項目を返すLambdaハンドラ。
 * 入力パラメータを取らないため、リクエストの受付とレスポンスの返却のみを担当する。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async () => {
  logInfo('検索条件マスタ取得リクエストを受け付けました');

  try {
    const conditions = await getConditions();

    return buildSuccessResponse(conditions);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('検索条件マスタの取得に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
