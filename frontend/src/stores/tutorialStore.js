import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { TUTORIAL_STEP, TUTORIAL_STEPS } from '@/constants/tutorialSteps';

/**
 * @description チュートリアルの進行状態を保持するグローバルストア。
 * 複数の画面をまたいで「チュートリアル中か」「今どのステップか」を参照するため、
 * Piniaで一元管理する。
 *
 * チュートリアルは一本道で、ステップは TUTORIAL_STEPS の並び順に進む。
 * 各画面は currentStep を見て、ハイライトする要素と吹き出しの文言を決める。
 */
export const useTutorialStore = defineStore('tutorial', () => {
  /** チュートリアル中かどうか */
  const isActive = ref(false);

  /** 今のステップの位置（TUTORIAL_STEPS のインデックス）。非チュートリアル中は-1 */
  const stepIndex = ref(-1);

  /** 今のステップの定義。非チュートリアル中はnull */
  const currentStepDefinition = computed(() =>
    isActive.value ? (TUTORIAL_STEPS[stepIndex.value] ?? null) : null
  );

  /** 今のステップ名（TUTORIAL_STEP のいずれか）。非チュートリアル中はnull */
  const currentStep = computed(() => currentStepDefinition.value?.step ?? null);

  /** 今のステップで案内役が話す文言。非チュートリアル中はnull */
  const currentMessage = computed(() => currentStepDefinition.value?.message ?? null);

  /**
   * @description チュートリアルを開始する。最初のステップ（ジャンル選択）から始める。
   * @returns {void}
   */
  const start = () => {
    isActive.value = true;
    stepIndex.value = 0;
  };

  /**
   * @description 指定したステップが今のステップなら、次のステップへ進める。
   * 画面側の操作（ジャンル選択・ボタン押下など）に応じて呼ばれる。
   * 今のステップと一致しない操作では何もしないため、想定外の順序では進まない。
   * @param {string} step 完了したとみなすステップ名（TUTORIAL_STEP のいずれか）
   * @returns {void}
   */
  const completeStep = (step) => {
    if (!isActive.value || currentStep.value !== step) {
      return;
    }

    if (stepIndex.value < TUTORIAL_STEPS.length - 1) {
      stepIndex.value += 1;
    }
  };

  /**
   * @description 指定したステップが今のステップなら、1つ前のステップへ戻す。
   * 画面側の「前の目的地へ」のような戻し操作に合わせて呼ばれる。
   * 今のステップと一致しない操作では何もしないため、想定外の順序では戻さない。
   * 先頭のステップより前には戻さない。
   * @param {string} step 戻す起点とみなす今のステップ名（TUTORIAL_STEP のいずれか）
   * @returns {void}
   */
  const revertStep = (step) => {
    if (!isActive.value || currentStep.value !== step) {
      return;
    }

    if (stepIndex.value > 0) {
      stepIndex.value -= 1;
    }
  };

  /**
   * @description 今のステップを1つ前へ戻す（ステップ名を問わない）。
   * 「前の目的地へ」でフォームの案内を1つ前の解説へ戻すなど、
   * 今のステップに関係なく戻したいときに使う。先頭より前には戻さない。
   * @returns {void}
   */
  const goBack = () => {
    if (!isActive.value) {
      return;
    }

    if (stepIndex.value > 0) {
      stepIndex.value -= 1;
    }
  };

  /**
   * @description チュートリアルを終了して初期状態へ戻す
   * @returns {void}
   */
  const finish = () => {
    isActive.value = false;
    stepIndex.value = -1;
  };

  /**
   * @description 指定したステップが今のステップかどうかを返す。
   * 画面側でハイライト対象を判定するために使う。
   * @param {string} step 判定したいステップ名（TUTORIAL_STEP のいずれか）
   * @returns {boolean} 今のステップと一致する場合はtrue
   */
  const isStep = (step) => isActive.value && currentStep.value === step;

  return {
    isActive,
    currentStep,
    currentMessage,
    start,
    completeStep,
    revertStep,
    goBack,
    finish,
    isStep,
    // ステップ名の定数を画面から参照できるように再公開する
    STEP: TUTORIAL_STEP
  };
});
