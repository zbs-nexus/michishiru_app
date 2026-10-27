/**
 * @description チュートリアルで使う固定値を定義する。
 * チュートリアルは実際のAPIを呼ばず、ここに用意したダミーのルートと実績を見せる。
 * 本番/ローカルのマスタや位置情報に左右されず、常に同じ流れをたどらせるため、
 * 画面で扱うルート情報（utils/routeResponse.js の toRoute が返す形）をそのまま持つ。
 */

import { DEFAULT_CURRENT_LOCATION } from '@/constants/routeConditions';

/** チュートリアルで選ばせるジャンル（genreId）。表示上は「写真」のジャンル */
export const TUTORIAL_GENRE_ID = 'photo';

/** チュートリアルで合わせさせる距離（km） */
export const TUTORIAL_DISTANCE_KM = 5;

/**
 * チュートリアルのダミールートの起点。
 * 現在地を取得しないため、フォールバックの座標（新宿駅周辺）を起点にする。
 */
const ORIGIN = DEFAULT_CURRENT_LOCATION;

/**
 * @description 起点からの相対的なずれ（度）で座標を組み立てる。
 * ダミーのため厳密な距離は問わず、地図に収まる範囲で点を散らす。
 * @param {number} lngOffset 経度のずれ
 * @param {number} latOffset 緯度のずれ
 * @returns {[number, number]} [経度, 緯度] の座標
 */
const toPosition = (lngOffset, latOffset) => [
  ORIGIN.lng + lngOffset,
  ORIGIN.lat + latOffset
];

/**
 * ダミールートのスポット。
 * 案内を短く終わらせるため2スポットにする（「次の目的地へ」は1回で終端に着く）。
 * 写真ジャンルらしい、撮り歩きの立ち寄り先にしている。
 */
const TUTORIAL_SPOTS = [
  {
    spotId: 'tutorial-spot-1',
    name: '光が差し込む並木道',
    lng: ORIGIN.lng + 0.004,
    lat: ORIGIN.lat + 0.003,
    spotType: 'photo',
    icon: null,
    isReviewSpot: false,
    isMyReviewSpot: false,
    reviewSpotId: null,
    reviewPosition: null
  },
  {
    spotId: 'tutorial-spot-2',
    name: '街を見渡せる歩道橋',
    lng: ORIGIN.lng + 0.007,
    lat: ORIGIN.lat - 0.001,
    spotType: 'photo',
    icon: null,
    isReviewSpot: false,
    isMyReviewSpot: false,
    reviewSpotId: null,
    reviewPosition: null
  }
];

/**
 * 経路の形（全体の線）。起点 → スポット1 → スポット2 → 起点へ戻る折れ線。
 */
const TUTORIAL_GEOMETRY = {
  type: 'LineString',
  coordinates: [
    toPosition(0, 0),
    toPosition(0.002, 0.0015),
    toPosition(0.004, 0.003),
    toPosition(0.0055, 0.001),
    toPosition(0.007, -0.001),
    toPosition(0.0035, -0.0015),
    toPosition(0, 0)
  ]
};

/**
 * 区間ごとの線（legs）。スポット数+1本。
 * legs[0]=起点→スポット1、legs[1]=スポット1→スポット2、legs[2]=スポット2→起点の帰り道。
 * 案内画面の区間の描き分け（utils/routeLegs.js）が成立するよう、各区間は2点以上にする。
 */
const TUTORIAL_LEGS = [
  {
    geometry: {
      type: 'LineString',
      coordinates: [toPosition(0, 0), toPosition(0.002, 0.0015), toPosition(0.004, 0.003)]
    }
  },
  {
    geometry: {
      type: 'LineString',
      coordinates: [toPosition(0.004, 0.003), toPosition(0.0055, 0.001), toPosition(0.007, -0.001)]
    }
  },
  {
    geometry: {
      type: 'LineString',
      coordinates: [toPosition(0.007, -0.001), toPosition(0.0035, -0.0015), toPosition(0, 0)]
    }
  }
];

/**
 * @description チュートリアルのダミールートを新しく作って返す。
 * ストアへ入れると配列やオブジェクトが共有されるため、呼ぶたびに複製して返す。
 * @returns {object} 画面で扱う形のルート情報（toRoute と同じ形）
 */
export const createTutorialRoute = () => ({
  routeId: 'tutorial-route',
  routeName: 'はじめての写真さんぽ',
  description:
    '街の何気ない景色をカメラ片手に巡るコースだよ。立ち止まって1枚撮りながら、ゆっくり歩いてみてね。',
  distanceKm: TUTORIAL_DISTANCE_KM,
  durationMinutes: 60,
  spots: TUTORIAL_SPOTS.map((spot) => ({ ...spot })),
  geometry: {
    type: TUTORIAL_GEOMETRY.type,
    coordinates: TUTORIAL_GEOMETRY.coordinates.map((position) => [...position])
  },
  legs: TUTORIAL_LEGS.map((leg) => ({
    geometry: {
      type: leg.geometry.type,
      coordinates: leg.geometry.coordinates.map((position) => [...position])
    }
  })),
  selectedGenres: null,
  selectedDistanceKm: null
});

/**
 * チュートリアルの散歩結果に見せるダミーの実績。
 * GPSを止めるため実測値が出ない。固定値を結果画面に表示する。
 */
export const TUTORIAL_WALK_RESULT = {
  totalDistanceKm: TUTORIAL_DISTANCE_KM,
  spotCount: TUTORIAL_SPOTS.length,
  durationMinutes: 60
};

/** チュートリアルで評価を付けさせるダミーの口コミの場所のID */
export const TUTORIAL_REVIEW_SPOT_ID = 'tutorial-review-spot';

/**
 * チュートリアルで地図に出す、他の人の口コミの場所（紫ピン）のダミー。
 * 実APIを呼ばずに描くため、useReviewSpots が返す場所の形に合わせる。
 * ルートの近く（起点とスポット1の間あたり）に1つだけ置く。
 */
export const TUTORIAL_OTHER_REVIEW_SPOT = {
  spotId: TUTORIAL_REVIEW_SPOT_ID,
  spotName: '夕暮れがきれいな小さな橋',
  genreId: TUTORIAL_GENRE_ID,
  genreName: '写真',
  position: { lng: ORIGIN.lng + 0.002, lat: ORIGIN.lat + 0.0022 },
  ratingAverage: 4.5,
  ratingCount: 12,
  photoKeys: [],
  photoUrls: []
};

/**
 * ダミー紫ピンをタップしたときに、評価のみモードのフォームへ渡す「既存の場所」。
 * 本来は resolveSpot（実API）が返すが、チュートリアルでは解決せずこれを使う。
 * 評価のみモードにするため isOwner は false、userReview は未評価（rating 0）にする。
 */
export const TUTORIAL_RESOLVED_REVIEW_SPOT = {
  exists: true,
  isOwner: false,
  userReview: { rating: 0 },
  spot: {
    spotId: TUTORIAL_REVIEW_SPOT_ID,
    spotName: TUTORIAL_OTHER_REVIEW_SPOT.spotName,
    genreId: TUTORIAL_OTHER_REVIEW_SPOT.genreId,
    genreName: TUTORIAL_OTHER_REVIEW_SPOT.genreName,
    ratingAverage: TUTORIAL_OTHER_REVIEW_SPOT.ratingAverage,
    ratingCount: TUTORIAL_OTHER_REVIEW_SPOT.ratingCount,
    photoKeys: [],
    photoUrls: []
  }
};
