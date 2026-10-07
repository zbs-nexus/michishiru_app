/**
 * @description API Gatewayのイベントから呼び出し元の情報を取り出すユーティリティ。
 * 認証はAPI GatewayのCognitoオーソライザーが行い、Lambdaには検証済みのクレームが届く。
 * ここではそのクレームから値を取り出すだけで、検証はしない。
 */

/**
 * @description 認証済みユーザーのID（Cognitoの sub）を取り出す。
 * オーソライザーが付いていない・未認証の場合はnullを返す。
 * @param {object} event API Gatewayから渡されるイベント
 * @returns {string|null} ユーザーID（sub）。取得できない場合はnull
 */
export const getAuthenticatedUserId = (event) => {
  const claims = event?.requestContext?.authorizer?.claims ?? null;
  const sub = claims?.sub ?? null;

  return typeof sub === 'string' && sub !== '' ? sub : null;
};
