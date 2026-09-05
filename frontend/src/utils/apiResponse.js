/**
 * @description APIレスポンスに対する共通の判定を行う。
 * Vueに依存しないため、サービス層から呼び出して使う。
 */

/**
 * @description レスポンスがJSONかどうかを判定する。
 * APIが未配線の環境ではSPAのindex.html（HTML）が200で返るため、
 * 解析前にこの判定で弾く。
 * @param {Response} response fetchのレスポンス
 * @returns {boolean} JSONの場合はtrue
 */
export const isJsonResponse = (response) =>
  (response.headers.get('content-type') ?? '').includes('application/json');
