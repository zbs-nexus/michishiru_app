import { computed, ref, watch } from 'vue';
import { calculateDistanceM } from '@/utils/geoDistance';

/**
 * @description 案内中の進捗（次の目的地と到達状況）を管理する composable。
 * 現在地の更新をきっかけに、次の目的地へ到達したかを判定する。
 *
 * 到達済みのスポットは未到達へ戻さない。GPSの精度により現在地が前後しても
 * 案内が逆行しないようにするため、判定は一方向にのみ進める。
 */

/** 到達とみなす距離（メートル）。一般的なGPSの誤差を見込んで余裕を持たせる */
const ARRIVAL_THRESHOLD_M = 40;

/**
 * @description 次の目的地と到達状況を提供する
 * @param {object} sources 参照する状態
 * @param {import('vue').Ref<object[]>} sources.spots 巡る順に並んだスポットの一覧
 * @param {import('vue').Ref<{lat: number, lng: number}>} sources.currentLocation 現在地
 * @param {import('vue').Ref<number|null>} sources.accuracy 位置情報の精度（メートル）
 * @returns {object} 次の目的地・距離・到達状況
 */
export const useRouteProgress = ({ spots, currentLocation, accuracy }) => {
  /** 到達済みのスポットID。判定が進む方向にのみ追加する */
  const visitedSpotIds = ref([]);

  /** 次に向かう目的地。すべて到達済みの場合はnull */
  const nextSpot = computed(
    () =>
      (spots.value ?? []).find(
        (spot) => !visitedSpotIds.value.includes(spot.spotId)
      ) ?? null
  );

  /** 次の目的地までの直線距離（メートル）。判定できない場合はnull */
  const distanceToNextM = computed(() => {
    if (nextSpot.value === null) {
      return null;
    }

    return calculateDistanceM(currentLocation.value, {
      lat: nextSpot.value.lat,
      lng: nextSpot.value.lng
    });
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

    const distanceM = distanceToNextM.value;

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
