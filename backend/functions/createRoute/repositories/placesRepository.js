import { GeoPlacesClient, SearchNearbyCommand } from '@aws-sdk/client-geo-places';
import { createDataSourceError } from '../../../shared/utils/errorHandler.js';
import { AWS_REGION, MAX_SPOT_CANDIDATES } from '../constants.js';

/**
 * @description Amazon Location Service（Places）から周辺スポットを取得する。
 * 外部サービスへのアクセスとアプリ形式への変換のみを行い、業務判断は持たない。
 */

/** クライアントの生成は1度だけ行い、呼び出しごとに作らない */
let placesClient = null;

/**
 * @description Placesのクライアントを取得する
 * @returns {GeoPlacesClient} 生成済みのクライアント
 */
const getPlacesClient = () => {
  if (placesClient === null) {
    placesClient = new GeoPlacesClient({ region: AWS_REGION });
  }

  return placesClient;
};

/**
 * @description 現在地の周辺から、指定カテゴリのスポット候補を取得する
 * @param {object} conditions 検索条件
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {string} conditions.spotCategory 検索するスポットのカテゴリ
 * @returns {Promise<{name: string, position: number[]}[]>} スポット候補の一覧
 * @throws {ApplicationError} 外部サービスへのアクセスに失敗した場合
 */
export const searchNearbySpots = async ({ currentLocation, spotCategory }) => {
  try {
    const response = await getPlacesClient().send(
      new SearchNearbyCommand({
        QueryPosition: [currentLocation.lng, currentLocation.lat],
        Filter: {
          IncludeCategories: [spotCategory]
        },
        MaxResults: MAX_SPOT_CANDIDATES
      })
    );

    return (response.ResultItems ?? []).map((item) => ({
      name: item.Title,
      // Places は [経度, 緯度] の順で返す。Routes へ渡す形と揃えるためそのまま保持する
      position: item.Position
    }));
  } catch (error) {
    throw createDataSourceError('周辺スポットの検索に失敗しました', {
      errorName: error.name,
      spotCategory
    });
  }
};
