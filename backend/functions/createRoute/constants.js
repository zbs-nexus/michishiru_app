/**
 * @description createRoute関数が使う定数。
 * 環境依存値は環境変数から取得し、ハードコードしない。
 * このファイルだけが process.env を読む。
 */

/** 外部サービスを呼び出すリージョン（Lambdaが自動で設定する） */
export const AWS_REGION = process.env.AWS_REGION ?? 'ap-northeast-1';

/**
 * ルート案を生成するBedrockのモデルID。
 * クロスリージョン推論プロファイルを指定する（`jp.` プレフィックス）。
 */
export const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID ?? 'jp.anthropic.claude-haiku-4-5-20251001-v1:0';

/** Bedrockの生成のばらつき。低くして候補リストからの逸脱を抑える */
export const BEDROCK_TEMPERATURE = 0.2;

/** Bedrockが生成する最大トークン数 */
export const BEDROCK_MAX_TOKENS = 1000;

/**
 * ジャンルマスタのテーブル名（ジャンル名 → ジャンルID）。
 * TODO(NZ未採番): コンソールで手動作成されたテーブルを参照している。
 * CDK管理へ移し、命名規則（`PascalCase単数形-<環境>`）へ揃える。
 */
export const GENRE_TABLE_NAME = process.env.GENRE_TABLE_NAME ?? '';

/** スポットカテゴリマスタのテーブル名（ジャンルID → PlacesのカテゴリID） */
export const SPOT_CATEGORY_TABLE_NAME = process.env.SPOT_CATEGORY_TABLE_NAME ?? '';

/**
 * マスタテーブルの属性名。
 * 手動作成されたテーブルのため属性名が日本語・snake_case で、
 * `back-data-access.md` の camelCase 規則から外れている。
 * TODO(NZ未採番): CDK管理へ移すときに属性名も camelCase へ揃える。
 */
export const GENRE_NAME_ATTRIBUTE = 'ジャンル名称';

/** ジャンルマスタ・カテゴリマスタが持つジャンルIDの属性名 */
export const GENRE_ID_ATTRIBUTE = 'genre_id';

/** カテゴリマスタが持つカテゴリIDの属性名 */
export const SPOT_CATEGORY_ID_ATTRIBUTE = 'category_id';

/** 周辺スポット検索で1カテゴリあたり取得する最大件数 */
export const MAX_SPOT_CANDIDATES = 15;

/** 目標距離の既定値（km） */
export const DEFAULT_TARGET_DISTANCE_KM = 3;

/**
 * 指定が無い場合に使うジャンル名。
 * ジャンルマスタは日本語のジャンル名で引くため、既定値も日本語で持つ。
 */
export const DEFAULT_GENRE_NAME = '自然';

/**
 * 現在地が渡されなかった場合に使う座標（新宿）。
 * TODO(NZ未採番): フロントが Geolocation API で現在地を送るようになったら、
 * 既定値をやめて必須項目にする。
 */
export const DEFAULT_CURRENT_LOCATION = { lng: 139.702973, lat: 35.686338 };

/** 目標距離に対して許容する超過の倍率。これを超えたらスポットを削って再計算する */
export const DISTANCE_TOLERANCE_RATIO = 1.25;

/** スポットを削るときに残す最小のスポット数 */
export const MIN_SPOT_COUNT = 2;

/** 1kmあたりのメートル数 */
export const METERS_PER_KM = 1000;

/** 徒歩の平均速度（m/秒）。所要時間がAPIから取得できない場合の概算に使う */
export const WALKING_METERS_PER_SECOND = 1.33;

/** 地球の半径（m）。2点間の距離計算に使う */
export const EARTH_RADIUS_M = 6371000;

/** 受け付ける緯度の範囲 */
export const LATITUDE_RANGE = { min: -90, max: 90 };

/** 受け付ける経度の範囲 */
export const LONGITUDE_RANGE = { min: -180, max: 180 };

/** 受け付ける目標距離の範囲（km） */
export const TARGET_DISTANCE_RANGE_KM = { min: 0.5, max: 20 };
