import { isJsonResponse } from '@/utils/apiResponse';

/**
 * @description 検索条件マスタ（目的・ジャンル・距離）のAPI通信を担当する。
 * レスポンスを画面で扱う形へ変換して返し、失敗時は例外を投げる。
 * 例外の捕捉はcomposableが行う。
 */

/**
 * 検索条件マスタAPIのベースURL。
 * TODO: CloudFrontの /api/* 配下へ統合し、同一オリジンで呼び出せるようにする
 * （前提条件書のとおり、統合後はCORS設定が不要になる）
 */
const CONDITION_API_BASE_URL =
  'https://152wqulx7l.execute-api.ap-northeast-1.amazonaws.com/dev';

/** 目的の項目を示すキー */
const PURPOSE_ITEM_KEY = 'PURPOSE#ALL';

/** ジャンルの項目を示すキー */
const GENRE_ITEM_KEY = 'GENRE#ALL';

/** 距離の項目を示すキー */
const DISTANCE_ITEM_KEY = 'DISTANCE#ALL';

/**
 * @description 指定した種別の有効な項目のみを表示順に並べて取り出す
 * @param {object[]} items APIが返した項目の一覧
 * @param {string} itemKey 取り出したい種別のキー
 * @returns {object[]} 表示順に並べた項目
 */
const pickActiveItems = (items, itemKey) =>
  items
    .filter((item) => item.pk === itemKey && item.isActive)
    .sort((first, second) => first.sortOrder - second.sortOrder);

/**
 * @description 距離の項目から選択範囲を組み立てる。
 * 先頭を下限、末尾を上限として扱う。
 * @param {object[]} distanceItems 表示順に並べた距離の項目
 * @returns {{minKm: number, maxKm: number, minLabel: string, maxLabel: string, defaultKm: number|null}} 距離の選択範囲
 */
const toDistanceRange = (distanceItems) => {
  const lowerItem = distanceItems.at(0);
  const upperItem = distanceItems.at(-1);
  const defaultItem = distanceItems.find((item) => item.isDefault);

  return {
    minKm: lowerItem.distanceKm,
    maxKm: upperItem.distanceKm,
    minLabel: lowerItem.displayLabel,
    maxLabel: upperItem.displayLabel,
    defaultKm: defaultItem?.distanceKm ?? null
  };
};

/**
 * @description 検索条件の選択肢をまとめて取得する
 * @returns {Promise<{purposeOptions: object[], genreOptions: object[], distanceRange: object}>} 目的・ジャンルの選択肢と距離の選択範囲
 * @throws {Error} 通信に失敗した場合、またはマスタの項目が不足している場合
 */
export const fetchConditionOptions = async () => {
  const response = await fetch(`${CONDITION_API_BASE_URL}/`);

  if (!response.ok) {
    throw new Error(`検索条件の取得に失敗しました（${response.status}）`);
  }

  if (!isJsonResponse(response)) {
    throw new Error('検索条件APIから予期しない応答を受け取りました');
  }

  const items = await response.json();

  if (!Array.isArray(items)) {
    throw new Error('検索条件のデータ形式が不正です');
  }

  const purposeItems = pickActiveItems(items, PURPOSE_ITEM_KEY);
  const genreItems = pickActiveItems(items, GENRE_ITEM_KEY);
  const distanceItems = pickActiveItems(items, DISTANCE_ITEM_KEY);

  // いずれかが欠けると条件を選べないため、部分的な表示は行わずエラーとして扱う
  if (
    purposeItems.length === 0 ||
    genreItems.length === 0 ||
    distanceItems.length === 0
  ) {
    throw new Error('検索条件のデータが不足しています');
  }

  return {
    purposeOptions: purposeItems.map((item) => ({
      value: item.purposeId,
      label: item.purposeName,
      icon: item.iconEmoji
    })),
    genreOptions: genreItems.map((item) => ({
      value: item.genreId,
      label: item.genreName,
      icon: item.iconEmoji
    })),
    distanceRange: toDistanceRange(distanceItems)
  };
};
