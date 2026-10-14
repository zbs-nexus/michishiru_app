import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  addPendingWalkResult,
  loadPendingWalkResults,
  removePendingWalkResult
} from '@/utils/pendingWalkResults';

/**
 * @description 保存に失敗した実績の退避キューを確かめるテスト。
 * 退避は best effort のため、「積める・読める・消せる」ことに加えて
 * 「壊れていても・書き込めなくても呼び出し側を止めない」ことを見る。
 */

/** 退避した実績を入れるキー。実装側の STORAGE_KEY と揃える */
const STORAGE_KEY = 'michishiru.pendingWalkResults';

/** 退避できる最大件数。実装側の MAX_PENDING_COUNT と揃える */
const MAX_PENDING_COUNT = 20;

/**
 * @description 退避する実績の最小形を作る
 * @param {string} walkId 散歩のID
 * @returns {object} 退避する実績
 */
const createWalkResult = (walkId) => ({
  walkId,
  totalDistanceM: 1200,
  spotCount: 3,
  elapsedMinutes: 25,
  startedAt: '2026-10-07T01:00:00.000Z',
  endedAt: '2026-10-07T01:25:00.000Z',
  measurementStatus: 'complete',
  routeTitle: '公園めぐりコース',
  genreId: 'nature'
});

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('pendingWalkResults', () => {
  test('積んだ実績をそのまま読み出せる', () => {
    addPendingWalkResult(createWalkResult('walk-a'));

    expect(loadPendingWalkResults()).toEqual([createWalkResult('walk-a')]);
  });

  test('同じwalkIdを積み直しても件数が増えず、新しい内容へ置き換わる', () => {
    addPendingWalkResult(createWalkResult('walk-a'));
    addPendingWalkResult({ ...createWalkResult('walk-a'), spotCount: 5 });

    const pendingResults = loadPendingWalkResults();

    // 再送が失敗して積み直された場合に同じ散歩が増えてはいけない
    expect(pendingResults).toHaveLength(1);
    expect(pendingResults[0].spotCount).toBe(5);
  });

  test('送信できた実績はキューから取り除ける', () => {
    addPendingWalkResult(createWalkResult('walk-a'));
    addPendingWalkResult(createWalkResult('walk-b'));

    removePendingWalkResult('walk-a');

    expect(loadPendingWalkResults().map((result) => result.walkId)).toEqual([
      'walk-b'
    ]);
  });

  test('上限を超えたら古いものから捨てる', () => {
    for (let index = 0; index < MAX_PENDING_COUNT + 2; index += 1) {
      addPendingWalkResult(createWalkResult(`walk-${index}`));
    }

    const pendingResults = loadPendingWalkResults();

    expect(pendingResults).toHaveLength(MAX_PENDING_COUNT);
    // 先頭2件（walk-0 / walk-1）が落ち、最後に積んだものが残る
    expect(pendingResults.at(0).walkId).toBe('walk-2');
    expect(pendingResults.at(-1).walkId).toBe(`walk-${MAX_PENDING_COUNT + 1}`);
  });

  test('壊れた値が入っていても空の配列を返す', () => {
    localStorage.setItem(STORAGE_KEY, '{壊れたJSON');

    expect(loadPendingWalkResults()).toEqual([]);
  });

  test('ストレージへ書き込めない環境でも例外を投げない', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    // 退避できないことを利用者に見せる必要はなく、保存失敗の通知まで
    // 巻き込んで落ちてはいけない
    expect(() => addPendingWalkResult(createWalkResult('walk-a'))).not.toThrow();
    expect(() => removePendingWalkResult('walk-a')).not.toThrow();
  });
});
