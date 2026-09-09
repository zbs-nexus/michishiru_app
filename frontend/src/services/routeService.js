import { isJsonResponse } from '@/utils/apiResponse';
import { toRoute } from '@/utils/routeResponse';

/**
 * @description ルートリソースのAPI通信を担当する。
 * レスポンスを画面で扱う形へ変換して返し、失敗時は例外を投げる。
 * 例外の捕捉はcomposableが行う。
 */

/** APIのベースパス */
const API_BASE_PATH = '/api/v1';

/**
 * ルート作成APIのエンドポイント。
 * 既定はCloudFrontの /api/* 配下（同一オリジン）で、ローカルではViteのプロキシが
 * APIハーネスへ転送する。ルート生成API（Bedrock + Location Service）を
 * 別のAPI Gatewayで動かしている間は、`frontend/.env.local` の
 * VITE_ROUTE_API_URL にそのURLを設定して切り替える。
 */
const ROUTE_API_URL =
  import.meta.env.VITE_ROUTE_API_URL ?? `${API_BASE_PATH}/routes`;

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
 * @returns {Promise<object>} 画面で扱う形に変換したルート情報
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

  const response = await fetch(`${ROUTE_API_URL}?${query.toString()}`);

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  // APIが未配線の環境ではSPAのindex.htmlが200で返るため、解析前に判定する
  if (!isJsonResponse(response)) {
    throw new Error(
      'ルート作成APIに接続できません（JSON以外の応答を受け取りました）'
    );
  }

  return toRoute(await response.json());
};
