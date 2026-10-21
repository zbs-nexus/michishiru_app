import { ref } from 'vue';
import { describe, expect, test } from 'vitest';
import { useRouteProgress } from '@/composables/useRouteProgress';

/**
 * @description 次の目的地の切り替え（進める・戻す）を確かめるテスト。
 * 距離の計算は対象外のため、経路の形は渡さず直線距離のままにする。
 */

/**
 * @description 3スポットのルートで useRouteProgress を呼ぶ
 * @returns {object} useRouteProgress の戻り値
 */
const createRouteProgress = () =>
  useRouteProgress({
    spots: ref([
      { spotId: 'spot-1', name: 'A', lat: 35.0, lng: 139.0 },
      { spotId: 'spot-2', name: 'B', lat: 35.001, lng: 139.001 },
      { spotId: 'spot-3', name: 'C', lat: 35.002, lng: 139.002 }
    ]),
    currentLocation: ref({ lat: 35.0, lng: 139.0 })
  });

describe('useRouteProgress の前の目的地へ戻す操作', () => {
  test('開始直後は1スポット目が次の目的地で、戻せない', () => {
    const { nextSpot, canReturnToPreviousSpot } = createRouteProgress();

    expect(nextSpot.value.spotId).toBe('spot-1');
    expect(canReturnToPreviousSpot.value).toBe(false);
  });

  test('到達済みが無いときに戻しても何も起きない', () => {
    const { nextSpot, visitedSpotIds, returnToPreviousSpot } = createRouteProgress();

    returnToPreviousSpot();

    expect(visitedSpotIds.value).toEqual([]);
    expect(nextSpot.value.spotId).toBe('spot-1');
  });

  test('戻すと次の目的地が1つ前に戻り、到達済みから消える', () => {
    const {
      nextSpot,
      visitedSpotIds,
      visitedCount,
      canReturnToPreviousSpot,
      advanceToNextSpot,
      returnToPreviousSpot
    } = createRouteProgress();

    advanceToNextSpot();
    advanceToNextSpot();
    expect(nextSpot.value.spotId).toBe('spot-3');
    expect(visitedCount.value).toBe(2);

    returnToPreviousSpot();

    expect(nextSpot.value.spotId).toBe('spot-2');
    expect(visitedSpotIds.value).toEqual(['spot-1']);
    expect(visitedCount.value).toBe(1);
    expect(canReturnToPreviousSpot.value).toBe(true);

    returnToPreviousSpot();

    expect(nextSpot.value.spotId).toBe('spot-1');
    expect(visitedSpotIds.value).toEqual([]);
    expect(visitedCount.value).toBe(0);
    expect(canReturnToPreviousSpot.value).toBe(false);
  });

  test('すべて巡った後も戻せ、最後のスポットの案内に戻る', () => {
    const {
      nextSpot,
      visitedSpotIds,
      isCompleted,
      canReturnToPreviousSpot,
      advanceToNextSpot,
      returnToPreviousSpot
    } = createRouteProgress();

    advanceToNextSpot();
    advanceToNextSpot();
    advanceToNextSpot();
    expect(isCompleted.value).toBe(true);
    expect(nextSpot.value).toBeNull();
    expect(canReturnToPreviousSpot.value).toBe(true);

    returnToPreviousSpot();

    expect(isCompleted.value).toBe(false);
    expect(nextSpot.value.spotId).toBe('spot-3');
    expect(visitedSpotIds.value).toEqual(['spot-1', 'spot-2']);
  });

  test('戻すたびに配列を差し替える', () => {
    const { visitedSpotIds, advanceToNextSpot, returnToPreviousSpot } = createRouteProgress();

    advanceToNextSpot();
    const before = visitedSpotIds.value;

    returnToPreviousSpot();

    // 呼び出し側の watch は deep なしで見ているため、中身の変更だけでは拾えない
    expect(visitedSpotIds.value).not.toBe(before);
  });
});
