import { computed, ref } from 'vue';
import { snapToRoute, toRouteMeasure } from '@/utils/routeGeometry';

/**
 * @description 地図に表示する現在地を、経路の線上へ吸着させる composable。
 *
 * 案内中の利用者はほとんど経路の上を歩いているため、経路の近くにいる間は
 * 線上の最も近い点に寄せて表示する。ビル群でGPSが左右にぶれても、
 * 現在地のマーカーが建物の中や隣の通りへ飛んで見えなくなる。
 *
 * 寄せるのは表示だけに使う。歩いた距離（useWalkRecord）と次の目的地までの距離
 * （useRouteProgress）には吸着前の現在地を渡すこと。吸着後の座標で距離を積むと、
 * 経路から外れて近道した区間も経路沿いの長さで数えてしまう。
 */

/**
 * 経路へ吸着させる、経路からの離れの上限（メートル）。
 * ビル群のGPSの誤差（数十m）を吸収しつつ、本当に道を外れたことには気付けるようにする。
 * これを超えたら吸着をやめ、測位した座標をそのまま表示する。
 */
const MAX_SNAP_DEVIATION_M = 40;

/**
 * @description 経路へ吸着させた現在地を提供する
 * @param {object} sources 参照する状態
 * @param {import('vue').Ref<{lat: number, lng: number}|null>} sources.currentLocation 測位した現在地
 * @param {import('vue').Ref<object|null>} [sources.geometry] 経路の形（GeoJSONのLineString）
 * @returns {object} 地図に表示する現在地と、吸着させているかどうか
 */
export const useRouteSnapping = ({ currentLocation, geometry = ref(null) }) => {
  /** 経路の累積距離。ルートが変わったときだけ組み立て直す */
  const routeMeasure = computed(() => toRouteMeasure(geometry.value?.coordinates));

  /** 吸着先の座標。経路から離れている、または経路が無い場合はnull */
  const snappedPosition = computed(() =>
    snapToRoute({
      measure: routeMeasure.value,
      position: currentLocation.value,
      maxDeviationM: MAX_SNAP_DEVIATION_M
    })
  );

  /** 経路へ吸着させているかどうか */
  const isSnappedToRoute = computed(() => snappedPosition.value !== null);

  /** 地図に表示する現在地。吸着できない場合は測位した座標をそのまま使う */
  const displayLocation = computed(
    () => snappedPosition.value ?? currentLocation.value
  );

  return {
    displayLocation,
    isSnappedToRoute
  };
};
