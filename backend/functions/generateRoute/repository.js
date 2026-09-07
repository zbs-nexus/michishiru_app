import { randomUUID } from 'node:crypto';
import {
  CANDIDATE_SPOT_COUNT,
  GENRE_SPOT_TYPES,
  SEARCH_KEYWORDS,
  TARGET_SPOT_COUNT,
  WALKING_MINUTES_PER_KM
} from './constants.js';

/**
 * @description ルート生成に必要なデータの取得を担当する。
 *
 * ここは段階1a（AWSリソースを作らない検証）向けの固定データ実装である。
 * 関数の入出力は段階1bで差し替える外部サービスに合わせてあり、
 * 中身のみを以下へ置き換える想定。
 *
 * | 関数 | 段階1bでの実体 |
 * |---|---|
 * | getSearchKeywords | DynamoDBの検索条件マスタ |
 * | searchNearbySpots | Amazon Location Service Places（SearchNearby） |
 * | selectSpotsByAi | Amazon Bedrock（InvokeModel） |
 * | calculateWalkingRoute | Amazon Location Service Routes（CalculateRoutes） |
 *
 * 差し替え時にService層を変更しないよう、戻り値の形をここで固定しておく。
 */

/** 地球の半径（km）。距離計算に使う */
const EARTH_RADIUS_KM = 6371;

/** 1区間あたりに生成する経由点の数（道路沿いの座標列を模す） */
const WAYPOINTS_PER_LEG = 12;

/**
 * 検索結果の代用となる固定スポット。
 * 東京駅周辺の実在の地名を用いているが、座標は概算である。
 */
const FIXTURE_SPOTS = [
  { name: '皇居外苑広場', spotType: 'park', lat: 35.6852, lng: 139.7528 },
  { name: '和田倉噴水公園', spotType: 'park', lat: 35.6857, lng: 139.7576 },
  { name: '日比谷公園', spotType: 'park', lat: 35.6739, lng: 139.7559 },
  { name: '大手町の森', spotType: 'park', lat: 35.687, lng: 139.7645 },
  { name: '常盤橋公園', spotType: 'park', lat: 35.6866, lng: 139.7714 },
  { name: '東京駅丸の内駅舎前', spotType: 'city', lat: 35.6812, lng: 139.7671 },
  { name: '丸の内仲通り', spotType: 'city', lat: 35.6795, lng: 139.7635 },
  { name: 'KITTE屋上庭園', spotType: 'viewpoint', lat: 35.6787, lng: 139.7648 },
  { name: '新丸ビルのテラス', spotType: 'viewpoint', lat: 35.6825, lng: 139.7648 },
  { name: '平将門首塚', spotType: 'shrine', lat: 35.6875, lng: 139.7686 },
  { name: '兜神社', spotType: 'shrine', lat: 35.681, lng: 139.777 },
  { name: '福徳神社', spotType: 'shrine', lat: 35.6862, lng: 139.7735 },
  { name: '於竹大日如来井戸跡', spotType: 'shrine', lat: 35.6845, lng: 139.7745 },
  { name: '丸の内のカフェテラス', spotType: 'cafe', lat: 35.68, lng: 139.7642 },
  { name: '八重洲のベーカリー', spotType: 'cafe', lat: 35.6795, lng: 139.769 },
  { name: '京橋のコーヒースタンド', spotType: 'cafe', lat: 35.6765, lng: 139.77 },
  { name: '日本橋の老舗和菓子店', spotType: 'gourmet', lat: 35.684, lng: 139.773 },
  { name: '八重洲の飲食街', spotType: 'gourmet', lat: 35.68, lng: 139.77 }
];

/** スポット種別ごとの紹介文の型 */
const DESCRIPTION_TEMPLATES = {
  park: '緑が多く、腰を下ろして休める場所です。',
  viewpoint: '見晴らしがよく、街並みを一望できます。',
  shrine: '古くから残る場所で、静かに歩けます。',
  city: '人通りがあり、街の雰囲気を感じられます。',
  cafe: 'ひと休みに立ち寄れるお店です。',
  gourmet: '食べ歩きに向いた場所です。'
};

/** ジャンルごとのコース名の型 */
const ROUTE_NAME_TEMPLATES = {
  nature: '緑をたどる',
  city: '街を眺める',
  history: '歴史をたどる',
  gourmet: '食べ歩きの'
};

/**
 * @description 度をラジアンへ変換する
 * @param {number} degree 角度（度）
 * @returns {number} 角度（ラジアン）
 */
const toRadian = (degree) => (degree * Math.PI) / 180;

/**
 * @description 2地点間の距離を求める
 * @param {{lat: number, lng: number}} from 始点
 * @param {{lat: number, lng: number}} to 終点
 * @returns {number} 距離（km）
 */
const calculateDistanceKm = (from, to) => {
  const latDiff = toRadian(to.lat - from.lat);
  const lngDiff = toRadian(to.lng - from.lng);
  const halfChordSquared =
    Math.sin(latDiff / 2) ** 2 +
    Math.cos(toRadian(from.lat)) * Math.cos(toRadian(to.lat)) * Math.sin(lngDiff / 2) ** 2;

  return (
    EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(halfChordSquared), Math.sqrt(1 - halfChordSquared))
  );
};

