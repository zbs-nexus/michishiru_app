import { beforeEach, describe, expect, test } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { MEASUREMENT_STATUS, useWalkStore } from '@/stores/walkStore';

// ストアは defineStore の中で ref を作るため、テストごとに新しい pinia を立てて
// 前のテストの状態を持ち越さないようにする
beforeEach(() => {
  setActivePinia(createPinia());
});

describe('measurementStatus', () => {
  test('一度も測位できていない場合は unavailable を返す', () => {
    const walkStore = useWalkStore();

    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.UNAVAILABLE);
  });

  test('測位できたが距離が0の場合は partial を返す', () => {
    const walkStore = useWalkStore();

    walkStore.markLocationFixed();

    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.PARTIAL);
  });

  test('測位できて距離も積めた場合は complete を返す', () => {
    const walkStore = useWalkStore();

    walkStore.markLocationFixed();
    walkStore.addDistanceM(50);

    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.COMPLETE);
  });

  test('距離を積めていても欠落を検知していれば partial を返す', () => {
    const walkStore = useWalkStore();

    walkStore.markLocationFixed();
    walkStore.addDistanceM(50);
    walkStore.markMeasurementGap();

    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.PARTIAL);
  });

  test('欠落を検知した後は測位や加算を重ねても partial から戻らない', () => {
    const walkStore = useWalkStore();

    walkStore.markMeasurementGap();
    walkStore.markLocationFixed();
    walkStore.addDistanceM(50);
    walkStore.addDistanceM(120);

    expect(walkStore.hasMeasurementGap).toBe(true);
    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.PARTIAL);
  });

  test('測位できていない場合は欠落の有無より unavailable を優先する', () => {
    const walkStore = useWalkStore();

    walkStore.markMeasurementGap();

    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.UNAVAILABLE);
  });
});

describe('計測状態の記録', () => {
  test('距離を加算できた場合は lastDistanceAddedAt を更新する', () => {
    const walkStore = useWalkStore();

    expect(walkStore.lastDistanceAddedAt).toBeNull();

    walkStore.addDistanceM(50);

    expect(walkStore.totalDistanceM).toBe(50);
    expect(Number.isFinite(walkStore.lastDistanceAddedAt)).toBe(true);
  });

  test('無効な距離では lastDistanceAddedAt も総距離も変えない', () => {
    const walkStore = useWalkStore();

    walkStore.addDistanceM(Number.NaN);
    walkStore.addDistanceM(undefined);

    expect(walkStore.totalDistanceM).toBe(0);
    expect(walkStore.lastDistanceAddedAt).toBeNull();
  });

  test('startWalk は欠落の記録と最後に積めた時刻を初期化する', () => {
    const walkStore = useWalkStore();

    // 1回目の散歩で欠落を検知し、距離も積んだ状態を作る
    walkStore.startWalk();
    walkStore.markLocationFixed();
    walkStore.addDistanceM(50);
    walkStore.markMeasurementGap();

    // 2回目の散歩を開始すると前回の状態が残らない
    walkStore.startWalk();

    expect(walkStore.hasMeasurementGap).toBe(false);
    expect(walkStore.lastDistanceAddedAt).toBeNull();
    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.UNAVAILABLE);
  });

  test('resetWalk は欠落の記録と最後に積めた時刻を初期化する', () => {
    const walkStore = useWalkStore();

    walkStore.markLocationFixed();
    walkStore.addDistanceM(50);
    walkStore.markMeasurementGap();

    walkStore.resetWalk();

    expect(walkStore.hasMeasurementGap).toBe(false);
    expect(walkStore.lastDistanceAddedAt).toBeNull();
    expect(walkStore.measurementStatus).toBe(MEASUREMENT_STATUS.UNAVAILABLE);
  });
});
