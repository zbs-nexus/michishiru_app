import { createServer } from 'node:http';
import { handler as createPhotoUploadUrlsHandler } from '../backend/functions/createPhotoUploadUrls/handler.js';
import { handler as createRouteHandler } from '../backend/functions/createRoute/handler.js';
import { handler as createReviewHandler } from '../backend/functions/createReview/handler.js';
import { handler as createWalkResultHandler } from '../backend/functions/createWalkResult/handler.js';
import { handler as getConditionsHandler } from '../backend/functions/getConditions/handler.js';
import { handler as getRouteHandler } from '../backend/functions/getRoute/handler.js';
import { handler as getSpotHandler } from '../backend/functions/getSpot/handler.js';
import { handler as getUserReviewsHandler } from '../backend/functions/getUserReviews/handler.js';
import { handler as verifyPasswordResetTargetHandler } from '../backend/functions/verifyPasswordResetTarget/handler.js';

/**
 * @description ローカル開発用のAPIハーネス。
 * Lambdaハンドラをそのまま呼び出すため、ビジネスロジックを二重に持たない。
 * 本番ではAPI Gateway + Lambdaが担うため、このファイルはデプロイ対象外とする。
 */

/** 待ち受けポート */
const PORT = Number(process.env.LOCAL_API_PORT ?? 3001);

/** ループバックのみで待ち受ける（外部公開はViteのプロキシ経由に限定する） */
const HOST = '127.0.0.1';

/**
 * ローカル開発で認可済みとみなすユーザーの識別子（CognitoのsubにあたるID）。
 * 本番のデータと見分けが付くよう、実在しそうなUUID形式にはしない。
 */
const LOCAL_DEV_USER_SUB = 'local-dev-user';

/** ローカル開発で認可済みとみなすユーザー名 */
const LOCAL_DEV_USERNAME = 'local-dev';

/**
 * パスとLambdaハンドラの対応。
 * createRoute は Location Service と Bedrock を実際に呼び出すため、
 * ローカルで叩くにはAWSの認証情報（`AWS_PROFILE` 等）が必要になる。
 * verifyPasswordResetTarget も Cognito を呼ぶため、認証情報と
 * 環境変数 `USER_POOL_ID` が必要になる。
 * createWalkResult は DynamoDB へ書き込むため、ローカルで実際に保存するには
 * 認証情報と環境変数 `WALK_RESULT_TABLE_NAME`（例: `WalkResult-dev`）が必要になる。
 * 未設定の場合は 503（DATA_SOURCE_ERROR）を返し、フロントは退避キューへ積む。
 */
const ROUTE_HANDLERS = [
  { method: 'GET', path: '/api/v1/routes', invoke: getRouteHandler },
  { method: 'POST', path: '/api/v1/routes', invoke: createRouteHandler },
  { method: 'GET', path: '/api/v1/conditions', invoke: getConditionsHandler },
  // 口コミ系はDynamoDBへアクセスするため、ローカルで叩くにはAWSの認証情報と
  // 環境変数 REVIEW_TABLE_NAME が必要になる。
  { method: 'GET', path: '/api/v1/spots', invoke: getSpotHandler },
  { method: 'GET', path: '/api/v1/my-reviews', invoke: getUserReviewsHandler },
  { method: 'POST', path: '/api/v1/reviews', invoke: createReviewHandler },
  // 写真アップロードURL発行。ローカルで叩くにはAWSの認証情報と PHOTO_BUCKET_NAME が必要
  {
    method: 'POST',
    path: '/api/v1/review-photo-uploads',
    invoke: createPhotoUploadUrlsHandler
  },
  {
    method: 'POST',
    path: '/api/v1/walk-results',
    invoke: createWalkResultHandler
  },
  {
    method: 'POST',
    path: '/api/v1/password-reset-verifications',
    invoke: verifyPasswordResetTargetHandler
  }
];

/**
 * @description リクエストボディを文字列として読み切る
 * @param {import('node:http').IncomingMessage} request 受信したリクエスト
 * @returns {Promise<string|null>} ボディ。空の場合はnull
 */
const readRequestBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString('utf8');

  return body === '' ? null : body;
};

/**
 * @description Node.jsのリクエストからAPI Gateway相当のイベントを作る
 * @param {import('node:http').IncomingMessage} request 受信したリクエスト
 * @param {URL} requestUrl 解析済みのURL
 * @param {string|null} body 読み取り済みのリクエストボディ
 * @returns {object} ハンドラへ渡すイベント
 */
const buildEvent = (request, requestUrl, body) => ({
  httpMethod: request.method,
  path: requestUrl.pathname,
  queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
  headers: request.headers,
  body,
  // 本番ではAPI GatewayのCognitoオーソライザーが検証した結果をここへ入れる。
  // このハーネスは認可を模倣するだけで検証はしない（Authorizationヘッダーの中身は見ない）。
  // そうしてよい理由は、127.0.0.1でのみ待ち受けており、tools/配下でデプロイ対象外のため。
  // 本番の認可はAPI Gatewayが行う。
  // Lambdaが event.requestContext.authorizer.claims.sub を読むため、同じ形のイベントを渡す。
  requestContext: {
    authorizer: {
      claims: {
        sub: LOCAL_DEV_USER_SUB,
        'cognito:username': LOCAL_DEV_USERNAME
      }
    }
  }
});

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${HOST}:${PORT}`);

  const matched = ROUTE_HANDLERS.find(
    (route) => route.method === request.method && route.path === requestUrl.pathname
  );

  if (!matched) {
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({ code: 'NOT_FOUND', message: '該当するAPIがありません' })
    );
    return;
  }

  try {
    const body = await readRequestBody(request);
    const result = await matched.invoke(buildEvent(request, requestUrl, body));

    response.writeHead(result.statusCode, result.headers);
    response.end(result.body);
  } catch (error) {
    console.error('ハンドラの呼び出しに失敗しました', error);
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(
      JSON.stringify({ code: 'INTERNAL_ERROR', message: '想定外のエラーが発生しました' })
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log(`ローカルAPIハーネス起動: http://${HOST}:${PORT}`);
  for (const route of ROUTE_HANDLERS) {
    console.log(`  ${route.method} ${route.path}`);
  }
});
