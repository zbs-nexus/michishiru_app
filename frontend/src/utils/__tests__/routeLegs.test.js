import { describe, expect, test } from 'vitest';
import { toRouteLegSections } from '@/utils/routeLegs';

/**
 * @description 区間を「歩き終えた・今・これから」に分ける処理のテスト。
 * スポット3件・区間4件（開始→1、1→2、2→3、3→開始）で確かめる。
 */

/**
 * @description 見分けの付く区間を作る
 * @param {number} index 区間の番号
 * @returns {{geometry: {type: string, coordinates: number[][]}}} 区間
 */
const createLeg = (index) => ({
  geometry: {
    type: 'LineString',
    coordinates: [
      [139.7 + index * 0.001, 35.686],
      [139.7 + (index + 1) * 0.001, 35.686]
    ]
  }
});

/** 4区間（スポット3件ぶん） */
const legs = [0, 1, 2, 3].map(createLeg);

/** 各区間の線 */
const geometries = legs.map((leg) => leg.geometry);

describe('toRouteLegSections', () => {
  test('1スポット目へ向かう間（k=0）は、開始地点→1スポット目が今の区間', () => {
    expect(toRouteLegSections({ legs, spotCount: 3, visitedCount: 0 })).toEqual({
      walkedLegs: [],
      currentLeg: geometries[0],
      upcomingLegs: [geometries[1], geometries[2], geometries[3]]
    });
  });

  test('途中（k=1）は、前のスポット→次のスポットが今の区間', () => {
    expect(toRouteLegSections({ legs, spotCount: 3, visitedCount: 1 })).toEqual({
      walkedLegs: [geometries[0]],
      currentLeg: geometries[1],
      upcomingLegs: [geometries[2], geometries[3]]
    });
  });

  test('最終スポットへ向かう間（k=N-1）は、前のスポット→最終スポットが今の区間', () => {
    expect(toRouteLegSections({ legs, spotCount: 3, visitedCount: 2 })).toEqual({
      walkedLegs: [geometries[0], geometries[1]],
      currentLeg: geometries[2],
      upcomingLegs: [geometries[3]]
    });
  });

  test('全スポット到達後（k=N）は、最終スポット→開始地点の帰り道が今の区間', () => {
    expect(toRouteLegSections({ legs, spotCount: 3, visitedCount: 3 })).toEqual({
      walkedLegs: [geometries[0], geometries[1], geometries[2]],
      currentLeg: geometries[3],
      upcomingLegs: []
    });
  });

  test('区間が無い場合は null（1色で描く）', () => {
    expect(toRouteLegSections({ legs: undefined, spotCount: 3, visitedCount: 0 })).toBeNull();
    expect(toRouteLegSections({ legs: [], spotCount: 3, visitedCount: 0 })).toBeNull();
  });

  test('区間の数がスポット数+1と合わない場合は null', () => {
    expect(
      toRouteLegSections({ legs: legs.slice(0, 3), spotCount: 3, visitedCount: 0 })
    ).toBeNull();
    expect(
      toRouteLegSections({ legs: [...legs, createLeg(4)], spotCount: 3, visitedCount: 0 })
    ).toBeNull();
  });

  test('到達数が範囲外・整数でない場合は null', () => {
    [-1, 4, 1.5].forEach((visitedCount) => {
      expect(toRouteLegSections({ legs, spotCount: 3, visitedCount })).toBeNull();
    });
  });

  test('2点未満の区間を含む場合は null', () => {
    const brokenLegs = [
      legs[0],
      { geometry: { type: 'LineString', coordinates: [[139.7, 35.686]] } },
      legs[2],
      legs[3]
    ];

    expect(toRouteLegSections({ legs: brokenLegs, spotCount: 3, visitedCount: 0 })).toBeNull();
  });

  test('スポットが0件の場合は null', () => {
    expect(toRouteLegSections({ legs: [legs[0]], spotCount: 0, visitedCount: 0 })).toBeNull();
  });
});
