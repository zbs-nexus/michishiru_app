import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError } from '../../shared/utils/logger.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { verifyPasswordResetTarget } from './service.js';
import { validateVerifyRequest } from './validator.js';

/**
 * @description パスワード再設定の対象を照合するLambdaハンドラ。
 *
 * ブラウザからはユーザーの登録情報を参照できないため、
 * 確認コードを送る前の照合をこの関数が受け持つ。
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
 * @description ユーザー名とメールアドレスの組み合わせを照合して返す
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {Promise<{statusCode: number, headers: object, body: string}>} HTTPレスポンス
 */
export const handler = async (event) => {
  const body = parseRequestBody(event);

  if (body === null) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      'リクエストボディをJSONとして解析できませんでした'
    );
  }

  const validationResult = validateVerifyRequest(body);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  try {
    const { isMatched } = await verifyPasswordResetTarget(
      validationResult.value
    );

    // 一致しない場合もエラーではなく結果として返す。
    // 理由を返さないことで、ユーザーの有無や登録アドレスを推測させない
    return buildSuccessResponse({ isMatched });
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('組み合わせの照合に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
