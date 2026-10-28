/**
 * @description 地図表示に関する定数を定義する。
 * 地図ライブラリはMapLibre GLを使い、タイルの配信元はスタイルで切り替える。
 */

/** 地図の初期中心座標（[経度, 緯度]）。ルートの座標が取得できない場合に使う */
export const DEFAULT_MAP_CENTER = [139.7036, 35.6862];

/** 地図の初期ズームレベル */
export const DEFAULT_ZOOM_LEVEL = 14;

/**
 * ルート全体を収めるときに許容する最大ズームレベル。
 * 短いルートで極端に寄りすぎ、周辺の道が見えなくなるのを防ぐ。
 */
export const MAX_FIT_ZOOM_LEVEL = 17;

/** ルート全体を収めるときに確保する余白（ピクセル） */
export const MAP_FIT_PADDING_PX = 40;

/**
 * ルートを示す線の色（--route-blue と同色）。
 * 地図の下地（緑の公園・灰色の道路）と競合しない青にしている。
 * global.css の `.spot-marker` と揃えているため、変更時は両方直す。
 */
export const ROUTE_LINE_COLOR = '#1A73E8';

/** ルートを示す線の太さ（ピクセル） */
export const ROUTE_LINE_WIDTH_PX = 5;

/** ルートを示す線の縁取りの色。地図の背景と線を見分けやすくする */
export const ROUTE_LINE_OUTLINE_COLOR = '#FFFFFF';

/** ルートを示す線の縁取りを含めた太さ（ピクセル） */
export const ROUTE_LINE_OUTLINE_WIDTH_PX = 9;

/**
 * 案内中の歩き終えた区間の色（--route-walked-leg と同色）。
 * 灰色の破線にして、これからの区間（青）と見分ける。変更時は両方直す。
 */
export const ROUTE_WALKED_LEG_COLOR = '#9AA0A6';

/** 案内中の歩き終えた区間の太さ（ピクセル） */
export const ROUTE_WALKED_LEG_WIDTH_PX = 4;

/** 案内中の歩き終えた区間の破線（線の太さを単位とする、線の長さと間隔） */
export const ROUTE_WALKED_LEG_DASH_ARRAY = [2, 1.5];

/**
 * 案内中の今の区間の色（--route-current-leg = --accent-green と同色）。
 * トースト（次の目的地のバナー）の左枠と同じ緑にする。変更時は両方直す。
 */
export const ROUTE_CURRENT_LEG_COLOR = '#3F7A5C';

/** 案内中の今の区間の太さ（ピクセル） */
export const ROUTE_CURRENT_LEG_WIDTH_PX = 7;

/** 案内中の今の区間の白い縁取りを含めた太さ（ピクセル）。色は ROUTE_LINE_OUTLINE_COLOR */
export const ROUTE_CURRENT_LEG_CASING_WIDTH_PX = 12;

/** 現在地マーカーの外円のサイズ（ピクセル） */
export const CURRENT_LOCATION_MARKER_SIZE_PX = 24;

/** 現在地マーカーの色（Google Maps風の青） */
export const CURRENT_LOCATION_COLOR = '#4285F4';

/** 現在地マーカーの精度円の色（半透明） */
export const CURRENT_LOCATION_ACCURACY_COLOR = 'rgba(66, 133, 244, 0.15)';

/**
 * 案内開始時のズームレベル。案内画面を開いた直後は、この値でスタート地点を中央に置く。
 * 1つ目の目的地までの区間の長さでは変えない（横幅 約190mで、最初の曲がり角まで見える）。
 * 現在地へ戻るボタンはこの値を使わず、押した時点の倍率のまま寄せる。
 */
export const NAVIGATION_ZOOM_LEVEL = 17;

/**
 * 地図スタイルのURL。
 * Location Service（Maps）を使う場合は、スタイルディスクリプタのURLを
 * `frontend/.env.local` の VITE_MAP_STYLE_URL に設定する。
 *
 * 注意: ここで指定した値はビルド成果物に含まれ、ブラウザから参照できる。
 * APIキーを含むURLを設定する場合は、キー側にリファラ制限をかけること
 * （前提条件書「外部API利用時のルール」）。
 */
const MAP_STYLE_URL = import.meta.env.VITE_MAP_STYLE_URL ?? null;

/**
 * VITE_MAP_STYLE_URL 未設定時に使う代替スタイル。
 * キーなしで表示できるOpenStreetMapのラスタタイルを使う。
 * 開発中の動作確認用であり、本番配信には利用規約上使えないため、
 * 本番では VITE_MAP_STYLE_URL を必ず設定する。
 */
const FALLBACK_MAP_STYLE = {
  version: 8,
  sources: {
    'osm-raster': {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }
  },
  layers: [
    {
      id: 'osm-raster',
      type: 'raster',
      source: 'osm-raster'
    }
  ]
};

/** MapLibre GL へ渡す地図スタイル */
export const MAP_STYLE = MAP_STYLE_URL ?? FALLBACK_MAP_STYLE;

/** 地図スタイルを環境変数から取得できているかどうか */
export const HAS_CONFIGURED_MAP_STYLE = MAP_STYLE_URL !== null;
