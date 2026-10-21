/**
 * @description マスコットの経験値に関する定数。
 *
 * 経験値は実績（投稿件数・累計距離・累計時間）から求める。APIは生の実績だけを返し、
 * 係数とレベル表はフロントだけが持つ。そのため値の定義元はこのファイル1つに限る。
 *
 * 他のモジュールを import しないため、Vue を介さず素の node からも読める
 * （しきい値の導出が合意済みの表と一致することを確認するため）。
 */

/** 口コミ投稿1件あたりの経験値 */
export const EXPERIENCE_PER_REVIEW = 100;

/** 歩いた距離1kmあたりの経験値 */
export const EXPERIENCE_PER_KM = 100;

/** 歩いた時間1分あたりの経験値 */
export const EXPERIENCE_PER_MINUTE = 10;

/** 1kmあたりのメートル数。累計距離（メートル）をkmへ換算するために使う */
export const METERS_PER_KM = 1000;

/**
 * 各レベルから次のレベルへ上がるのに要する経験値。
 * 添字0が Lv.1→2、添字8が Lv.9→10（Lv.10 が上限のため9段で終わる）。
 *
 * Lv.1→2 を1000として、以降は1.3倍の等比で増やしている（端数は切り捨て）。
 * 経験値表の唯一の定義元であり、累計のしきい値はここから足し上げて導出する。
 */
export const MASCOT_LEVEL_REQUIREMENTS = [
  1000, 1300, 1690, 2197, 2856, 3713, 4827, 6275, 8157
];

/**
 * 各レベルに到達する累計経験値。添字0が Lv.1（0）、添字9が Lv.10。
 *
 * 必要経験値の表を足し上げて作る。累計値を直書きすると、必要経験値を
 * 変えたときに片方だけ直して食い違う（しかもエラーにならず、レベルだけが狂う）。
 * 導出結果は [0, 1000, 2300, 3990, 6187, 9043, 12756, 17583, 23858, 32015] になる。
 */
export const MASCOT_LEVEL_THRESHOLDS = MASCOT_LEVEL_REQUIREMENTS.reduce(
  (thresholds, requirement) => [
    ...thresholds,
    thresholds[thresholds.length - 1] + requirement
  ],
  [0]
);
