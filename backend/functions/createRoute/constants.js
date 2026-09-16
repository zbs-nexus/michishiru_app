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

/**
 * 1回のルート生成で周辺検索を行うスポットカテゴリの最大数。
 * ジャンルに紐づくカテゴリが多い（例: 食べ歩きは20件超）と、その数だけ
 * SearchNearby を並列に呼ぶことになり、生成時間が伸びてゲートウェイの
 * タイムアウト（29秒）に達する。これを超える場合は毎回ランダムに
 * 選び直し、生成時間を抑えつつ再作成のたびに違うカテゴリを試す。
 */
export const MAX_SEARCH_CATEGORIES = 8;

/**
 * プロンプトへ渡す候補スポットの最大件数。
 * 候補が多いほどBedrockへ渡すトークンが増えて生成が遅くなるため、
 * 現在地に近い順から上限件数に絞ってから渡す。
 */
export const MAX_PROMPT_CANDIDATES = 20;

/**
 * 周辺スポット検索の半径を目標距離から決めるときの比率。
 * 出発地へ戻る周回コースでは、各スポットは出発地から概ね目標距離の半分より
 * 内側にある。これより遠い候補（例: 新宿を出発地にしたときの上野）を
 * 検索段階で除外し、目標距離を大きく超えるルートが選ばれるのを防ぐ。
 */
export const SEARCH_RADIUS_RATIO = 0.5;

/**
 * 周辺スポット検索の半径（m）の範囲。
 * 狭すぎると候補が集まらず、広すぎると遠方スポットが混ざるため上下限を設ける。
 */
export const SEARCH_RADIUS_RANGE_M = { min: 500, max: 5000 };

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

/** 目標距離に対して許容する誤差（km）。この範囲内なら目標達成とみなす */
export const DISTANCE_TOLERANCE_KM = 1;

/** スポットを削るときに残す最小のスポット数 */
export const MIN_SPOT_COUNT = 1;

/** スポットを増やすときの最大のスポット数 */
export const MAX_SPOT_COUNT = 5;

/**
 * ルート生成ループ（Bedrock呼び出し）の最大回数。
 * Bedrockの生成は1回あたり数秒かかり、生成時間の主なボトルネックになる。
 * 5秒以内の応答を優先し、初回生成に加えて再生成は最大1回まで（計2回）に抑える。
 * 距離超過の調整はスポット削減（Bedrockを呼ばない）で対応する。
 */
export const MAX_ROUTE_RETRY_COUNT = 2;

/** 1kmあたりのメートル数 */
export const METERS_PER_KM = 1000;

/**
 * 徒歩の平均速度（m/秒）。大人の標準的な歩行速度（時速4km）。
 * 所要時間がAPIから取得できない場合の概算に使う。
 */
export const WALKING_METERS_PER_SECOND = 1.11;

/** 地球の半径（m）。2点間の距離計算に使う */
export const EARTH_RADIUS_M = 6371000;

/**
 * 経路座標を間引くときの許容誤差（m）。
 * Ramer–Douglas–Peucker で、元の線からこの距離以内に収まる点は省く。
 * 徒歩ルートの見た目を保てる範囲でできるだけ点を減らし、応答サイズと
 * 描画コストを抑える。小さいほど元の形に忠実で点が多く残る。
 */
export const SIMPLIFY_TOLERANCE_M = 5;

/** 受け付ける緯度の範囲 */
export const LATITUDE_RANGE = { min: -90, max: 90 };

/** 受け付ける経度の範囲 */
export const LONGITUDE_RANGE = { min: -180, max: 180 };

/** 受け付ける目標距離の範囲（km） */
export const TARGET_DISTANCE_RANGE_KM = { min: 0.5, max: 20 };
