import { fetchIdToken } from '@/services/authService';
import { isJsonResponse } from '@/utils/apiResponse';

/**
 * @description マスコットの経験値のもとになる実績のAPI通信を担当する。
 * 失敗時は例外を投げ、捕捉はストア側で行う。
 *
 * APIはAPI GatewayのCognitoオーソライザーで保護しているため、
 * IDトークンをAuthorizationヘッダーで載せる（`Bearer` 等の接頭辞は付けない）。
 *
 * reviewService.js / routeService.js などと同じヘッダー付与の記述が増えているが、
 * 共通化は既存のTODO（認可付きfetchの共通化）にまとめて行うため、ここでは揃えるだけにする。
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
 * @description レスポンスが成功かつJSONであることを保証する
 * @param {Response} response fetchのレスポンス
 * @returns {Promise<void>}
 * @throws {Error} 応答がエラー、またはJSON以外の場合
 */
const ensureUsableResponse = async (response) => {
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  // APIが未配線の環境ではSPAのindex.html（HTML）が200で返るため、解析前に判定する
  if (!isJsonResponse(response)) {
    throw new Error('実績APIから予期しない応答を受け取りました');
  }
};

/**
 * @description 自分の実績（累計距離・累計時間・口コミ投稿件数）を取得する。
 * 経験値とレベルはこの値から画面側（utils/mascotLevelProgress.js）で求める。
 * @returns {Promise<{cumulativeDistanceM: number, cumulativeMinutes: number, reviewCount: number}>} 実績
 * @throws {Error} 通信に失敗した場合、またはセッションが失効している場合
 */
export const fetchUserExperience = async () => {
  const idToken = await fetchIdToken();

  const response = await fetch(`${API_BASE_PATH}/experience`, {
    headers: { Authorization: idToken }
  });

  await ensureUsableResponse(response);

  const { cumulativeDistanceM, cumulativeMinutes, reviewCount } =
    await response.json();

  return { cumulativeDistanceM, cumulativeMinutes, reviewCount };
};
