import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import { getAuthenticatedUserId } from '../../shared/utils/requestContext.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { getReviewSpots } from './service.js';

/**
 * @description 口コミが付いた場所の一覧を返すLambdaハンドラ。
 * 地図に他の人の口コミを紫のピンで表示するために使う。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const userId = getAuthenticatedUserId(event);

  if (userId === null) {
    return buildErrorResponse(
      401,
      ERROR_CODES.UNAUTHORIZED,
      '口コミの場所の一覧の取得にはログインが必要です'
    );
  }

  logInfo('口コミの場所の一覧の取得リクエストを受け付けました', {});

  try {
    const result = await getReviewSpots();

    // 0件とエラーを区別できるよう件数を残す。
    // ピンが出ないとき、データが無いのか取得に失敗したのかをログだけで判別する
    logInfo('口コミの場所の一覧を返します', { spotCount: result.spots.length });

    return buildSuccessResponse(result);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('口コミの場所の一覧の取得に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
