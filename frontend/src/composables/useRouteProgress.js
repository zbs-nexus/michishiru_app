import { computed, ref, watch } from 'vue';
import { calculateDistanceM } from '@/utils/geoDistance';
import {
  calculateAlongRouteDistanceM,
  toRouteMeasure
} from '@/utils/routeGeometry';

/**
 * @description 案内中の進捗（次の目的地と到達状況）を管理する composable。
 * 現在地の更新をきっかけに、次の目的地へ到達したかを判定する。
 *
 * 到達済みのスポットは未到達へ戻さない。GPSの精度により現在地が前後しても
 * 案内が逆行しないようにするため、判定は一方向にのみ進める。
 *
 * 表示する距離は経路の折れ線に沿って測り、到達判定は直線距離で行う。
 * 判定に道沿いの距離を使うと、近道した場合に到達と見なせなくなるため分けている。
 */

/** 到達とみなす距離（メートル）。一般的なGPSの誤差を見込んで余裕を持たせる */
const ARRIVAL_THRESHOLD_M = 40;

/**
 * 経路に沿った距離を採用する、経路からの離れの上限（メートル）。
 * これ以上離れると射影先が別の区間へ吸着して距離が飛ぶため、直線距離へ切り替える。
 */
const MAX_ROUTE_DEVIATION_M = 100;

/**
 * @description 次の目的地と到達状況を提供する
 * @param {object} sources 参照する状態
 * @param {import('vue').Ref<object[]>} sources.spots 巡る順に並んだスポットの一覧
 * @param {import('vue').Ref<{lat: number, lng: number}>} sources.currentLocation 現在地
 * @param {import('vue').Ref<number|null>} sources.accuracy 位置情報の精度（メートル）
 * @param {import('vue').Ref<object|null>} [sources.geometry] 経路の形（GeoJSONのLineString）
 * @returns {object} 次の目的地・距離・到達状況
 */
export const useRouteProgress = ({
  spots,
  currentLocation,
  accuracy,
  geometry = ref(null)
}) => {
  /** 到達済みのスポットID。判定が進む方向にのみ追加する */
  const visitedSpotIds = ref([]);

  /** 次に向かう目的地。すべて到達済みの場合はnull */
  const nextSpot = computed(
    () =>
      (spots.value ?? []).find(
        (spot) => !visitedSpotIds.value.includes(spot.spotId)
      ) ?? null
  );

  /** 次の目的地の座標。取得できない場合はnull */
  const nextSpotPosition = computed(() => {
    if (
      nextSpot.value === null ||
      !Number.isFinite(nextSpot.value.lat) ||
      !Number.isFinite(nextSpot.value.lng)
    ) {
      return null;
    }

    return { lat: nextSpot.value.lat, lng: nextSpot.value.lng };
  });

  /** 経路の累積距離。ルートが変わったときだけ組み立て直す */
  const routeMeasure = computed(() => toRouteMeasure(geometry.value?.coordinates));

  /** 次の目的地までの直線距離（メートル）。到達判定に使う */
  const straightDistanceToNextM = computed(() => {
    if (nextSpotPosition.value === null) {
      return null;
    }

    return calculateDistanceM(currentLocation.value, nextSpotPosition.value);
  });

  /**
   * 次の目的地までの距離（メートル）。表示に使う。
   * 経路に沿って測り、測れない場合は直線距離で代替する。
   */
  const distanceToNextM = computed(() => {
    if (nextSpotPosition.value === null) {
      return null;
    }

    const alongRouteM = calculateAlongRouteDistanceM({
      measure: routeMeasure.value,
      fromPosition: currentLocation.value,
      toPosition: nextSpotPosition.value,
      maxDeviationM: MAX_ROUTE_DEVIATION_M
    });

    return alongRouteM ?? straightDistanceToNextM.value;
  });

  /** 到達済みのスポット数 */
  const visitedCount = computed(() => visitedSpotIds.value.length);

  /** すべてのスポットへ到達したかどうか */
  const isCompleted = computed(
    () => (spots.value ?? []).length > 0 && nextSpot.value === null
  );

  // ルートが差し替わった場合は到達状況を初期化する
  watch(spots, () => {
    visitedSpotIds.value = [];
  });

  // 現在地が更新されるたびに、次の目的地への到達を判定する
  watch([currentLocation, accuracy], () => {
    // 初回の測位までは現在地にフォールバック座標が入っているため、判定しない。
    // accuracyは実際に測位できた時点で数値が入る
    if (accuracy.value === null || nextSpot.value === null) {
      return;
    }

    const distanceM = straightDistanceToNextM.value;

    if (distanceM === null || distanceM > ARRIVAL_THRESHOLD_M) {
      return;
    }

    visitedSpotIds.value = [...visitedSpotIds.value, nextSpot.value.spotId];
  });

  return {
    nextSpot,
    distanceToNextM,
    visitedSpotIds,
    visitedCount,
    isCompleted
  };
};
