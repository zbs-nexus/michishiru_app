import { ERROR_CODES } from '../../shared/constants/errorCodes.js';
import { resolveErrorResponse } from '../../shared/utils/errorHandler.js';
import { logError, logInfo } from '../../shared/utils/logger.js';
import {
  buildErrorResponse,
  buildSuccessResponse
} from '../../shared/utils/responseBuilder.js';
import { createRoute } from './service.js';
import { validateCreateRouteRequest } from './validator.js';

/**
 * @description 条件に合う散歩ルートを生成して返すLambdaハンドラ。
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
 * @description Service層の結果を、フロントエンドへ返す形へ整える。
 *
 * キーがsnake_caseなのは既存の外部仕様に合わせているため。
 * TODO(NZ未採番): 規約どおり camelCase へ揃える（`naming-conventions.md` の
 * 「リクエスト/レスポンスのキーは camelCase」）。フロントの
 * `frontend/src/utils/routeResponse.js` と同時に変更する必要がある。
 * @param {object} route Service層が返したルート
 * @returns {object} レスポンス本体
 */
const toResponseBody = (route) => ({
  route_title: route.routeTitle,
  concept_story: route.conceptStory,
  summary: {
    total_distance_m: route.totalDistanceM,
    total_duration_s: route.totalDurationS
  },
  // 立ち寄り先。キー名は外部仕様のため waypoints のまま（中身は spot）
  waypoints: route.spots,
  geometry: {
    type: 'LineString',
    coordinates: route.coordinates
  }
});

/**
 * @description 散歩ルートを生成して返す
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

  const validationResult = validateCreateRouteRequest(body);

  if (!validationResult.isValid) {
    return buildErrorResponse(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      validationResult.errorMessages.join(' / ')
    );
  }

  logInfo('ルート作成リクエストを受け付けました', {
    genreName: validationResult.value.genreName,
    targetDistanceKm: validationResult.value.targetDistanceKm
  });

  try {
    const route = await createRoute(validationResult.value);

    return buildSuccessResponse(toResponseBody(route));
  } catch (error) {
    const { statusCode, code, message } = resolveErrorResponse(error);

    logError('ルート作成に失敗しました', {
      code,
      statusCode,
      errorMessage: error.message
    });

    return buildErrorResponse(statusCode, code, message);
  }
};
