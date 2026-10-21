import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import { getAuthenticatedUserId } from '../../shared/utils/requestContext.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { getUserExperience } from './service.js';

/**
 * @description 呼び出し元ユーザーの実績（累計距離・累計時間・口コミ件数）を返すLambdaハンドラ。
 * マスコットの経験値とレベルを求めるためにフロントが使う。
 * 利用者はオーソライザーが検証したクレーム（sub）だけで決め、
 * リクエストからは何も読まない（他人の実績を引けないようにする）。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const userId = getAuthenticatedUserId(event);

  if (userId === null) {
    return buildErrorResponse(
      401,
      ERROR_CODES.UNAUTHORIZED,
      '実績の取得にはログインが必要です'
    );
  }

  logInfo('実績の取得リクエストを受け付けました', {});

  try {
    const result = await getUserExperience({ userId });

    return buildSuccessResponse(result);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('実績の取得に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
