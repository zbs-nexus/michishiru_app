/**
 * @description ルート作成APIのレスポンスを画面で扱う形へ変換する。
 * Vueに依存しない純粋な変換のみを行うため、サービス層から呼び出して使う。
 *
 * ルート生成（Bedrock + Location Service）のレスポンスはキーがsnake_caseで、
 * 距離がメートル・所要時間が秒で返る。画面側の規約はcamelCaseかつ
 * 距離はkm・所要時間は分のため、ここで単位ごと変換して境界を1か所に閉じ込める。
 */

/** 1kmあたりのメートル数 */
const METERS_PER_KM = 1000;

/** 1分あたりの秒数 */
const SECONDS_PER_MINUTE = 60;

/** ルート名が取得できなかった場合の表示名 */
const FALLBACK_ROUTE_NAME = 'おすすめの散歩ルート';

/**
 * @description Lambdaプロキシ統合の外側を取り除く。
 * API Gateway経由ではbodyの中身だけが届くが、Lambdaを直接呼び出す構成では
 * statusCode・headers・文字列bodyの入れ物ごと返る。どちらでも扱えるようにする。
 * @param {object} payload APIから受け取った値
 * @returns {object} ルート情報の本体
 * @throws {Error} bodyがJSONとして解析できない場合
 */
const unwrapLambdaEnvelope = (payload) => {
  if (
    payload === null ||
    typeof payload !== 'object' ||
    typeof payload.body !== 'string' ||
    !('statusCode' in payload)
  ) {
    return payload;
  }

  try {
    return JSON.parse(payload.body);
  } catch {
    throw new Error('ルート作成APIの応答を解析できませんでした');
  }
};

/**
 * @description GeoJSONのLineStringから座標列を取り出す。
 * 経路の形が無ければ線を引けないため、その場合はnullを返して呼び出し側に判断させる。
 * @param {object} geometry APIが返したgeometry
 * @returns {{type: string, coordinates: number[][]}|null} 座標列を持つgeometry。無い場合はnull
 */
const toLineGeometry = (geometry) => {
  const coordinates = geometry?.coordinates;

  if (geometry?.type !== 'LineString' || !Array.isArray(coordinates)) {
    return null;
  }

  const validCoordinates = coordinates.filter(
    (coordinate) =>
      Array.isArray(coordinate) &&
      Number.isFinite(coordinate[0]) &&
      Number.isFinite(coordinate[1])
  );

  // 1点だけでは線にならないため、2点未満は経路なしとして扱う
  if (validCoordinates.length < 2) {
    return null;
  }

  return { type: 'LineString', coordinates: validCoordinates };
};

/**
 * @description ルート生成APIの立ち寄り先をスポットへ変換する。
 * APIのキーはwaypointsだが、中身は「ユーザーが足を止める場所」のため
 * 用語辞書に従いspotとして扱う（経路上の座標点はgeometryが持つ）。
 * @param {object[]} items APIが返したwaypointsの配列
 * @returns {object[]} スポットの一覧
 */
const toSpots = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => ({
    // APIがIDを返さないため、巡る順序から一意なキーを組み立てる
    spotId: item.spotId ?? item.waypointId ?? `spot-${index + 1}`,
    name: item.name ?? '',
    lat: Number.isFinite(item.lat) ? item.lat : null,
    lng: Number.isFinite(item.lng) ? item.lng : null,
    spotType: item.spotType ?? item.type ?? null,
    icon: item.icon ?? null
  }));
};

/**
 * @description ルート作成APIのレスポンスを画面で扱う形へ変換する。
 *
 * ルート生成APIのレスポンス（route_title / summary / geometry を持つ形）と、
 * 既存のgetRoute APIのレスポンス（routeName / distance を持つ形）の両方を受け付ける。
 * getRoute側は経路の座標を持たないため、geometryはnullになる。
 * @param {object} payload APIから受け取った値
 * @returns {{routeName: string, description: string, distanceKm: number, durationMinutes: number, spots: object[], geometry: object|null}} 画面で扱うルート情報
 * @throws {Error} 応答がオブジェクトでない場合
 */
export const toRoute = (payload) => {
  const body = unwrapLambdaEnvelope(payload);

  if (body === null || typeof body !== 'object') {
    throw new Error('ルート作成APIから予期しない応答を受け取りました');
  }

  const totalDistanceM = body.summary?.total_distance_m;
  const totalDurationS = body.summary?.total_duration_s;

  return {
    routeId: body.routeId ?? null,
    routeName: body.route_title ?? body.routeName ?? FALLBACK_ROUTE_NAME,
    description: body.concept_story ?? body.description ?? '',
    distanceKm: Number.isFinite(totalDistanceM)
      ? totalDistanceM / METERS_PER_KM
      : (body.distance ?? 0),
    durationMinutes: Number.isFinite(totalDurationS)
      ? Math.round(totalDurationS / SECONDS_PER_MINUTE)
      : (body.duration ?? 0),
    spots: toSpots(body.waypoints ?? body.spots),
    geometry: toLineGeometry(body.geometry)
  };
};
