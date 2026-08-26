import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { DEFAULT_DISTANCE_KM } from '@/constants/routeConditions';

/**
 * @description ルート作成条件と作成済みルートを保持するグローバルストア。
 * 複数のViewから参照するため、Piniaで一元管理する。
 */
export const useRouteStore = defineStore('route', () => {
  /** 選択した目的 */
  const purpose = ref(null);

  /** 選択したカテゴリ */
  const category = ref(null);

  /** 選択した距離（km） */
  const distance = ref(DEFAULT_DISTANCE_KM);

  /** 取得済みのルート */
  const currentRoute = ref(null);

  /** 目的とカテゴリが選択済みかどうか */
  const hasRequiredConditions = computed(
    () => Boolean(purpose.value) && Boolean(category.value)
  );

  /** ルートを取得済みかどうか */
  const hasRoute = computed(() => currentRoute.value !== null);

  /**
   * @description 目的を選択する
   * @param {string} value 目的の値
   * @returns {void}
   */
  const selectPurpose = (value) => {
    purpose.value = value;
  };

  /**
   * @description カテゴリを選択する
   * @param {string} value カテゴリの値
   * @returns {void}
   */
  const selectCategory = (value) => {
    category.value = value;
  };

  /**
   * @description 距離を選択する
   * @param {number} value 距離（km）
   * @returns {void}
   */
  const selectDistance = (value) => {
    distance.value = value;
  };

  /**
   * @description 取得したルートを保存する
   * @param {object} route ルート情報
   * @returns {void}
   */
  const setCurrentRoute = (route) => {
    currentRoute.value = route;
  };

  /**
   * @description 入力条件と取得済みルートを初期状態へ戻す
   * @returns {void}
   */
  const resetConditions = () => {
    purpose.value = null;
    category.value = null;
    distance.value = DEFAULT_DISTANCE_KM;
    currentRoute.value = null;
  };

  return {
    purpose,
    category,
    distance,
    currentRoute,
    hasRequiredConditions,
    hasRoute,
    selectPurpose,
    selectCategory,
    selectDistance,
    setCurrentRoute,
    resetConditions
  };
});
