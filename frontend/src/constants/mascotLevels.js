import mascotLv01Image from '@/assets/images/mascot/mascot-lv01.svg';

/**
 * @description マスコット（案内役のフクロウ）のレベルごとの定義。
 *
 * レベルはユーザーの実績に応じて1〜10まで上がる想定だが、実績の集計と保存は
 * まだ無いため、現時点では全画面が DEFAULT_MASCOT_LEVEL（Lv.1）を表示する。
 *
 * 画像が未用意のレベルは mascotImage を null にしておく。
 * 姿が増えたら画像を追加して null を差し替えるだけでよく、呼び出し側は変えない。
 */

/** マスコットのレベルの下限 */
export const MASCOT_MIN_LEVEL = 1;

/** マスコットのレベルの上限 */
export const MASCOT_MAX_LEVEL = 10;

/**
 * 実績連動が入るまで全画面で使う固定のレベル。
 * 実績から求めたレベルを渡せるようになったら、この値は初期値としてのみ使う。
 */
export const DEFAULT_MASCOT_LEVEL = MASCOT_MIN_LEVEL;

/**
 * レベルと名前と画像の対応表。
 * 名前はデザイン（キャラクター設定画）の表記に合わせている。
 */
export const MASCOT_LEVELS = [
  { level: 1, mascotName: 'ミチのタマゴ', mascotImage: mascotLv01Image },
  { level: 2, mascotName: 'よちよちヒナ', mascotImage: null },
  { level: 3, mascotName: 'てくてくフクロウ', mascotImage: null },
  { level: 4, mascotName: 'みならいガイド', mascotImage: null },
  { level: 5, mascotName: 'まちの案内人', mascotImage: null },
  { level: 6, mascotName: 'みちしるべの使者', mascotImage: null },
  { level: 7, mascotName: 'たびびとフクロウ', mascotImage: null },
  { level: 8, mascotName: '星導の賢者', mascotImage: null },
  { level: 9, mascotName: '大樹の道標', mascotImage: null },
  { level: 10, mascotName: '極・ミチシル', mascotImage: null }
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
