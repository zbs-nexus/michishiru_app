import { fetchIdToken } from '@/services/authService';
import { isJsonResponse } from '@/utils/apiResponse';

/**
 * @description 散歩の実績リソースのAPI通信を担当する。
 * 失敗時は例外を投げ、捕捉と退避の判断はcomposableが行う。
 *
 * APIはAPI GatewayのCognitoオーソライザーで保護しているため、
 * IDトークンをAuthorizationヘッダーで載せる。
 * `Bearer ` などのスキーム接頭辞は付けない。オーソライザーは既定で
 * ヘッダーの値をトークンそのものとして検証するため、接頭辞を付けると検証に失敗する。
 *
 * 失敗の種類は例外の `name` で伝える。composable は「退避してもう一度送る価値があるか」
 * だけを知りたいが、その判断材料（HTTPのステータス）を持つのはこの層であるため、
 * ここで2種類に名前付けしてから投げる。
 * - `WalkResultSaveRetryable`: 通信不能・429・5xx。時間を置けば通る見込みがある
 * - `WalkResultSaveRejected`: その他の4xx。何度送っても同じ結果になる
 *
 * `fetchIdToken` が投げた例外（`NoValidSession`）はここで捕まえず上位へ流す。
 * 再ログインすれば送れるため、composable 側は再試行可として扱う。
 */

/** APIのベースパス */
const API_BASE_PATH = '/api/v1';

/** 再試行する価値があるステータス（スロットリング） */
const THROTTLED_STATUS = 429;

/** これ以上のステータスはサーバー側の一時的な不調とみなす */
const SERVER_ERROR_STATUS_THRESHOLD = 500;

/**
 * @description 指定した名前を持つ例外を組み立てる
 * @param {string} name 例外の名前（再試行可否を表す）
 * @param {string} message 例外のメッセージ
 * @returns {Error} 名前を設定した例外
 */
const createSaveError = (name, message) => {
  const error = new Error(message);
  error.name = name;

  return error;
};

/**
 * @description エラーレスポンスからメッセージを取り出す
 * @param {Response} response fetchのレスポンス
 * @returns {Promise<string>} 表示用のエラーメッセージ
 */
const extractErrorMessage = async (response) => {
  try {
    const body = await response.json();

    return body?.message ?? `保存に失敗しました（${response.status}）`;
  } catch {
    return `保存に失敗しました（${response.status}）`;
  }
};

/**
 * @description 保存APIへリクエストを送る。
 * 通信そのものができなかった場合（圏外・機内モード等）は、通信が回復すれば
 * 同じ内容で通るため再試行可として投げ直す。
 * @param {string} idToken 認可に使うIDトークン
 * @param {object} walkResult 保存する実績
 * @returns {Promise<Response>} fetchのレスポンス
 * @throws {Error} 通信できなかった場合（name は WalkResultSaveRetryable）
 */
const requestSave = async (idToken, walkResult) => {
  try {
    return await fetch(`${API_BASE_PATH}/walk-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: idToken
      },
      body: JSON.stringify(walkResult)
    });
  } catch {
    throw createSaveError(
      'WalkResultSaveRetryable',
      '通信できなかったため保存できませんでした'
    );
  }
};

/**
 * @description 散歩の実績を保存する。
 * `walkId` は冪等キーで、同じ値を送り直しても累計は二重に加算されない。
 * 既に保存済みだった場合もAPIは200を返すため、呼び出し側は成功として扱える。
 *
 * ボディに `userId` は含めない。利用者はLambdaが
 * `event.requestContext.authorizer.claims.sub` から決めるため、
 * フロントが名乗った値は使われない。
 * @param {object} walkResult 保存する実績（walkId / totalDistanceM / spotCount / elapsedMinutes / startedAt / endedAt / measurementStatus / routeTitle / genreId）
 * @returns {Promise<{walkId: string, isAlreadySaved: boolean}>} 保存した散歩のIDと、既に保存済みだったかどうか
 * @throws {Error} 通信に失敗した場合（name は WalkResultSaveRetryable / WalkResultSaveRejected）、またはセッションが失効している場合（name は NoValidSession）
 */
export const saveWalkResult = async (walkResult) => {
  const idToken = await fetchIdToken();
  const response = await requestSave(idToken, walkResult);

  if (!response.ok) {
    const isRetryable =
      response.status === THROTTLED_STATUS ||
      response.status >= SERVER_ERROR_STATUS_THRESHOLD;

    throw createSaveError(
      isRetryable ? 'WalkResultSaveRetryable' : 'WalkResultSaveRejected',
      await extractErrorMessage(response)
    );
  }

  // APIが未配線の環境ではSPAのindex.html（HTML）が200で返る。送り直しても
  // 配線されるまで同じ結果になるため、退避せず拒否として扱う
  if (!isJsonResponse(response)) {
    throw createSaveError(
      'WalkResultSaveRejected',
      '実績の保存APIから予期しない応答を受け取りました'
    );
  }

  return response.json();
};
