/**
 * @description ルートリソースのAPI通信を担当する。
 * レスポンスのデータ部分のみを返し、失敗時は例外を投げる。
 * 例外の捕捉はcomposableが行う。
 */

/** APIのベースパス */
const API_BASE_PATH = '/api/v1';

/**
 * @description エラーレスポンスからメッセージを取り出す
 * @param {Response} response fetchのレスポンス
 * @returns {Promise<string>} 表示用のエラーメッセージ
 */
const extractErrorMessage = async (response) => {
  try {
    const body = await response.json();
    return body?.message ?? `APIエラーが発生しました（${response.status}）`;
  } catch {
    return `APIエラーが発生しました（${response.status}）`;
  }
};

/**
 * @description 条件に合うルートを1件取得する
 * @param {object} conditions 検索条件
 * @param {string} conditions.purpose 目的
 * @param {string} conditions.category カテゴリ
 * @param {number} conditions.distance 希望距離（km）
 * @returns {Promise<object>} ルート情報
 * @throws {Error} 通信に失敗した場合、またはAPIがエラーを返した場合
 */
export const fetchRoute = async ({ purpose, category, distance }) => {
  const query = new URLSearchParams({
    purpose,
    category,
    distance: String(distance)
  });

  const response = await fetch(`${API_BASE_PATH}/routes?${query.toString()}`);

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.json();
};
