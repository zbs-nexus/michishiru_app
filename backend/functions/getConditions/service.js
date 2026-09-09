import { logInfo } from '../../shared/utils/logger.js';
import * as conditionRepository from './repository.js';

/**
 * @description 検索条件マスタ取得のビジネスロジックを担当する。
 * HTTPには依存せず、プレーンなオブジェクトを返す。
 */

/**
 * @description 検索条件マスタ（目的・ジャンル・距離）の全項目を返す。
 * 項目の絞り込み・並べ替え・表示形式への変換は呼び出し側（フロント）で行うため、
 * ここではマスタの項目をそのまま返す。
 * @param {object} [repository] データ取得に使うリポジトリ（テスト時に差し替える）
 * @returns {Promise<object[]>} マスタ項目の一覧
 * @throws {ApplicationError} データストアへのアクセスに失敗した場合
 */
export const getConditions = async (repository = conditionRepository) => {
  const conditions = await repository.listConditions();

  logInfo('検索条件マスタを取得しました', { itemCount: conditions.length });

  return conditions;
};
