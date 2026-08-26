import { createServer } from 'node:http';
import { handler as getRouteHandler } from '../backend/functions/getRoute/handler.js';

/**
 * @description ローカル開発用のAPIハーネス。
 * Lambdaハンドラをそのまま呼び出すため、ビジネスロジックを二重に持たない。
 * 本番ではAPI Gateway + Lambdaが担うため、このファイルはデプロイ対象外とする。
 */

/** 待ち受けポート */
const PORT = Number(process.env.LOCAL_API_PORT ?? 3001);

/** ループバックのみで待ち受ける（外部公開はViteのプロキシ経由に限定する） */
const HOST = '127.0.0.1';

/** パスとLambdaハンドラの対応 */
const ROUTE_HANDLERS = [
  { method: 'GET', path: '/api/v1/routes', invoke: getRouteHandler }
];

/**
 * @description Node.jsのリクエストからAPI Gateway相当のイベントを作る
 * @param {import('node:http').IncomingMessage} request 受信したリクエスト
 * @param {URL} requestUrl 解析済みのURL
 * @returns {object} ハンドラへ渡すイベント
 */
const buildEvent = (request, requestUrl) => ({
  httpMethod: request.method,
  path: requestUrl.pathname,
  queryStringParameters: Object.fromEntries(requestUrl.searchParams.entries()),
  headers: request.headers
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
    const result = await matched.invoke(buildEvent(request, requestUrl));

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
  console.log(`ローカルAPIハーネス起動: http://${HOST}:${PORT}/api/v1/routes`);
});
