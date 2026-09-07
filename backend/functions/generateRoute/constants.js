/**
 * @description generateRoute関数が使う定数。
 * 環境依存値は環境変数から取得し、ハードコードしない。
 *
 * 段階1a（AWSリソースを作らない検証）では外部サービスを呼ばないため、
 * 環境変数を必要とする定数はまだ持たない。
 * 段階1bでAmazon Location ServiceとAmazon Bedrockを呼ぶ際に、
 * モデルIDなどをこのファイルへ追加する。
 */

/**
 * 選択できるジャンル。
 * 検索条件マスタが返す genreId と一致させる
 * （docs/検索条件マスタAPI連携_実装説明書.md で一致を確認済み）。
 */
export const ALLOWED_GENRES = ['nature', 'city', 'history', 'gourmet'];

/** 指定できる目標距離の下限（km） */
export const MIN_DISTANCE_KM = 1;

/** 指定できる目標距離の上限（km） */
export const MAX_DISTANCE_KM = 10;

/** 徒歩1kmあたりの所要時間（分） */
export const WALKING_MINUTES_PER_KM = 15;

/** AIへ渡す候補スポットの上限件数 */
export const CANDIDATE_SPOT_COUNT = 16;

/** AIに選定させるスポットの目標件数 */
export const TARGET_SPOT_COUNT = 3;

/** ルートとして成立させるために残す最小スポット数 */
export const MIN_SPOT_COUNT = 1;

/**
 * 目標距離に対する超過の許容倍率。
 * これを超えた場合はAIを再呼び出しせず、末尾のスポットを削って再計算する。
 */
export const DISTANCE_OVERSHOOT_RATIO = 1.25;

/**
 * ジャンルと、そのジャンルで拾うスポット種別の対応。
 *
 * 段階1bでは、この対応をDynamoDBの検索条件マスタが持つ
 * 英語検索キーワード（searchKeywords）へ置き換える。
 * Amazon Location Service Placesへ渡す検索語がマスタ側の値になるため、
 * ここはあくまで段階1aの代用である。
 */
export const GENRE_SPOT_TYPES = {
  nature: ['park', 'viewpoint'],
  city: ['city', 'viewpoint'],
  history: ['shrine'],
  gourmet: ['cafe', 'gourmet']
};

/**
 * ジャンルごとの検索キーワード（段階1bでマスタへ移す）。
 * Amazon Location Serviceへは英語で問い合わせるため英語で持つ。
 */
export const SEARCH_KEYWORDS = {
  nature: ['park', 'garden', 'riverside'],
  city: ['landmark', 'shopping street', 'observation deck'],
  history: ['shrine', 'temple', 'historic site'],
  gourmet: ['cafe', 'bakery', 'confectionery']
};

/** GeoJSONのfeatureが何を表すかを示す値 */
export const FEATURE_KINDS = {
  /** ルートの線 */
  ROUTE: 'route',
  /** 立ち寄るスポット */
  SPOT: 'spot',
  /** 出発地（現在地） */
  ORIGIN: 'origin'
};
