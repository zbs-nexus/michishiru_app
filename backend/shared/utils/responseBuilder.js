/**
 * @description API Gatewayへ返すレスポンスを組み立てる。
 * ステータスコードの決定はHandler層が行い、ここでは形式のみを整える。
 */

/** すべての応答に付与するヘッダー */
const DEFAULT_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8'
};

/**
 * @description 成功応答を作る
 * @param {object} body 応答本体
 * @param {number} [statusCode] HTTPステータスコード
 * @returns {{statusCode: number, headers: object, body: string}} Lambdaの戻り値
 */
export const buildSuccessResponse = (body, statusCode = 200) => ({
  statusCode,
  headers: DEFAULT_HEADERS,
  body: JSON.stringify(body)
});

/**
 * @description エラー応答を作る
 * @param {number} statusCode HTTPステータスコード
 * @param {string} code エラーコード
 * @param {string} message 呼び出し元へ返すメッセージ
 * @returns {{statusCode: number, headers: object, body: string}} Lambdaの戻り値
 */
export const buildErrorResponse = (statusCode, code, message) => ({
  statusCode,
  headers: DEFAULT_HEADERS,
  body: JSON.stringify({ code, message })
});