/**
 * @description 2地点を結ぶ経由点を生成する。
 * 直線ではなく道なりに見えるよう、進行方向に対して横へわずかにずらす。
 * @param {{lat: number, lng: number}} from 始点
 * @param {{lat: number, lng: number}} to 終点
 * @returns {{lat: number, lng: number}[]} 始点を含み終点を含まない経由点の一覧
 */
const buildLegWaypoints = (from, to) => {
  const waypoints = [];

  for (let step = 0; step < WAYPOINTS_PER_LEG; step += 1) {
    const ratio = step / WAYPOINTS_PER_LEG;
    // 区間の中央でずれが最大になるようにして、緩やかな曲線に見せる
    const lateralRatio = Math.sin(ratio * Math.PI) * 0.00035;

    waypoints.push({
      lat: from.lat + (to.lat - from.lat) * ratio - (to.lng - from.lng) * lateralRatio * 10,
      lng: from.lng + (to.lng - from.lng) * ratio + (to.lat - from.lat) * lateralRatio * 10
    });
  }

  return waypoints;
};

/**
 * @description ジャンルに対応する検索キーワードを取得する
 * @param {object} conditions 検索条件
 * @param {string} conditions.genre ジャンル
 * @returns {Promise<string[]>} 英語の検索キーワード
 */
export const getSearchKeywords = async ({ genre }) => SEARCH_KEYWORDS[genre] ?? [];

/**
 * @description 現在地周辺のスポット候補を取得する
 * @param {object} conditions 検索条件
 * @param {{lat: number, lng: number}} conditions.origin 現在地
 * @param {string} conditions.genre ジャンル
 * @returns {Promise<object[]>} 候補スポットの一覧
 */
export const searchNearbySpots = async ({ origin, genre }) => {
  const targetSpotTypes = GENRE_SPOT_TYPES[genre] ?? [];
  const matched = FIXTURE_SPOTS.filter((spot) => targetSpotTypes.includes(spot.spotType));
  const candidates = matched.length > 0 ? matched : FIXTURE_SPOTS;

  return candidates
    .map((spot) => ({
      ...spot,
      spotId: randomUUID(),
      distanceFromOrigin: calculateDistanceKm(origin, spot)
    }))
    .sort((left, right) => left.distanceFromOrigin - right.distanceFromOrigin)
    .slice(0, CANDIDATE_SPOT_COUNT);
};

/**
 * @description 候補スポットから立ち寄り先を選び、コース名と紹介文を生成する
 * @param {object} conditions 選定条件
 * @param {string} conditions.genre ジャンル
 * @param {object[]} conditions.candidates 候補スポットの一覧
 * @returns {Promise<{routeName: string, story: string, spots: object[]}>} 選定結果
 */
export const selectSpotsByAi = async ({ genre, candidates }) => {
  // 再作成で結果が変わることを確認できるよう、開始位置をずらして選ぶ。
  // 段階1bではAIの応答そのものが毎回変わるため、この処理は不要になる。
  const offset = Math.floor(Math.random() * candidates.length);
  const spots = Array.from({ length: Math.min(TARGET_SPOT_COUNT, candidates.length) }, (_, index) => {
    const candidate = candidates[(offset + index) % candidates.length];

    return {
      spotId: candidate.spotId,
      name: candidate.name,
      spotType: candidate.spotType,
      lat: candidate.lat,
      lng: candidate.lng,
      description: DESCRIPTION_TEMPLATES[candidate.spotType] ?? '立ち寄りやすい場所です。'
    };
  });

  const routeName = `${ROUTE_NAME_TEMPLATES[genre] ?? 'おすすめの'}${spots.length}スポットコース`;
  const story = `${spots.map((spot) => spot.name).join('、')}をめぐります。`;

  return { routeName, story, spots };
};

/**
 * @description 現在地を出発してスポットを巡り、現在地へ戻る徒歩ルートを計算する
 * @param {object} conditions 計算条件
 * @param {{lat: number, lng: number}} conditions.origin 現在地
 * @param {object[]} conditions.spots 経由するスポットの一覧
 * @returns {Promise<{distance: number, duration: number, waypoints: {lat: number, lng: number}[]}>} 計算結果
 */
export const calculateWalkingRoute = async ({ origin, spots }) => {
  const stops = [origin, ...spots, origin];
  const waypoints = [];

  for (let index = 0; index < stops.length - 1; index += 1) {
    waypoints.push(...buildLegWaypoints(stops[index], stops[index + 1]));
  }

  waypoints.push({ lat: origin.lat, lng: origin.lng });

  const distance = waypoints.reduce(
    (total, waypoint, index) =>
      index === 0 ? 0 : total + calculateDistanceKm(waypoints[index - 1], waypoint),
    0
  );

  return {
    distance: Number(distance.toFixed(2)),
    duration: Math.round(distance * WALKING_MINUTES_PER_KM),
    waypoints
  };
};
