import { fetchIdToken } from '@/services/authService';
import { isJsonResponse } from '@/utils/apiResponse';

/**
 * @description 口コミリソースのAPI通信を担当する。
 * レスポンスを画面で扱う形で返し、失敗時は例外を投げる。例外の捕捉はcomposableが行う。
 *
 * APIはAPI GatewayのCognitoオーソライザーで保護しているため、
 * IDトークンをAuthorizationヘッダーで載せる（`Bearer` 等の接頭辞は付けない）。
 * `fetchIdToken` が投げた例外はここで捕まえず上位へ伝播させる。
 *
 * routeService.js / conditionService.js と同じヘッダー付与の記述が3ファイル目になった。
 * TODO(NZ未採番): 認可付きfetchを共通化する（各サービスの重複を解消する）。
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
    throw new Error('口コミAPIから予期しない応答を受け取りました');
  }
};

/**
 * @description 指定座標に対応する既存の口コミ場所を解決する。
 * 投稿済みの場所（半径40m以内）があれば、その場所と自分の既存評価を返す。
 * @param {{lng: number, lat: number}} position 長押しされた座標
 * @returns {Promise<{exists: boolean, spot?: object, userReview?: {rating: number}|null}>} 解決結果
 * @throws {Error} 通信に失敗した場合、またはセッションが失効している場合
 */
export const resolveSpot = async ({ lng, lat }) => {
  const idToken = await fetchIdToken();
  const query = new URLSearchParams({ lng: String(lng), lat: String(lat) });

  const response = await fetch(`${API_BASE_PATH}/spots?${query.toString()}`, {
    headers: { Authorization: idToken }
  });

  await ensureUsableResponse(response);

  return response.json();
};

/**
 * @description 口コミを投稿する。
 * 初回投稿は spotName / genreId / genreName を伴い、2回目以降は評価のみを送る
 * （名前・ジャンルは null で送り、サーバー側で無視される）。
 * @param {object} input 投稿内容
 * @param {{lng: number, lat: number}} input.position 投稿位置
 * @param {number} input.rating 評価（1〜5）
 * @param {string|null} input.spotName ロケーション名（初回のみ）
 * @param {string|null} input.genreId ジャンルID（初回のみ）
 * @param {string|null} input.genreName ジャンル名（初回のみ）
 * @returns {Promise<object>} 投稿結果（場所情報を含む）
 * @throws {Error} 通信に失敗した場合、入力不備、またはセッションが失効している場合
 */
export const postReview = async ({
  position,
  rating,
  spotName,
  genreId,
  genreName,
  photoKeys = []
}) => {
  const idToken = await fetchIdToken();

  const response = await fetch(`${API_BASE_PATH}/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: idToken
    },
    body: JSON.stringify({ position, rating, spotName, genreId, genreName, photoKeys })
  });

  await ensureUsableResponse(response);

  return response.json();
};

/**
 * @description 写真アップロード用の署名付きURLを発行する
 * @param {number} count 発行する枚数（1〜4）
 * @returns {Promise<Array<{key: string, uploadUrl: string}>>} キーとアップロードURLの一覧
 * @throws {Error} 通信に失敗した場合、またはセッションが失効している場合
 */
export const fetchPhotoUploadUrls = async (count) => {
  const idToken = await fetchIdToken();

  const response = await fetch(`${API_BASE_PATH}/review-photo-uploads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: idToken
    },
    body: JSON.stringify({ count })
  });

  await ensureUsableResponse(response);

  const { uploads } = await response.json();

  return uploads;
};

/**
 * @description 署名付きURLへ写真を直接アップロードする（S3へのPUT）。
 * S3への直PUTのため、Authorizationヘッダーは付けない（URL自体が署名を含む）。
 * @param {string} uploadUrl 署名付きのアップロードURL
 * @param {File} file アップロードする画像ファイル
 * @returns {Promise<void>}
 * @throws {Error} アップロードに失敗した場合
 */
export const uploadPhoto = async (uploadUrl, file) => {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file
  });

  if (!response.ok) {
    throw new Error(`写真のアップロードに失敗しました（${response.status}）`);
  }
};
