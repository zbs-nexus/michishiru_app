import * as experienceRepository from './repository.js';

/**
 * @description マスコットの経験値のもとになる実績（生の値）を取得する。
 * HTTPに依存せず、プレーンなオブジェクトを入出力する。
 *
 * 経験値とレベルはここでは求めない。係数とレベル表はフロントが持ち、
 * このAPIは実績の生の値だけを返す（係数を変えてもAPIを変えずに済む）。
 * @param {object} input 入力
 * @param {string} input.userId 利用者の識別子（Cognitoのsub）
 * @param {object} [repository] データアクセス（テスト用に差し替え可能）
 * @returns {Promise<{cumulativeDistanceM: number, cumulativeMinutes: number, reviewCount: number}>} 実績
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getUserExperience = async (
  { userId },
  repository = experienceRepository
) => {
  const [walkTotals, reviewCount] = await Promise.all([
    repository.getWalkTotalsByUserId(userId),
    repository.getReviewCountByUserId(userId)
  ]);

  // まだ散歩を保存していない利用者には累計アイテムが無い。
  // 実績が無いだけでエラーではないため、0として返す
  return {
    cumulativeDistanceM: walkTotals?.cumulativeDistanceM ?? 0,
    cumulativeMinutes: walkTotals?.cumulativeMinutes ?? 0,
    reviewCount
  };
};
