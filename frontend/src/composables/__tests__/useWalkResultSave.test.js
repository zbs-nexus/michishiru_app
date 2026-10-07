import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useWalkResultSave } from '@/composables/useWalkResultSave';
import { saveWalkResult } from '@/services/walkResultService';
import {
  addPendingWalkResult,
  loadPendingWalkResults
} from '@/utils/pendingWalkResults';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description 保存の成否で退避キューがどう動くかを確かめるテスト。
 * 通信そのものは walkResultService のテストで固定しているため、ここでは
 * 「どの失敗を退避し、どの失敗を捨てるか」の判断と、再送の後始末、
 * そして「誰の実績として送るか」を見る。
 */

vi.mock('@/services/walkResultService', () => ({
  saveWalkResult: vi.fn(async () => ({ walkId: 'dummy', isAlreadySaved: false }))
}));

/** crypto.randomUUID を固定するための値 */
const FIXED_WALK_ID = '018f8a6f-0f4a-4a1e-9d6f-2f1c3b4d5e6f';

/** 退避と再送を行う利用者のユーザー名 */
const OWNER_USERNAME = 'walker-a';

/**
 * @description 指定した name を持つ保存の失敗を作る
 * @param {string} name 例外の名前
 * @returns {Error} 保存の失敗
 */
const createSaveError = (name) => {
  const error = new Error('保存に失敗しました');
  error.name = name;

  return error;
};

/**
 * @description 案内を終えた直後のストアの状態を作る
 * @returns {void}
 */
