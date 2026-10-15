import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import { getAuthenticatedUserId } from '../../shared/utils/requestContext.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { createPhotoUploadUrls } from './service.js';
import { validateCreatePhotoUploadUrlsRequest } from './validator.js';

/**
 * @description 口コミ写真のアップロード用の署名付きURLを発行するLambdaハンドラ。
 * ブラウザはこのURLへ直接PUTする。リクエストの受付とレスポンスの返却のみを担当する。
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
 * @description 写真アップロード用の署名付きURLを発行する
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const userId = getAuthenticatedUserId(event);

  if (userId === null) {
    return buildErrorResponse(
      401,
      ERROR_CODES.UNAUTHORIZED,
      '写真のアップロードにはログインが必要です'
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

  const validationResult = validateCreatePhotoUploadUrlsRequest(body);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  logInfo('写真アップロードURLの発行リクエストを受け付けました', {
    count: validationResult.value.count
  });

  try {
    const result = await createPhotoUploadUrls(validationResult.value);

    return buildSuccessResponse(result);
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('写真アップロードURLの発行に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
