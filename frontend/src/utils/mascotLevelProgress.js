import {
  EXPERIENCE_PER_KM,
  EXPERIENCE_PER_MINUTE,
  EXPERIENCE_PER_REVIEW,
  MASCOT_LEVEL_REQUIREMENTS,
  MASCOT_LEVEL_THRESHOLDS,
  METERS_PER_KM
} from '@/constants/mascotExperience';
import { MASCOT_MAX_LEVEL, MASCOT_MIN_LEVEL } from '@/constants/mascotLevels';

/**
 * @description 実績から経験値とレベルの進捗を求める純関数。
 * Vue に依存しないため、ストアからも素のテストからも同じように呼べる。
 */

/**
 * @description 数値として使える値だけを取り出す。
 * APIの応答が欠けていたり文字列で来ても計算を壊さないよう、0として扱う。
 * @param {unknown} value 判定する値
 * @returns {number} 数値。数値でない場合は0
 */
const toFiniteNumber = (value) => (Number.isFinite(value) ? value : 0);

/**
 * @description 実績から累計経験値を求める。
 *
 * 端数が出るのは距離の項だけだが、項ごとに丸めず3項の合計に対して1回だけ
 * 切り捨てる。項ごとに丸めると、同じ距離でも分け方によって結果が変わる。
 * @param {object} experience 実績
 * @param {number} experience.cumulativeDistanceM 累計の距離（メートル）
 * @param {number} experience.cumulativeMinutes 累計の時間（分）
 * @param {number} experience.reviewCount 口コミの投稿件数
 * @returns {number} 累計経験値
 */
export const toExperiencePoints = ({
  cumulativeDistanceM,
  cumulativeMinutes,
  reviewCount
}) => {
  const reviewPoints = toFiniteNumber(reviewCount) * EXPERIENCE_PER_REVIEW;
  const distancePoints =
    (toFiniteNumber(cumulativeDistanceM) / METERS_PER_KM) * EXPERIENCE_PER_KM;
  const minutePoints = toFiniteNumber(cumulativeMinutes) * EXPERIENCE_PER_MINUTE;

  return Math.floor(reviewPoints + distancePoints + minutePoints);
};

/**
 * @description 累計経験値から現在のレベルを求める。
 * しきい値を下から辿り、到達している最も高いレベルを返す。
 * @param {number} totalExperiencePoints 累計経験値
 * @returns {number} マスコットのレベル（1〜10）
 */
const toMascotLevel = (totalExperiencePoints) => {
  let level = MASCOT_MIN_LEVEL;

  for (let index = 0; index < MASCOT_LEVEL_THRESHOLDS.length; index += 1) {
    if (totalExperiencePoints >= MASCOT_LEVEL_THRESHOLDS[index]) {
      level = index + MASCOT_MIN_LEVEL;
    }
  }

  return Math.min(level, MASCOT_MAX_LEVEL);
};

/**
 * @description 累計経験値から、レベルとレベル内の進捗を求める。
 *
 * Lv.10 は上限のため次のレベルが無い。必要経験値を0にすると割合の計算で
 * 0除算になるため、`experienceToNextLevel` は null にして割合は1で返す
 * （バーは満たした状態で `MAX` と表示する）。
 * @param {number} totalExperiencePoints 累計経験値
 * @returns {{mascotLevel: number, experienceInCurrentLevel: number, experienceToNextLevel: number|null, levelProgressRatio: number, isMaxLevel: boolean}} レベルの進捗
 */
export const toMascotLevelProgress = (totalExperiencePoints) => {
  const total = Math.max(0, toFiniteNumber(totalExperiencePoints));
  const mascotLevel = toMascotLevel(total);
  const isMaxLevel = mascotLevel >= MASCOT_MAX_LEVEL;

  // しきい値の添字はレベル-1（添字0が Lv.1）
  const currentLevelThreshold = MASCOT_LEVEL_THRESHOLDS[mascotLevel - 1];
  const experienceInCurrentLevel = total - currentLevelThreshold;

  if (isMaxLevel) {
    return {
      mascotLevel,
      experienceInCurrentLevel,
      experienceToNextLevel: null,
      levelProgressRatio: 1,
      isMaxLevel: true
    };
  }

  // 必要経験値の添字はレベル-1（添字0が Lv.1→2）
  const experienceToNextLevel = MASCOT_LEVEL_REQUIREMENTS[mascotLevel - 1];
  // 丸め誤差や想定外の値でバーが枠から出ないよう0〜1に収める
  const levelProgressRatio = Math.min(
    1,
    Math.max(0, experienceInCurrentLevel / experienceToNextLevel)
  );

  return {
    mascotLevel,
    experienceInCurrentLevel,
    experienceToNextLevel,
    levelProgressRatio,
    isMaxLevel: false
  };
};