const completeWalk = () => {
  const routeStore = useRouteStore();
  const walkStore = useWalkStore();

  routeStore.selectGenre('nature', '自然');
  routeStore.setCurrentRoute({ routeName: '公園めぐりコース' });

  walkStore.startWalk();
  walkStore.markLocationFixed();
  walkStore.addDistanceM(1234.56);
  walkStore.setVisitedSpotIds(['spot-1', 'spot-2']);
  walkStore.endWalk();
};

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
  // 保存APIは認可が必要なため、サインイン済みを前提にする
  useAuthStore().username = OWNER_USERNAME;
  // 再試行不可の失敗では詳細をコンソールへ回すため、テストの出力を汚さないよう抑える
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(saveWalkResult).mockReset();
  vi.mocked(saveWalkResult).mockResolvedValue({
    walkId: FIXED_WALK_ID,
    isAlreadySaved: false
  });
  // walkId は冪等キーのため、送った値と退避した値を突き合わせられるよう固定する
  vi.stubGlobal('crypto', { randomUUID: () => FIXED_WALK_ID });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('saveCurrentWalkResult', () => {
  test('ストアの実績をAPIの形へ変換して送る', async () => {
    completeWalk();

    const { saveCurrentWalkResult } = useWalkResultSave();

    await saveCurrentWalkResult();

    const [payload] = vi.mocked(saveWalkResult).mock.calls[0];

    expect(payload).toMatchObject({
      walkId: FIXED_WALK_ID,
      // ストアはメートルの小数、APIは整数のメートル
      totalDistanceM: 1235,
      spotCount: 2,
      measurementStatus: 'complete',
      routeTitle: '公園めぐりコース',
      // 日本語の表示名ではなく英語のジャンルIDを送る
      genreId: 'nature'
    });
    // ストアはエポックms、APIはISO 8601
    expect(payload.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(payload.endedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test('保存できた場合は退避しない', async () => {
    completeWalk();

    const { saveCurrentWalkResult } = useWalkResultSave();

    await expect(saveCurrentWalkResult()).resolves.toBe(true);
    expect(loadPendingWalkResults()).toEqual([]);
  });

  test('再試行可の失敗では退避キューへ積み、文言を残す', async () => {
    completeWalk();
    vi.mocked(saveWalkResult).mockRejectedValue(
      createSaveError('WalkResultSaveRetryable')
    );

    const { saveCurrentWalkResult, saveErrorMessage } = useWalkResultSave();

    await expect(saveCurrentWalkResult()).resolves.toBe(false);

    const pendingResults = loadPendingWalkResults();

    expect(pendingResults).toHaveLength(1);
    expect(pendingResults[0].walkId).toBe(FIXED_WALK_ID);
    expect(saveErrorMessage.value).toBe(
      '保存できませんでした。通信が回復したときに自動で保存します'
    );
  });

  test('退避する実績には持ち主のユーザー名を控える', async () => {
    completeWalk();
    vi.mocked(saveWalkResult).mockRejectedValue(
      createSaveError('WalkResultSaveRetryable')
    );

    const { saveCurrentWalkResult } = useWalkResultSave();

    await saveCurrentWalkResult();

    const [pendingResult] = loadPendingWalkResults();

    // 持ち主が分からないと、別のユーザーがサインインしたときにその人の累計へ入る
    expect(pendingResult.ownerUsername).toBe(OWNER_USERNAME);
    expect(pendingResult.walkResult.walkId).toBe(FIXED_WALK_ID);
  });

  test('再試行不可の失敗では退避せず、サーバーの文言は画面へ出さない', async () => {
    completeWalk();
    vi.mocked(saveWalkResult).mockRejectedValue(
      createSaveError('WalkResultSaveRejected')
    );

    const { saveCurrentWalkResult, saveErrorMessage } = useWalkResultSave();

    await expect(saveCurrentWalkResult()).resolves.toBe(false);

    // 積むと通信が回復するたびに永久に送り続けることになる
    expect(loadPendingWalkResults()).toEqual([]);
    // 内部向けの検証メッセージは利用者には意味がないため載せない
    expect(saveErrorMessage.value).toBe('実績を保存できませんでした');
  });

  test('案内を経ていない場合は送らない', async () => {
    const routeStore = useRouteStore();

    routeStore.setCurrentRoute({ routeName: '公園めぐりコース' });

    const { saveCurrentWalkResult } = useWalkResultSave();

    // startedAt が未設定のまま送ると 1970-01-01 の実績が残る
    await expect(saveCurrentWalkResult()).resolves.toBe(true);
    expect(vi.mocked(saveWalkResult)).not.toHaveBeenCalled();
  });

  test('セッションが失効していた場合は退避キューへ積む', async () => {
    completeWalk();
    vi.mocked(saveWalkResult).mockRejectedValue(createSaveError('NoValidSession'));

    const { saveCurrentWalkResult } = useWalkResultSave();

    await expect(saveCurrentWalkResult()).resolves.toBe(false);

    // 再ログインすれば送れるため、捨てずに残す
    expect(loadPendingWalkResults()).toHaveLength(1);
  });
});

describe('flushPendingWalkResults', () => {
  test('送信できた実績をキューから消す', async () => {
    completeWalk();
    vi.mocked(saveWalkResult).mockRejectedValueOnce(
      createSaveError('WalkResultSaveRetryable')
    );

    const { saveCurrentWalkResult, flushPendingWalkResults } = useWalkResultSave();

    await saveCurrentWalkResult();
    expect(loadPendingWalkResults()).toHaveLength(1);

    await flushPendingWalkResults();

    expect(loadPendingWalkResults()).toEqual([]);

    // 送るのはAPIのボディだけで、退避のために付けた持ち主は含めない
    const [payload] = vi.mocked(saveWalkResult).mock.calls.at(-1);

    expect(payload.walkId).toBe(FIXED_WALK_ID);
    expect(Object.hasOwn(payload, 'ownerUsername')).toBe(false);
  });

  test('再試行不可の失敗になった実績はキューから捨てる', async () => {
    completeWalk();
    vi.mocked(saveWalkResult).mockRejectedValueOnce(
      createSaveError('WalkResultSaveRetryable')
    );

    const { saveCurrentWalkResult, flushPendingWalkResults } = useWalkResultSave();

    await saveCurrentWalkResult();

    vi.mocked(saveWalkResult).mockRejectedValue(
      createSaveError('WalkResultSaveRejected')
    );

    await flushPendingWalkResults();

    // 残すと毎回失敗を繰り返し、後ろに並ぶ送れるはずの実績まで止めてしまう
    expect(loadPendingWalkResults()).toEqual([]);
  });

  test('通信が回復していない場合はキューに残したまま切り上げる', async () => {
    completeWalk();
    vi.mocked(saveWalkResult).mockRejectedValue(
      createSaveError('WalkResultSaveRetryable')
    );

    const { saveCurrentWalkResult, flushPendingWalkResults } = useWalkResultSave();

    await saveCurrentWalkResult();
    await flushPendingWalkResults();

    expect(loadPendingWalkResults()).toHaveLength(1);
  });

  test('別のユーザーが退避した実績は送らずキューに残す', async () => {
    addPendingWalkResult({
      walkId: 'walk-of-another-user',
      ownerUsername: 'walker-b',
      walkResult: { walkId: 'walk-of-another-user' }
    });

    const { flushPendingWalkResults } = useWalkResultSave();

    await flushPendingWalkResults();

    // 送るとサインイン中の利用者の累計へ加算され、本来の持ち主からは失われる
    expect(vi.mocked(saveWalkResult)).not.toHaveBeenCalled();
    expect(loadPendingWalkResults()).toHaveLength(1);
  });

  test('サインインしていない場合は送らない', async () => {
    const authStore = useAuthStore();

    addPendingWalkResult({
      walkId: FIXED_WALK_ID,
      ownerUsername: OWNER_USERNAME,
      walkResult: { walkId: FIXED_WALK_ID }
    });

    authStore.username = null;

    const { flushPendingWalkResults } = useWalkResultSave();

    await flushPendingWalkResults();

    expect(vi.mocked(saveWalkResult)).not.toHaveBeenCalled();
    expect(loadPendingWalkResults()).toHaveLength(1);
  });
});
