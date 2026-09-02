import { computed, ref } from 'vue';
import { fetchConditionOptions } from '@/services/conditionService';
import { useRouteStore } from '@/stores/routeStore';
import { DEFAULT_DISTANCE_KM } from '@/constants/routeConditions';

/**
 * @description 値を指定範囲内に収める
 * @param {number} value 対象の値
 * @param {number} minValue 下限
 * @param {number} maxValue 上限
 * @returns {number} 範囲内に収めた値
 */
const clampValue = (value, minValue, maxValue) =>
  Math.min(Math.max(value, minValue), maxValue);

/**
 * @description 検索条件の選択肢の取得と、その進行状況を管理する。
 * APIの呼び出しはconditionServiceへ委譲し、ここでは状態遷移とエラー処理のみ扱う。
 * @returns {object} 選択肢と取得状態、取得の実行関数
 */
export const useRouteConditionOptions = () => {
  const routeStore = useRouteStore();

  /** 目的の選択肢 */
  const purposeOptions = ref([]);

  /** ジャンルの選択肢 */
  const genreOptions = ref([]);

  /** 距離の選択範囲。取得前はnull */
  const distanceRange = ref(null);

  /** 取得処理中かどうか */
  const isLoading = ref(false);

  /** 失敗時のメッセージ。成功時はnull */
  const errorMessage = ref(null);

  /** 選択肢を取得済みかどうか */
  const hasConditionOptions = computed(() => distanceRange.value !== null);

  /**
   * @description 選択中の距離が取得した範囲の外だった場合に、範囲内の値へ補正する
   * @param {object} range 距離の選択範囲
   * @returns {void}
   */
  const applyDistanceRange = (range) => {
    const isWithinRange =
      routeStore.distanceKm >= range.minKm &&
      routeStore.distanceKm <= range.maxKm;

    if (isWithinRange) {
      return;
    }

    // マスタに既定値があればそれを使い、無ければ初期値を範囲内へ丸める
    routeStore.selectDistance(
      range.defaultKm ?? clampValue(DEFAULT_DISTANCE_KM, range.minKm, range.maxKm)
    );
  };

  /**
   * @description 検索条件の選択肢を取得して保持する
   * @returns {Promise<boolean>} 成功した場合はtrue
   */
  const loadConditionOptions = async () => {
    isLoading.value = true;
    errorMessage.value = null;

    try {
      const options = await fetchConditionOptions();

      purposeOptions.value = options.purposeOptions;
      genreOptions.value = options.genreOptions;
      distanceRange.value = options.distanceRange;
      applyDistanceRange(options.distanceRange);

      return true;
    } catch (error) {
      errorMessage.value = error.message;
      return false;
    } finally {
      isLoading.value = false;
    }
  };

  return {
    purposeOptions,
    genreOptions,
    distanceRange,
    isLoading,
    errorMessage,
    hasConditionOptions,
    loadConditionOptions
  };
};
