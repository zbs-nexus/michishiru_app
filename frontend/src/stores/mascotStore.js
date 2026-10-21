import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { DEFAULT_MASCOT_LEVEL } from '@/constants/mascotLevels';
import { fetchUserExperience } from '@/services/experienceService';
import {
  toExperiencePoints,
  toMascotLevelProgress
} from '@/utils/mascotLevelProgress';

/**
 * @description マスコットのレベルのもとになる実績を保持するグローバルストア。
 *
 * ホーム・ロード・案内・結果の4画面がマスコットを出すため、画面ごとに取得すると
 * 同じAPIを何度も叩くうえ、画面間でレベルがずれて見える。画面をまたいで同じ値を
 * 読めるようにするためPiniaで一元管理する。
 *
 * 1回の散歩の実績は walkStore が持つ。こちらは全散歩の累計と投稿件数（＝成長の度合い）を扱う。
 */
export const useMascotStore = defineStore('mascot', () => {
  /** 全散歩の距離の合計（メートル） */
  const cumulativeDistanceM = ref(0);

  /** 全散歩の経過時間の合計（分） */
  const cumulativeMinutes = ref(0);

  /** 利用者が投稿した口コミの件数 */
  const reviewCount = ref(0);

  /**
   * 実績を取得できたかどうか。
   * 取得前・取得失敗の場合は false で、このときレベルは Lv.1 のまま経験値バーも出さない。
   * 0で取得できた場合（まだ何もしていない利用者）と区別するために持つ
   */
  const hasExperience = ref(false);

  /**
   * 実績の取得を一度でも終えたか（成功・失敗を問わない）。
   * ホーム画面は取得が終わるまでマスコットを出さず、取得前の Lv.1（卵）が
   * 一瞬ちらつくのを防ぐ。失敗しても true になり、Lv.1 で表示へ進む
   * （いつまでも何も出ない状態にしないため）。
   */
  const isExperienceLoaded = ref(false);

  /**
   * 直近の散歩で上がったレベルの一覧（経由レベルを含む昇順。例: [4, 5]）。
   * 案内画面の終了処理で判定して積み、結果画面が読んでお祝い演出に見せる。
   * 画面をまたいで受け渡すためストアに持つ（判定は遷移前、表示は遷移後のため）。
   * 空ならレベルアップなし。
   */
  const pendingLevelUpLevels = ref([]);

  /** 実績から求めた累計経験値 */
  const totalExperiencePoints = computed(() =>
    toExperiencePoints({
      cumulativeDistanceM: cumulativeDistanceM.value,
      cumulativeMinutes: cumulativeMinutes.value,
      reviewCount: reviewCount.value
    })
  );

  /** 現在のレベルとレベル内の進捗 */
  const levelProgress = computed(() =>
    toMascotLevelProgress(totalExperiencePoints.value)
  );

  /**
   * 画面に出すマスコットのレベル。
   * 実績を取得できていない場合は、推測で高いレベルを出さず既定（Lv.1）にする
   */
  const mascotLevel = computed(() =>
    hasExperience.value ? levelProgress.value.mascotLevel : DEFAULT_MASCOT_LEVEL
  );

  /**
   * @description 実績を取得して保持する。
   * 失敗しても例外を投げず、Lv.1・バー無しの状態で続行する。
   * 経験値は副次的な情報で、取得できないからといって散歩そのものを
   * 止めてはいけないため（useReviewSpots のピン表示と同じ方針）。
   * @returns {Promise<void>}
   */
  const loadExperience = async () => {
    try {
      const experience = await fetchUserExperience();

      cumulativeDistanceM.value = experience.cumulativeDistanceM ?? 0;
      cumulativeMinutes.value = experience.cumulativeMinutes ?? 0;
      reviewCount.value = experience.reviewCount ?? 0;
      hasExperience.value = true;
    } catch {
      // 取得できなかったことを hasExperience で示し、画面はバーを出さずに続ける
      cumulativeDistanceM.value = 0;
      cumulativeMinutes.value = 0;
      reviewCount.value = 0;
      hasExperience.value = false;
    } finally {
      // 成否にかかわらず「取得を終えた」ことを示す。
      // ホームはこれを待ってからマスコットを出す（取得前のちらつきを防ぐ）
      isExperienceLoaded.value = true;
    }
  };

  /**
   * @description 散歩を終えた後に、実績を取り直してレベルアップを判定する。
   *
   * 案内画面の終了処理から、実績の保存が終わった後に呼ぶ。保存後に取り直すことで
   * 今回の散歩を含む累計が反映され、取り直す前後のレベルを比べてレベルアップを拾える。
   * 上がっていれば、開始レベルの次から到達レベルまで（経由レベルを含む）を
   * `pendingLevelUpLevels` へ積む。結果画面がこれを読んでお祝い演出に見せる。
   *
   * 境界条件（いずれもレベルアップなしとして空のまま）:
   * - 取り直す前に実績を取得できていない（散歩前のレベルが不明）
   * - 取り直しに失敗した（hasExperience が false）
   * - レベルが上がっていない（位置情報なしで経験値が増えなかった場合もここに落ちる）
   * @returns {Promise<void>}
   */
  const refreshAndDetectLevelUp = async () => {
    // 取り直す前のレベルを控える。未取得の状態では mascotLevel が Lv.1 に
    // 落ちており散歩前の実際のレベルではないため、基準に使えない。null にして
    // 後の比較でレベルアップと誤判定しないようにする
    const levelBeforeWalk = isExperienceLoaded.value ? mascotLevel.value : null;

    await loadExperience();

    // 取得失敗、または散歩前のレベルが不明なら判定できない
    if (!hasExperience.value || levelBeforeWalk === null) {
      pendingLevelUpLevels.value = [];

      return;
    }

    const levelAfterWalk = mascotLevel.value;

    if (levelAfterWalk <= levelBeforeWalk) {
      pendingLevelUpLevels.value = [];

      return;
    }

    // 開始レベルの次から到達レベルまでを順に見せる（複数上がれば経由レベルも1段ずつ）
    const levels = [];
    for (let level = levelBeforeWalk + 1; level <= levelAfterWalk; level += 1) {
      levels.push(level);
    }

    pendingLevelUpLevels.value = levels;
  };

  /**
   * @description お祝い演出を見せ終えたら、積んだレベルアップを消す。
   * 結果画面で演出を閉じたときに呼ぶ。消さないと、次に結果画面へ来たとき
   * 同じ演出がもう一度出てしまう。
   * @returns {void}
   */
  const clearPendingLevelUp = () => {
    pendingLevelUpLevels.value = [];
  };

  /**
   * @description 実績を初期状態へ戻す。
   * サインアウト時に呼び、次に使う人へ前の利用者のレベルが残らないようにする。
   * @returns {void}
   */
  const resetExperience = () => {
    cumulativeDistanceM.value = 0;
    cumulativeMinutes.value = 0;
    reviewCount.value = 0;
    hasExperience.value = false;
    isExperienceLoaded.value = false;
    pendingLevelUpLevels.value = [];
  };

  return {
    cumulativeDistanceM,
    cumulativeMinutes,
    reviewCount,
    hasExperience,
    isExperienceLoaded,
    pendingLevelUpLevels,
    totalExperiencePoints,
    levelProgress,
    mascotLevel,
    loadExperience,
    refreshAndDetectLevelUp,
    clearPendingLevelUp,
    resetExperience
  };
});
