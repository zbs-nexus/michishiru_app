import { describe, expect, test } from 'vitest';
import {
  toExperiencePoints,
  toMascotLevelProgress
} from '@/utils/mascotLevelProgress';

describe('toExperiencePoints', () => {
  test('投稿・距離・時間の3項を合計する', () => {
    // 投稿3件=300 + 5km=500 + 30分=300
    expect(
      toExperiencePoints({
        cumulativeDistanceM: 5000,
        cumulativeMinutes: 30,
        reviewCount: 3
      })
    ).toBe(1100);
  });

  test('端数は項ごとではなく合計に対して1回だけ切り捨てる', () => {
    // 距離 1,234m = 123.4 と 2,345m = 234.5 を足すと 357.9 → 357
    expect(
      toExperiencePoints({
        cumulativeDistanceM: 1234 + 2345,
        cumulativeMinutes: 0,
        reviewCount: 0
      })
    ).toBe(357);
  });

  test('数値でない実績は0として扱う', () => {
    expect(
      toExperiencePoints({
        cumulativeDistanceM: undefined,
        cumulativeMinutes: null,
        reviewCount: '3'
      })
    ).toBe(0);
  });
});

describe('toMascotLevelProgress', () => {
  test('実績が0のときはLv.1で進捗も0になる', () => {
    expect(toMascotLevelProgress(0)).toEqual({
      mascotLevel: 1,
      experienceInCurrentLevel: 0,
      experienceToNextLevel: 1000,
      levelProgressRatio: 0,
      isMaxLevel: false
    });
  });

  test('しきい値の直前はまだレベルが上がらない', () => {
    const progress = toMascotLevelProgress(999);

    expect(progress.mascotLevel).toBe(1);
    expect(progress.experienceInCurrentLevel).toBe(999);
  });

  test('しきい値に到達するとレベルが上がる', () => {
    const progress = toMascotLevelProgress(1000);

    expect(progress.mascotLevel).toBe(2);
    expect(progress.experienceInCurrentLevel).toBe(0);
    expect(progress.experienceToNextLevel).toBe(1300);
  });

  test('レベル内の進捗は現在レベルの必要経験値に対する割合になる', () => {
    // Lv.2 のしきい値1000 + 650 → 1300 のうち半分
    const progress = toMascotLevelProgress(1650);

    expect(progress.mascotLevel).toBe(2);
    expect(progress.experienceInCurrentLevel).toBe(650);
    expect(progress.levelProgressRatio).toBeCloseTo(0.5);
  });

  test('上限レベルでは次の必要経験値を持たず割合は1になる', () => {
    const progress = toMascotLevelProgress(32080);

    expect(progress).toEqual({
      mascotLevel: 10,
      experienceInCurrentLevel: 0,
      experienceToNextLevel: null,
      levelProgressRatio: 1,
      isMaxLevel: true
    });
  });

  test('上限を超えて積んでもLv.10で止まる', () => {
    const progress = toMascotLevelProgress(999999);

    expect(progress.mascotLevel).toBe(10);
    expect(progress.isMaxLevel).toBe(true);
    expect(progress.levelProgressRatio).toBe(1);
  });
});
