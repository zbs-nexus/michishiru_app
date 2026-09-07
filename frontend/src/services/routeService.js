import { isJsonResponse } from '@/utils/apiResponse';

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
 * @param {string} conditions.genre ジャンル
 * @param {number} conditions.distanceKm 希望距離（km）
 * @returns {Promise<object>} ルート情報
 * @throws {Error} 通信に失敗した場合、またはAPIがエラーを返した場合
 */
export const fetchRoute = async ({ genre, distanceKm }) => {
  const query = new URLSearchParams({
    // TODO: getRoute APIのパラメータ名が category のため、ここで変換している。
    // API側を genre へ統一できた時点でこの変換を削除する（未決定事項 #1）
    category: genre,
    // リクエストのキーはkm固定の外部仕様のため、単位を付けない
    distance: String(distanceKm)
  });

  const response = await fetch(`${API_BASE_PATH}/routes?${query.toString()}`);

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  // APIが未配線の環境ではSPAのindex.htmlが200で返るため、解析前に判定する
  if (!isJsonResponse(response)) {
    throw new Error(
      'ルート作成APIに接続できません（JSON以外の応答を受け取りました）'
    );
  }

  return response.json();
};

/**
 * @description 条件と現在地からルートを1件生成する
 * @param {object} conditions 生成条件
 * @param {string} conditions.genre ジャンル
 * @param {number} conditions.distanceKm 目標距離（km）
 * @param {{lat: number, lng: number}} conditions.origin 現在地
 * @returns {Promise<object>} 生成したルート（geojsonを含む）
 * @throws {Error} 通信に失敗した場合、またはAPIがエラーを返した場合
 */
export const generateRoute = async ({ genre, distanceKm, origin }) => {
  const response = await fetch(`${API_BASE_PATH}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      genre,
      // リクエストのキーはkm固定の外部仕様のため、単位を付けない
      distance: distanceKm,
      lat: origin.lat,
      lng: origin.lng
    })
  });

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  // APIが未配線の環境ではSPAのindex.htmlが200で返るため、解析前に判定する
  if (!isJsonResponse(response)) {
    throw new Error(
      'ルート生成APIに接続できません（JSON以外の応答を受け取りました）'
    );
  }

  return response.json();
};
