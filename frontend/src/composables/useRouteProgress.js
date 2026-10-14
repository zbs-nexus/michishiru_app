import { computed, ref, watch } from 'vue';
import { calculateDistanceM } from '@/utils/geoDistance';
import {
  calculateAlongRouteDistanceM,
  toRouteMeasure
} from '@/utils/routeGeometry';

/**
 * @description 案内中の進捗（次の目的地と到達状況）を管理する composable。
 *
 * 次の目的地への切り替えは利用者のボタン操作（advanceToNextSpot）でのみ行う。
 * 現在地からの自動判定は行わない。GPSの誤差で、立ち寄っていないスポットが
 * 到達済みになったり、立ち寄ったのに到達にならなかったりするのを避けるため。
 *
 * 到達済みのスポットは未到達へ戻さない。切り替えは一方向にのみ進める。
 *
 * 現在地は次の目的地までの距離の表示にだけ使う。
 * 距離は経路の折れ線に沿って測り、測れない場合は直線距離で代替する。
 */

/**
 * 経路に沿った距離を採用する、経路からの離れの上限（メートル）。
 * これ以上離れると射影先が別の区間へ吸着して距離が飛ぶため、直線距離へ切り替える。
 */
const MAX_ROUTE_DEVIATION_M = 100;

/**
 * @description 次の目的地と到達状況を提供する
 * @param {object} sources 参照する状態
 * @param {import('vue').Ref<object[]>} sources.spots 巡る順に並んだスポットの一覧
 * @param {import('vue').Ref<{lat: number, lng: number}>} sources.currentLocation 現在地（距離の表示に使う）
 * @param {import('vue').Ref<object|null>} [sources.geometry] 経路の形（GeoJSONのLineString）
 * @returns {object} 次の目的地・距離・到達状況・次の目的地へ進める関数
 */
export const useRouteProgress = ({
  spots,
  currentLocation,
  geometry = ref(null)
}) => {
  /** 到達済みのスポットID。ボタン操作で末尾にのみ追加する */
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

  /** 次の目的地までの直線距離（メートル）。経路沿いで測れない場合の代替に使う */
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

  /**
   * @description 利用者の操作で次の目的地へ切り替える。
   * 今の目的地を巡ったものとして到達済みにし、その次のスポットを次の目的地にする。
   * 配列は丸ごと差し替える（呼び出し側の watch が deep なしで拾えるようにするため）。
   * @returns {void}
   */
  const advanceToNextSpot = () => {
    if (nextSpot.value === null) {
      return;
    }

    visitedSpotIds.value = [...visitedSpotIds.value, nextSpot.value.spotId];
  };

  return {
    nextSpot,
    distanceToNextM,
    visitedSpotIds,
    visitedCount,
    isCompleted,
    advanceToNextSpot
  };
};
