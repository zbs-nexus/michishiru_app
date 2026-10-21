import { describe, expect, test } from 'vitest';
import { toRoute } from '@/utils/routeResponse';

/**
 * @description ルート作成APIの応答を画面の形へ変換する処理のテスト。
 * 口コミの場所の目印（isReviewSpot）が地図まで届くかを確かめる。
 */

/**
 * @description ルート作成APIの応答を作る
 * @param {object[]} waypoints 立ち寄り先
 * @returns {object} 応答
 */
const buildPayload = (waypoints) => ({
  route_title: 'テストコース',
  concept_story: '説明',
  summary: { total_distance_m: 3000, total_duration_s: 2700 },
  waypoints,
  geometry: {
    type: 'LineString',
    coordinates: [
      [139.7036, 35.6862],
      [139.7045, 35.6872]
    ]
  }
});

describe('toRoute（口コミの場所の目印）', () => {
  test('isReviewSpot が true のスポットだけを口コミの場所として渡す', () => {
    const route = toRoute(
      buildPayload([
        { name: '口コミの場所', lng: 139.7045, lat: 35.6872, isReviewSpot: true },
        { name: '公園', lng: 139.703, lat: 35.686, isReviewSpot: false }
      ])
    );

    expect(route.spots.map((spot) => [spot.name, spot.isReviewSpot])).toEqual([
      ['口コミの場所', true],
      ['公園', false]
    ]);
  });

  test('isReviewSpot を持たない古い応答は、口コミの場所でないものとして扱う', () => {
    const route = toRoute(buildPayload([{ name: '公園', lng: 139.703, lat: 35.686 }]));

    expect(route.spots[0].isReviewSpot).toBe(false);
  });

  test('true 以外の値（文字列など）は口コミの場所として扱わない', () => {
    const route = toRoute(
      buildPayload([{ name: '公園', lng: 139.703, lat: 35.686, isReviewSpot: 'true' }])
    );

    expect(route.spots[0].isReviewSpot).toBe(false);
  });

  test('目印を足しても、既存の項目（名前・座標・ID）は変わらない', () => {
    const route = toRoute(
      buildPayload([{ name: '口コミの場所', lng: 139.7045, lat: 35.6872, isReviewSpot: true }])
    );

    expect(route.spots[0]).toEqual({
      spotId: 'spot-1',
      name: '口コミの場所',
      lat: 35.6872,
      lng: 139.7045,
      spotType: null,
      icon: null,
      isReviewSpot: true
    });
    expect(route.distanceKm).toBe(3);
  });
});

describe('toRoute（区間ごとの線）', () => {
  /** 2区間ぶんの線 */
  const legs = [
    {
      geometry: {
        type: 'LineString',
        coordinates: [
          [139.7036, 35.6862],
          [139.704, 35.6866]
        ]
      }
    },
    {
      geometry: {
        type: 'LineString',
        coordinates: [
          [139.704, 35.6866],
          [139.7036, 35.6862]
        ]
      }
    }
  ];

  test('区間ごとの線を巡る順のまま受け取る', () => {
    const route = toRoute({ ...buildPayload([]), legs });

    expect(route.legs).toEqual(legs);
  });

  test('legs を持たない古い応答・getRoute 形式は空配列にする', () => {
    expect(toRoute(buildPayload([])).legs).toEqual([]);
    expect(toRoute({ routeName: '保存済み', distance: 3, spots: [] }).legs).toEqual([]);
  });

  test('2点未満の区間を含む場合は、対応がずれるため全体を空配列にする', () => {
    const route = toRoute({
      ...buildPayload([]),
      legs: [legs[0], { geometry: { type: 'LineString', coordinates: [[139.704, 35.6866]] } }]
    });

    expect(route.legs).toEqual([]);
  });

  test('区間を足しても、全体の線（geometry）は変わらない', () => {
    const route = toRoute({ ...buildPayload([]), legs });

    expect(route.geometry).toEqual(buildPayload([]).geometry);
  });
});