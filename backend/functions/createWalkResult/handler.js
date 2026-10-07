import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { createWalkResult } from './service.js';
import { validateCreateWalkResultRequest } from './validator.js';

/**
 * @description 散歩の実績を保存するLambdaハンドラ。
 * リクエストの受付とレスポンスの返却のみを担当し、業務判断はService層に委ねる。
 *
 * 利用者はAPI Gatewayのオーソライザーが検証した `claims.sub` からのみ決める。
 * リクエストボディの `userId` は読まない（読むと他人の実績として保存できてしまう）。
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
 * @description 散歩の実績を保存して結果を返す
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  // 利用者の識別はここだけで行う。ボディの userId は参照しない
  const userId = event?.requestContext?.authorizer?.claims?.sub ?? null;

  if (userId === null) {
    return buildErrorResponse(
      401,
      ERROR_CODES.UNAUTHORIZED,
      '利用者を特定できませんでした'
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

  const validationResult = validateCreateWalkResultRequest(body);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  // userId は個人を辿れる値のためログへ残さない
  logInfo('散歩の実績の保存リクエストを受け付けました', {
    walkId: validationResult.value.walkId,
    measurementStatus: validationResult.value.measurementStatus
  });

  try {
    const { walkId, isAlreadySaved } = await createWalkResult({
      ...validationResult.value,
      userId
    });

    return buildSuccessResponse({ walkId, isAlreadySaved });
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('散歩の実績の保存に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
