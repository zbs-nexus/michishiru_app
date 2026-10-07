import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import { getAuthenticatedUserId } from '../../shared/utils/requestContext.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { getSpot } from './service.js';
import { validateGetSpotRequest } from './validator.js';

/**
 * @description 指定座標に対応する既存の口コミ場所を返すLambdaハンドラ。
 * 地図の長押し時に、その場所が投稿済みか（名前・ジャンルを固定するか）を判定するために使う。
 * リクエストの受付とレスポンスの返却のみを担当し、業務判断はService層に委ねる。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const query = event?.queryStringParameters ?? {};

  const validationResult = validateGetSpotRequest(query);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  const userId = getAuthenticatedUserId(event);

  logInfo('場所解決リクエストを受け付けました', {
    position: validationResult.value.position,
    hasUser: userId !== null
  });

  try {
    const result = await getSpot({ ...validationResult.value, userId });

    return buildSuccessResponse(result);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('場所解決に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
