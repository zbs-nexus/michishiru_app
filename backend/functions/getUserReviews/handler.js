import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import { getAuthenticatedUserId } from '../../shared/utils/requestContext.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { getUserReviews } from './service.js';

/**
 * @description 呼び出し元ユーザーの口コミ一覧（場所つき）を返すLambdaハンドラ。
 * 地図に自分の口コミをオレンジのピンで表示するために使う。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const userId = getAuthenticatedUserId(event);

  if (userId === null) {
    return buildErrorResponse(
      401,
      ERROR_CODES.UNAUTHORIZED,
      '口コミ一覧の取得にはログインが必要です'
    );
  }

  logInfo('自分の口コミ一覧の取得リクエストを受け付けました', {});

  try {
    const result = await getUserReviews({ userId });

    return buildSuccessResponse(result);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('自分の口コミ一覧の取得に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
