import { describe, expect, test } from 'vitest';
import {
  MASCOT_LEVEL_REQUIREMENTS,
  MASCOT_LEVEL_THRESHOLDS
} from '@/constants/mascotExperience';

/**
 * 合意済みの経験値表を固定するテスト。
 * 累計しきい値はコード内で足し上げて導出しているため、導出の結果が
 * 合意した表と一致していることをここで止める。
 */
describe('mascotExperience', () => {
  test('必要経験値はLv.1→2からLv.9→10までの9段である', () => {
    expect(MASCOT_LEVEL_REQUIREMENTS).toEqual([
      1000, 1300, 1690, 2197, 2856, 3713, 4827, 6275, 8157
    ]);
  });

  test('累計しきい値は必要経験値の足し上げと一致する', () => {
    expect(MASCOT_LEVEL_THRESHOLDS).toEqual([
      0, 1000, 2300, 3990, 6187, 9043, 12756, 17583, 23858, 32015
    ]);
  });

  test('累計しきい値はLv.1からLv.10までの10段で単調増加する', () => {
    expect(MASCOT_LEVEL_THRESHOLDS).toHaveLength(10);

    for (let index = 1; index < MASCOT_LEVEL_THRESHOLDS.length; index += 1) {
      expect(MASCOT_LEVEL_THRESHOLDS[index]).toBeGreaterThan(
        MASCOT_LEVEL_THRESHOLDS[index - 1]
      );
    }
  });
});
