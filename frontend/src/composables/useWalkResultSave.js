import { ref } from 'vue';
import { saveWalkResult } from '@/services/walkResultService';
import {
  addPendingWalkResult,
  loadPendingWalkResults,
  removePendingWalkResult
} from '@/utils/pendingWalkResults';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description 散歩の実績をサーバーへ保存し、送れなかった分の退避と再送を受け持つ composable。
 *
 * 保存の起点は結果画面（`WalkResultView.vue`）で、案内画面の遷移は保存を待たない。
 * 再送の起点はアプリのルート（`App.vue`）で、ログイン時と通信の復帰時に呼ばれる。
 *
 * 退避する実績には、送る内容とは別に持ち主（`ownerUsername`）を控える。
 * 保存APIは送られてきたIDトークンの `sub` を利用者とするため、持ち主を見ずに
 * 再送すると、同じ端末で別のユーザーがサインインしたときにその人の累計へ
 * 加算されてしまう（`localStorage` はサインアウトでは消えない）。
 */

/**
 * 再送中かどうか。
 *
 * `ref` ではなく素の変数にしているのは、この旗がインスタンスをまたいで効く必要があるため。
 * 再送の引き金は「ログイン」と「online への復帰」の2つで、ほぼ同時に起きうる。
 * composable のインスタンス内に閉じた `ref` だと、別の呼び出しが並行して走り
 * 同じ実績を2回送ってしまう。テンプレートから読む値でもないためリアクティブにしない。
 */
let isFlushing = false;

/**
 * @description 時間を置けば送れる見込みがある失敗かどうかを判定する
 * @param {Error} error 発生した例外
 * @returns {boolean} 退避してもう一度送る価値がある場合はtrue
 */
const isRetryableError = (error) =>
  error?.name === 'WalkResultSaveRetryable' || error?.name === 'NoValidSession';

/** 再試行可の失敗で出す文言 */
const RETRYABLE_ERROR_MESSAGE =
  '保存できませんでした。通信が回復したときに自動で保存します';

/**
 * 再試行不可の失敗で出す文言。
 *
 * 例外のメッセージは載せない。400 のときの中身はサーバーの検証結果
 * （`walkId はUUID v4の形式で指定してください` 等）で、利用者には意味がなく
 * 打てる手もない。調査に必要な詳細はコンソールへ回す。
 */
const REJECTED_ERROR_MESSAGE = '実績を保存できませんでした';

/**
 * @description 散歩の実績の保存・退避・再送を扱う
 * @returns {object} 保存中かどうか・失敗の文言・保存と再送の関数
 */
export const useWalkResultSave = () => {
  const authStore = useAuthStore();
  const routeStore = useRouteStore();
  const walkStore = useWalkStore();

  /** 保存の通信中かどうか */
  const isSaving = ref(false);

  /** 直近の保存の失敗の理由。成功時はnull */
  const saveErrorMessage = ref(null);

  /**
   * @description 現在の実績から、APIへ送るリクエストボディを組み立てる。
   *
   * ストアと API の表現の違いをこの1か所に閉じ込める。
   * - 時刻: ストアはエポックms、APIはISO 8601
   * - 距離: ストアは小数を含むメートル、APIは整数のメートル
   * - ジャンル: APIは英語のID（`nature`）のみを受け付けるため、
   *   表示名（`genreName`）ではなく `genre`（genreId）を送る
   *
   * `walkId` は冪等キーのため、送信のたびではなくこの組み立て時に1回だけ決める。
   * `crypto.randomUUID()` はセキュアコンテキスト（HTTPS / localhost）でのみ使えるが、
   * CloudFront がHTTPSを強制し、ローカルは localhost のため常に満たされる。
   * @returns {object} リクエストボディ
   */
  const buildCurrentWalkResult = () => ({
    walkId: crypto.randomUUID(),
    totalDistanceM: Math.round(walkStore.totalDistanceM),
    spotCount: walkStore.spotCount,
    elapsedMinutes: walkStore.elapsedMinutes,
    startedAt: new Date(walkStore.startedAt).toISOString(),
    // 終了時刻は案内画面の endWalk で確定するが、万一未設定なら現在時刻で代える
    endedAt: new Date(walkStore.endedAt ?? Date.now()).toISOString(),
    measurementStatus: walkStore.measurementStatus,
    routeTitle: routeStore.currentRoute?.routeName ?? '',
    genreId: routeStore.genre ?? ''
  });

  /**
   * @description 今回の散歩の実績を保存する。
   * 失敗した場合、送り直す価値があるものだけを退避キューへ積む。
   * @returns {Promise<boolean>} 保存できたかどうか
   */
  const saveCurrentWalkResult = async () => {
    // 案内を経ていない状態（startedAt が未設定）では、送っても
    // 1970-01-01 の実績が残るだけで記録としての意味がない。
    // 保存するものが無いだけなので、失敗としては扱わない（トーストも出さない）
    if (walkStore.startedAt === null) {
      return true;
    }

    isSaving.value = true;
    saveErrorMessage.value = null;

    // 送信の前に値を確定させる。結果画面は「ホームに戻る」で resetWalk() を呼ぶため、
    // 通信の待ち合わせ中にストアが初期化されても送る内容が変わらないようにする
    const walkResult = buildCurrentWalkResult();

    try {
      await saveWalkResult(walkResult);

      return true;
    } catch (error) {
      if (isRetryableError(error)) {
        addPendingWalkResult({
          walkId: walkResult.walkId,
          // 再送するときに、この実績を誰のものとして送るかを決めるために控える
          ownerUsername: authStore.username,
          walkResult
        });
        saveErrorMessage.value = RETRYABLE_ERROR_MESSAGE;
      } else {
        // 入力不正などは何度送っても同じ結果になるため退避しない。
        // 積むと通信が回復するたびに永久に送り続けることになる
        console.error('散歩の実績を保存できませんでした', error);
        saveErrorMessage.value = REJECTED_ERROR_MESSAGE;
      }

      return false;
    } finally {
      isSaving.value = false;
    }
  };

  /**
   * @description 退避している実績をまとめて送り直す。
   *
   * 成否はトーストで知らせない。結果画面を離れた後に静かに動く処理で、
   * 成功しても失敗しても利用者の操作は変わらないため、割り込む理由がない。
   * @returns {Promise<void>}
   */
  const flushPendingWalkResults = async () => {
    // ログインと online への復帰がほぼ同時に起きても、同じ実績を2回送らない
    if (isFlushing) {
      return;
    }

    // サインインしていなければ、送っても誰の実績になるか決まらない
    if (!authStore.isSignedIn) {
      return;
    }

    isFlushing = true;

    try {
      for (const pendingResult of loadPendingWalkResults()) {
        // 退避した本人がサインインしているときだけ送る。別のユーザーの分は
        // 消さずに残し、その人がサインインしたときに送られるようにする
        if (pendingResult.ownerUsername !== authStore.username) {
          continue;
        }

        try {
          await saveWalkResult(pendingResult.walkResult);
          removePendingWalkResult(pendingResult.walkId);
        } catch (error) {
          if (!isRetryableError(error)) {
            // 送り直しても通らない内容は捨てる。残すと毎回失敗を繰り返し、
            // 後ろに並ぶ送れるはずの実績まで止めてしまう
            removePendingWalkResult(pendingResult.walkId);
            continue;
          }

          // 通信が回復していないなら後続も同じ結果になるため、ここで切り上げる
          break;
        }
      }
    } finally {
      isFlushing = false;
    }
  };

  return {
    isSaving,
    saveErrorMessage,
    saveCurrentWalkResult,
    flushPendingWalkResults
  };
};
