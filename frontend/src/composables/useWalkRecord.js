import { watch } from 'vue';
import { calculateDistanceM } from '@/utils/geoDistance';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description 実際に歩いた距離を積算する composable。
 * 現在地の更新を watch し、GPSのゆらぎと測位の飛びを除いた区間距離だけをストアへ積む。
 *
 * 積算の精度は判定の順序そのもので決まるため、ガードの並びがこの composable の本体である。
 * ゆらぎと判断した区間は起点を据え置き、飛びと判断した区間は起点を打ち直す。
 */

/**
 * 採用する最小区間距離（メートル）。
 * これを下回る移動はGPSのゆらぎとみなす。立ち止まっていても座標は数メートル揺れるため、
 * そのまま積むと歩いていない距離が増え続ける。
 */
const MIN_SEGMENT_DISTANCE_M = 10;

/**
 * 採用する最大区間距離（メートル）。
 * これを上回る移動は測位の飛びとみなす。徒歩で1回の測位間隔に進める距離を超えており、
 * 実際の移動ではなく座標の誤りであるため積まない。
 */
const MAX_SEGMENT_DISTANCE_M = 200;

/**
 * 距離を積算できる測位精度の上限（メートル）。
 * これより精度が悪い測位では、歩いた距離とゆらぎを区別できないため積算しない。
 *
 * この上限は MAX_SEGMENT_DISTANCE_M を必ず下回らせる必要がある。
 * ゆらぎ判定のしきい値は max(accuracy, MIN_SEGMENT_DISTANCE_M) であり、これが
 * MAX_SEGMENT_DISTANCE_M を超えると「飛びでもなくゆらぎでもない区間」が存在しなくなり、
 * 距離が一切積まれなくなる。useLocationTracking は精度が悪い測位を原則弾くが、
 * 初回測位と、良い測位が続かない場合の救済（MAX_POSITION_AGE_MS）では通すため、
 * ここでも独自に上限を持つ。
 *
 * 外部へ公開しているのは、案内画面が「測位は届いているが距離を積めない区間」を
 * 同じ基準で判定するため。二重定義にすると片方だけ変えた時に判定がずれる。
 */
export const MAX_MEASURABLE_ACCURACY_M = 100;

/**
 * @description 歩いた距離の積算を開始する
 * @param {object} sources 参照する状態
 * @param {import('vue').Ref<{lat: number, lng: number}>} sources.currentLocation 現在地
 * @param {import('vue').Ref<number|null>} sources.accuracy 位置情報の精度（メートル）
 * @returns {object} 公開する状態はない（空のオブジェクトを返す）
 */
export const useWalkRecord = ({ currentLocation, accuracy }) => {
  const walkStore = useWalkStore();

  /**
   * 区間距離を測る起点。
   * テンプレートから参照しないため、リアクティブにせず素の変数で持つ。
   * ref にすると自分が監視している watch を無駄に再評価させる。
   */
  let previousPosition = null;

  watch([currentLocation, accuracy], () => {
    // ① 初回の測位までは現在地がフォールバック座標（新宿）のままなので弾く。
    // 弾かないと実際の現在地との間に巨大な偽の区間が生まれる。
    // accuracyは実際に測位できた時点で数値が入る
    if (accuracy.value === null) {
      return;
    }

    // ② 測位そのものは届いたので、精度の良し悪しに関わらず記録する。
    // 距離を積めたかどうかとは別の事実で、結果画面が
    // 「位置情報を取得できなかった」と「歩いた距離が0だった」を言い分けるために使う
    walkStore.markLocationFixed();

    // ③ 精度が悪すぎる測位は、歩いた距離とゆらぎを区別できないため積算しない。
    // 起点は据え置き、精度が回復した時点でそれまでの移動を測れるようにする
    if (accuracy.value > MAX_MEASURABLE_ACCURACY_M) {
      return;
    }

    // ④ 最初の測位は起点を決めるだけで距離は積まない
    if (previousPosition === null) {
      previousPosition = {
        lat: currentLocation.value.lat,
        lng: currentLocation.value.lng
      };
      return;
    }

    const segmentDistanceM = calculateDistanceM(previousPosition, currentLocation.value);

    // ⑤ 座標が不正で距離を測れない場合は、起点も変えずに見送る
    if (segmentDistanceM === null) {
      return;
    }

    // ⑥ 飛び判定。加算はしないが起点は打ち直す。
    // 古い起点を残すと、以降の測位でも同じ巨大な区間を測り続けてしまう
    if (segmentDistanceM > MAX_SEGMENT_DISTANCE_M) {
      previousPosition = {
        lat: currentLocation.value.lat,
        lng: currentLocation.value.lng
      };
      return;
    }

    // ⑦ ゆらぎ判定。加算せず、起点も据え置く。
    // 起点を据え置くことで、小さな移動が累積してしきい値を超えた時点でまとめて積める。
    // しきい値に精度を使うのは、精度が悪い場所では揺れの幅もその分大きくなるため。
    // ③で精度を MAX_MEASURABLE_ACCURACY_M 以下に絞っているため、このしきい値が
    // ⑥の MAX_SEGMENT_DISTANCE_M を超えることはない（採用できる区間が必ず存在する）
    if (segmentDistanceM < Math.max(accuracy.value, MIN_SEGMENT_DISTANCE_M)) {
      return;
    }

    // ⑧ 実際に歩いた区間として積算し、起点を現在地へ進める
    walkStore.addDistanceM(segmentDistanceM);
    // currentLocation.value をそのまま持つと、将来その中身が書き換えられた時に
    // 起点が静かに変わってしまうため、座標を展開してコピーする
    previousPosition = {
      lat: currentLocation.value.lat,
      lng: currentLocation.value.lng
    };
  });

  return {};
};
