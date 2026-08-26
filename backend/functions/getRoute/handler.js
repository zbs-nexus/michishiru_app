import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { getRoute } from './service.js';
import { validateGetRouteRequest } from './validator.js';

/**
 * @description 条件に合う散歩ルートを1件返すLambdaハンドラ。
 * リクエストの受付とレスポンスの返却のみを担当し、業務判断はService層に委ねる。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const query = event?.queryStringParameters ?? {};

  logInfo('ルート取得リクエストを受け付けました', { query });

  const validationResult = validateGetRouteRequest(query);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  try {
    const route = await getRoute(validationResult.value);

    return buildSuccessResponse(route);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('ルート取得に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
