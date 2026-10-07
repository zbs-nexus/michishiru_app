import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import { getAuthenticatedUserId } from '../../shared/utils/requestContext.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { createReview } from './service.js';
import { validateCreateReviewRequest } from './validator.js';

/**
 * @description 口コミを投稿するLambdaハンドラ。
 * リクエストの受付とレスポンスの返却のみを担当し、業務判断はService層に委ねる。
 */

/**
 * @description イベントからリクエストボディを取り出す
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {object|null} 解析したボディ。解析できない場合はnull
 */
const parseRequestBody = (event) => {
  const body = event?.body ?? null;

  if (body === null) {
    return null;
  }

  if (typeof body !== 'string') {
    return body;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
};

/**
 * @description 口コミを投稿する
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const userId = getAuthenticatedUserId(event);

  if (userId === null) {
    return buildErrorResponse(
      401,
      ERROR_CODES.UNAUTHORIZED,
      '口コミの投稿にはログインが必要です'
    );
  }

  const body = parseRequestBody(event);

  if (body === null) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'リクエストボディをJSONとして解析できませんでした'
    );
  }

  const validationResult = validateCreateReviewRequest(body);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  logInfo('口コミ投稿リクエストを受け付けました', {
    position: validationResult.value.position,
    rating: validationResult.value.rating
  });

  try {
    const result = await createReview({ ...validationResult.value, userId });

    return buildSuccessResponse(result, 201);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('口コミ投稿に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
