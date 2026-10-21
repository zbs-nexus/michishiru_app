import mascotLv01Image from '@/assets/images/mascot/mascot-lv01.png';
import mascotLv02Image from '@/assets/images/mascot/mascot-lv02.png';
import mascotLv03Image from '@/assets/images/mascot/mascot-lv03.png';
import mascotLv04Image from '@/assets/images/mascot/mascot-lv04.png';
import mascotLv05Image from '@/assets/images/mascot/mascot-lv05.png';
import mascotLv06Image from '@/assets/images/mascot/mascot-lv06.png';
import mascotLv07Image from '@/assets/images/mascot/mascot-lv07.png';
import mascotLv08Image from '@/assets/images/mascot/mascot-lv08.png';
import mascotLv09Image from '@/assets/images/mascot/mascot-lv09.png';
import mascotLv10Image from '@/assets/images/mascot/mascot-lv10.png';

/**
 * @description マスコット（案内役のフクロウ）のレベルごとの定義。
 *
 * レベルはユーザーの実績（累計距離・累計時間・口コミの投稿件数）から求めた
 * 経験値で1〜10まで上がる。実績の取得と経験値の計算は mascotStore が行う。
 *
 * 画像はLv.1〜Lv.10まで用意済み。画像が未用意のレベルは mascotImage を null に
 * しておけば、getMascotLevel() が用意済みの姿で代替する（姿を増やすときのための備え）。
 */

/** マスコットのレベルの下限 */
export const MASCOT_MIN_LEVEL = 1;

/** マスコットのレベルの上限 */
export const MASCOT_MAX_LEVEL = 10;

/**
 * 実績を取得できていないときに使う既定のレベル。
 * 取得に失敗した状態で高いレベルを出さないよう、下限に合わせている。
 */
export const DEFAULT_MASCOT_LEVEL = MASCOT_MIN_LEVEL;

/**
 * レベルと名前と画像の対応表。
 * 名前はデザイン（キャラクター設定画）の表記に合わせている。
 */
export const MASCOT_LEVELS = [
  { level: 1, mascotName: 'ミチのタマゴ', mascotImage: mascotLv01Image },
  { level: 2, mascotName: 'よちよちヒナ', mascotImage: mascotLv02Image },
  { level: 3, mascotName: 'てくてくフクロウ', mascotImage: mascotLv03Image },
  { level: 4, mascotName: 'みならいガイド', mascotImage: mascotLv04Image },
  { level: 5, mascotName: 'まちの案内人', mascotImage: mascotLv05Image },
  { level: 6, mascotName: 'みちしるべの使者', mascotImage: mascotLv06Image },
  { level: 7, mascotName: 'たびびとフクロウ', mascotImage: mascotLv07Image },
  { level: 8, mascotName: '星導の賢者', mascotImage: mascotLv08Image },
  { level: 9, mascotName: '大樹の道標', mascotImage: mascotLv09Image },
  { level: 10, mascotName: '極・ミチシル', mascotImage: mascotLv10Image }
];

/** 画像が用意されているレベルの定義。レベルの昇順 */
const availableMascotLevels = MASCOT_LEVELS.filter(
  (definition) => definition.mascotImage !== null
);

/**
 * @description レベルに対応するマスコットの定義を返す。
 * 指定したレベルの画像が未用意の場合は、用意済みで最も高いレベルの姿で代替する。
 * 画面側で「画像が無い」分岐を書かずに済ませるため、必ず表示できる定義を返す。
 * @param {number} [level] マスコットのレベル
 * @returns {{level: number, mascotName: string, mascotImage: string}} マスコットの定義
 */
export const getMascotLevel = (level = DEFAULT_MASCOT_LEVEL) => {
  const requested = MASCOT_LEVELS.find(
    (definition) => definition.level === level
  );

  if (requested?.mascotImage) {
    return requested;
  }

  const requestedLevel = requested?.level ?? DEFAULT_MASCOT_LEVEL;
  const substitute = availableMascotLevels
    .filter((definition) => definition.level <= requestedLevel)
    .at(-1);

  return substitute ?? availableMascotLevels[0];
};
