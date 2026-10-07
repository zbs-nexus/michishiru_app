import {
  GENRE_ID_MAX_LENGTH,
  MAX_ELAPSED_MINUTES,
  MAX_SPOT_COUNT,
  MAX_TOTAL_DISTANCE_M,
  MEASUREMENT_STATUSES,
  ROUTE_TITLE_MAX_LENGTH
} from './constants.js';

/**
 * @description 散歩の実績を保存するリクエストの入力チェックを担当する。
 * 副作用を持たない純粋関数として実装する。
 *
 * リクエストボディの `userId` は検証も採用もしない（`value` にも含めない）。
 * 利用者の識別はHandlerが `event.requestContext.authorizer.claims.sub` から行うため、
 * ボディ側の申告を受け入れると他人の実績として保存できてしまう。
 */

/**
 * UUID v4 の形。
 * `walkId` はソートキー（`WALK#<endedAt>#<walkId>`）の一部になるため、
 * `#` のような区切り文字や任意の文字列をキーへ流し込ませない
 * （`back-data-access.md` の「ユーザー入力をそのままキーに使わない」）。
 */
const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** ジャンルIDとして受け付ける文字（半角英数字とハイフン・アンダースコア） */
const GENRE_ID_PATTERN = /^[0-9a-zA-Z_-]+$/;

/**
 * ISO 8601（UTC）の形。`2026-10-07T01:42:00.000Z` と、ミリ秒のない
 * `2026-10-07T01:42:00Z` を受け付ける。
 *
 * `walkId` と同じ理由で書式を縛る。`endedAt` もソートキー
 * （`WALK#<endedAt>#<walkId>`）の一部になるため、`Date.parse` が通るかどうかだけで
 * 受けると `2026/01/01` のような非ISO形式や、制御文字を挟んだ `#` 混じりの値が
 * キーへ入ってしまう。区切りの数が変わると、`WALK#` の前方一致と辞書順で
 * 履歴を引く前提が崩れる。
 *
 * フロントは `Date.prototype.toISOString()` の値（常にUTC）を送るため、
 * `+09:00` のようなオフセット付きは受け付けない。
 */
const ISO_8601_UTC_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

/**
 * @description 文字列として扱える値かどうかを判定する
 * @param {unknown} value 判定する値
 * @returns {boolean} 空でない文字列の場合はtrue
 */
const isNonEmptyString = (value) =>
  typeof value === 'string' && value.length > 0;

/**
 * @description 任意の値を、前後の空白を除いた文字列として取り出す
 * @param {unknown} value 取り出す値
 * @returns {string} 文字列。文字列以外の場合は空文字
 */
const toTrimmedString = (value) =>
  typeof value === 'string' ? value.trim() : '';

/**
 * @description ISO 8601（UTC）の日時として扱える文字列かどうかを判定する。
 * 書式の一致だけでなく実在する日時かどうかも見る（`2026-13-45T00:00:00Z` を弾く）。
 * @param {unknown} value 判定する値
 * @returns {boolean} 日時として扱える場合はtrue
 */
const isIso8601Date = (value) =>
  isNonEmptyString(value) &&
  ISO_8601_UTC_PATTERN.test(value) &&
  !Number.isNaN(Date.parse(value));

/**
 * @description 実績の保存リクエストを検証する
 * @param {object} body リクエストボディ
 * @returns {{isValid: boolean, errorMessages: string[], value: object}} 検証の結果と、検証済みの値
 */
export const validateCreateWalkResultRequest = (body) => {
  const errorMessages = [];

  const walkId = toTrimmedString(body?.walkId);
  const totalDistanceM = body?.totalDistanceM;
  const spotCount = body?.spotCount;
  const elapsedMinutes = body?.elapsedMinutes;
  const startedAt = toTrimmedString(body?.startedAt);
  const endedAt = toTrimmedString(body?.endedAt);
  const measurementStatus = toTrimmedString(body?.measurementStatus);
  const genreId = toTrimmedString(body?.genreId);

  // ルートタイトルは表示名の控えに過ぎないため、長さで保存を落とさず切り詰める
  const routeTitle = toTrimmedString(body?.routeTitle).slice(
    0,
    ROUTE_TITLE_MAX_LENGTH
  );

  if (walkId === '') {
    errorMessages.push('walkId は必須です');
  } else if (!UUID_V4_PATTERN.test(walkId)) {
    errorMessages.push('walkId はUUID v4の形式で指定してください');
  }

  if (typeof totalDistanceM !== 'number' || !Number.isFinite(totalDistanceM)) {
    errorMessages.push('totalDistanceM は数値で指定してください');
  } else if (totalDistanceM < 0 || totalDistanceM > MAX_TOTAL_DISTANCE_M) {
    errorMessages.push(
      `totalDistanceM は0以上${MAX_TOTAL_DISTANCE_M}以下で指定してください`
    );
  }

  if (!Number.isInteger(spotCount)) {
    errorMessages.push('spotCount は整数で指定してください');
  } else if (spotCount < 0 || spotCount > MAX_SPOT_COUNT) {
    errorMessages.push(`spotCount は0以上${MAX_SPOT_COUNT}以下で指定してください`);
  }

  if (!Number.isInteger(elapsedMinutes)) {
    errorMessages.push('elapsedMinutes は整数で指定してください');
  } else if (elapsedMinutes < 0 || elapsedMinutes > MAX_ELAPSED_MINUTES) {
    errorMessages.push(
      `elapsedMinutes は0以上${MAX_ELAPSED_MINUTES}以下で指定してください`
    );
  }

  if (!isIso8601Date(startedAt)) {
    errorMessages.push('startedAt はISO 8601の日時で指定してください');
  }

  if (!isIso8601Date(endedAt)) {
    errorMessages.push('endedAt はISO 8601の日時で指定してください');
  }

  // 時刻が逆転した実績は、経過時間や並び順の前提が崩れるため保存しない
  if (
    isIso8601Date(startedAt) &&
    isIso8601Date(endedAt) &&
    Date.parse(endedAt) < Date.parse(startedAt)
  ) {
    errorMessages.push('endedAt は startedAt 以降の日時で指定してください');
  }

  if (!MEASUREMENT_STATUSES.includes(measurementStatus)) {
    errorMessages.push(
      `measurementStatus は${MEASUREMENT_STATUSES.join(' / ')}のいずれかで指定してください`
    );
  }

  if (genreId !== '') {
    if (genreId.length > GENRE_ID_MAX_LENGTH) {
      errorMessages.push(
        `genreId は${GENRE_ID_MAX_LENGTH}文字以内で指定してください`
      );
    } else if (!GENRE_ID_PATTERN.test(genreId)) {
      errorMessages.push(
        'genreId は半角英数字とハイフン・アンダースコアで指定してください'
      );
    }
  }

  return {
    isValid: errorMessages.length === 0,
    errorMessages,
    value: {
      walkId,
      // 距離はDynamoDBへ整数で持たせる（累計の ADD が小数で揺れるのを避ける）
      totalDistanceM:
        typeof totalDistanceM === 'number' && Number.isFinite(totalDistanceM)
          ? Math.round(totalDistanceM)
          : 0,
      spotCount: Number.isInteger(spotCount) ? spotCount : 0,
      elapsedMinutes: Number.isInteger(elapsedMinutes) ? elapsedMinutes : 0,
      startedAt,
      endedAt,
      measurementStatus,
      routeTitle,
      genreId
    }
  };
};
