import { logInfo } from '../../shared/utils/logger.js';
import {
  createWalkResultWithoutTotals,
  createWalkResultWithTotals
} from './repository.js';

/**
 * @description 散歩の実績を保存するビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを受け取って返す。
 */

/** 既定で使うリポジトリ。テスト時は差し替える */
const defaultRepositories = {
  createWalkResultWithTotals,
  createWalkResultWithoutTotals
};

/** 一度も測位できなかった散歩を表す計測状態 */
const MEASUREMENT_STATUS_UNAVAILABLE = 'unavailable';

/**
 * @description 散歩の実績を保存する
 * @param {object} walkResult 保存する実績（検証済みの値 + userId）
 * @param {string} walkResult.walkId 散歩のID
 * @param {string} walkResult.userId 利用者の識別子（Cognitoのsub）
 * @param {string} walkResult.measurementStatus 計測状態
 * @param {object} [repositories] 書き込みに使うリポジトリ（テスト時に差し替える）
 * @returns {Promise<{walkId: string, isAlreadySaved: boolean}>} 保存の結果
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const createWalkResult = async (
  walkResult,
  repositories = defaultRepositories
) => {
  const item = { ...walkResult, createdAt: new Date().toISOString() };

  // 一度も測位できなかった散歩（unavailable）は、距離もスポット数も実際の行動を
  // 反映していないため、記録としては残すが累計には足さない。
  // 途中まで測れた散歩（partial）は測れた分に意味があるため累計へ足す。
  const { isStored } =
    item.measurementStatus === MEASUREMENT_STATUS_UNAVAILABLE
      ? await repositories.createWalkResultWithoutTotals(item)
      : await repositories.createWalkResultWithTotals(item);

  if (!isStored) {
    // 退避した実績の再送では必ずこの経路を通る。
    // エラーとして扱うと利用者に無意味な失敗が見えるため、成功として返す。
    logInfo('同じwalkIdの実績が既に保存されています', {
      walkId: item.walkId
    });

    return { walkId: item.walkId, isAlreadySaved: true };
  }

  logInfo('散歩の実績を保存しました', {
    walkId: item.walkId,
    measurementStatus: item.measurementStatus
  });

  return { walkId: item.walkId, isAlreadySaved: false };
};
