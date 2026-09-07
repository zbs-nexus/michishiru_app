import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { generateRoute } from './service.js';
import { validateGenerateRouteRequest } from './validator.js';

/**
 * @description 条件から散歩ルートを生成して返すLambdaハンドラ。
 * リクエストの受付とレスポンスの返却のみを担当し、業務判断はService層に委ねる。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  let body = {};

  // API Gatewayはボディを文字列で渡すため、ここでオブジェクトへ戻す
  if (typeof event?.body === 'string' && event.body.length > 0) {
    try {
      body = JSON.parse(event.body);
    } catch {
      return buildErrorResponse(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'リクエストボディがJSONとして解釈できません'
      );
    }
  } else if (event?.body && typeof event.body === 'object') {
    body = event.body;
  }

  logInfo('ルート生成リクエストを受け付けました', { body });

  const validationResult = validateGenerateRouteRequest(body);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  try {
    const route = await generateRoute(validationResult.value);

    return buildSuccessResponse(route, 201);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('ルート生成に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
