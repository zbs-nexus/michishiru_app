import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { DEFAULT_DISTANCE_KM } from '@/constants/routeConditions';

/**
 * @description ルート作成条件と作成済みルートを保持するグローバルストア。
 * 複数のViewから参照するため、Piniaで一元管理する。
 */
export const useRouteStore = defineStore('route', () => {
  /** 選択したジャンル（マスタのgenreId） */
  const genre = ref(null);

  /**
   * 選択したジャンルの表示名（マスタのgenreName）。
   * ルート作成APIが表示名を受け取る仕様のため、idと合わせて保持する。
   */
  const genreName = ref(null);

  /** 選択した距離（km） */
  const distanceKm = ref(DEFAULT_DISTANCE_KM);

  /** ジャンルでおまかせ機能を使用中かどうか */
  const isGenreRandom = ref(false);

  /** 距離でおまかせ機能を使用中かどうか */
  const isDistanceRandom = ref(false);

  /** 取得済みのルート */
  const currentRoute = ref(null);

  /** ジャンルが選択済みかどうか（おまかせを含む） */
  const hasRequiredConditions = computed(() => Boolean(genre.value) || isGenreRandom.value);

  /** ルートを取得済みかどうか */
  const hasRoute = computed(() => currentRoute.value !== null);

  /**
   * @description ジャンルを選択する
   * @param {string} value ジャンルの値（genreId）
   * @param {string} name ジャンルの表示名（genreName）
   * @returns {void}
   */
  const selectGenre = (value, name) => {
    genre.value = value;
    genreName.value = name;
    isGenreRandom.value = false;
  };

  /**
   * @description ジャンルのおまかせ機能を切り替える
   * @returns {void}
   */
  const toggleGenreRandom = () => {
    isGenreRandom.value = !isGenreRandom.value;
    if (isGenreRandom.value) {
      // おまかせをONにしたら、手動選択をクリア
      genre.value = null;
      genreName.value = null;
    }
  };

  /**
   * @description 距離を選択する
   * @param {number} value 距離（km）
   * @returns {void}
   */
  const selectDistance = (value) => {
    distanceKm.value = value;
  };

  /**
   * @description 距離のおまかせ機能を切り替える
   * @returns {void}
   */
  const toggleDistanceRandom = () => {
    isDistanceRandom.value = !isDistanceRandom.value;
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
    genre.value = null;
    genreName.value = null;
    distanceKm.value = DEFAULT_DISTANCE_KM;
    isGenreRandom.value = false;
    isDistanceRandom.value = false;
    currentRoute.value = null;
  };

  return {
    genre,
    genreName,
    distanceKm,
    isGenreRandom,
    isDistanceRandom,
    currentRoute,
    hasRequiredConditions,
    hasRoute,
    selectGenre,
    toggleGenreRandom,
    selectDistance,
    toggleDistanceRandom,
    setCurrentRoute,
    resetConditions
  };
});
