import { computed, ref } from 'vue';
import { useMascotStore } from '@/stores/mascotStore';

/**
 * @description 散歩の結果画面で、今終えた散歩によってマスコットのレベルが
 * 上がったかどうかを検知し、お祝い演出に見せるレベルの一覧を持つ composable。
 *
 * レベルアップの検知は「取り直す前のレベル」と「取り直した後のレベル」を比べて行う。
 * 結果画面の onMounted は保存 → `loadExperience()` の順で、取り直した後に
 * 今回の散歩を含むレベルが `mascotStore.mascotLevel` に入る。そこで
 * `loadExperience()` を呼ぶ直前に散歩前のレベルを控え、呼んだ後のレベルと比べる。
 *
 * この検知を「常にストアが持つ」設計にしないのは、`loadExperience()` が
 * ホーム・提案画面でも呼ばれるため。散歩直後にホームへ入り直すと誤って
 * 演出が出かねない。検知と状態の保持は結果画面が使うこの composable に閉じ込め、
 * ストアには手を入れない。
 */
export const useMascotLevelUp = () => {
  const mascotStore = useMascotStore();

  /**
   * 散歩前のレベル。`captureBeforeLoad()` で控える。
   * 散歩前のレベルが分からない（実績未取得でこの画面に来た）場合は null にして、
   * 誤って Lv.1 からの大量レベルアップ演出を出さないようにする。
   */
  const levelBeforeWalk = ref(null);

  /** お祝い演出を表示中かどうか */
  const isCelebrationVisible = ref(false);

  /**
   * 演出で順に見せるレベルの一覧（経由レベルを含む昇順。例: [4, 5]）。
   * 開始レベルの次から到達レベルまでを並べる。
   */
  const celebrationLevels = ref([]);

  /**
   * @description `loadExperience()` を呼ぶ前に、今の時点のレベルを控える。
   *
   * この画面に来た時点でストアに実績が入っているとは限らない。案内画面を
   * 経由してきた場合はホームで取得済みのはずだが、取得前・取得失敗の状態で
   * 来た場合は散歩前のレベルが分からない。そのときは null を控え、
   * 後の比較でレベルアップと誤判定しないようにする。
   * @returns {void}
   */
  const captureBeforeLoad = () => {
    // 実績を取得できていない状態では mascotLevel は既定（Lv.1）に落ちており、
    // 散歩前の実際のレベルではない。比較の基準として使えないため控えない
    levelBeforeWalk.value = mascotStore.isExperienceLoaded
      ? mascotStore.mascotLevel
      : null;
  };

  /**
   * @description `loadExperience()` を呼んだ後に、レベルアップを判定して演出を起こす。
   *
   * 境界条件は次のとおり扱う（いずれも演出を出さない）。
   * - 実績の取得に失敗した（hasExperience が false）
   * - 散歩前のレベルが不明（この画面に来た時点で実績未取得だった）
   * - レベルが上がっていない
   * 位置情報を取得できなかった散歩は経験値が増えずレベルも上がらないため、
   * この判定で自然に「上がっていない」に落ち、特別な分岐は要らない。
   * @returns {void}
   */
  const detectLevelUp = () => {
    // 取得に失敗していれば今のレベルが信用できないため出さない
    if (!mascotStore.hasExperience) {
      return;
    }

    // 散歩前のレベルが分からなければ比較できないため出さない
    if (levelBeforeWalk.value === null) {
      return;
    }

    const levelAfterWalk = mascotStore.mascotLevel;

    if (levelAfterWalk <= levelBeforeWalk.value) {
      return;
    }

    // 開始レベルの次から到達レベルまでを順に見せる（Lv.10 が上限なのでそこで止まる）。
    // 複数レベル上がった場合は経由レベルも1段ずつ見せる
    const levels = [];
    for (let level = levelBeforeWalk.value + 1; level <= levelAfterWalk; level += 1) {
      levels.push(level);
    }

    celebrationLevels.value = levels;
    isCelebrationVisible.value = true;
  };

  /**
   * @description 演出を閉じる。最後の段で閉じたときに結果画面が呼ぶ。
   * @returns {void}
   */
  const closeCelebration = () => {
    isCelebrationVisible.value = false;
  };

  /** 演出を出すだけのレベルアップがあったか（テンプレートの出し分け用） */
  const hasCelebration = computed(() => celebrationLevels.value.length > 0);

  return {
    isCelebrationVisible,
    celebrationLevels,
    hasCelebration,
    captureBeforeLoad,
    detectLevelUp,
    closeCelebration
  };
};
