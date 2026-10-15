import { onBeforeUnmount } from 'vue';

/** 長押しと判定するまで押し続ける時間（ミリ秒） */
const LONG_PRESS_DURATION_MS = 500;

/** 長押し中に許容する指・カーソルのずれ（ピクセル）。これを超えたら地図操作とみなす */
const MOVE_TOLERANCE_PX = 10;

/**
 * @description 地図上の長押しを検出する。
 * MapLibre には長押しイベントが無いため、押下してから一定時間動かさず
 * 離さなかった場合を長押しとみなし、その座標を通知する。
 * ドラッグやズームで地図を動かした場合は長押しにしない。
 *
 * 地図のインスタンスはRouteMapが保持するため、着脱の関数だけを返す。
 * @param {object} params パラメータ
 * @param {(position: {lng: number, lat: number}) => void} params.onLongPress 長押しを検出したときに呼ぶ関数
 * @returns {{attach: (map: object) => void, detach: () => void}} 地図への購読の着脱を行う関数
 */
export const useMapLongPress = ({ onLongPress }) => {
  /** 長押し判定用のタイマーID。押下中のみ値を持つ */
  let timerId = null;

  /** 押し始めた画面上の位置。ずれの判定に使う */
  let startPoint = null;

  /** イベントを購読している地図。detachで同じ参照を解除する */
  let targetMap = null;

  /**
   * @description 進行中の長押し判定を取り消す
   * @returns {void}
   */
  const cancelPress = () => {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    startPoint = null;
  };

  /**
   * @description 押下を検知してタイマーを開始する
   * @param {object} event MapLibreのポインターイベント
   * @returns {void}
   */
  const handlePressStart = (event) => {
    // 直前の判定が残っていても、新しい押下を優先する
    cancelPress();
    startPoint = event.point;

    timerId = setTimeout(() => {
      onLongPress({ lng: event.lngLat.lng, lat: event.lngLat.lat });
      cancelPress();
    }, LONG_PRESS_DURATION_MS);
  };

  /**
   * @description 押下中に許容量を超えて動いたら長押しを取り消す
   * @param {object} event MapLibreのポインターイベント
   * @returns {void}
   */
  const handlePressMove = (event) => {
    if (startPoint === null) {
      return;
    }

    const movedX = event.point.x - startPoint.x;
    const movedY = event.point.y - startPoint.y;

    if (Math.hypot(movedX, movedY) > MOVE_TOLERANCE_PX) {
      cancelPress();
    }
  };

  /**
   * @description 地図のポインターイベントを購読する
   * @param {object} map MapLibreの地図インスタンス
   * @returns {void}
   */
  const attach = (map) => {
    targetMap = map;
    map.on('mousedown', handlePressStart);
    map.on('touchstart', handlePressStart);
    map.on('mousemove', handlePressMove);
    map.on('touchmove', handlePressMove);
    map.on('mouseup', cancelPress);
    map.on('touchend', cancelPress);
    // 地図を動かし始めたら長押しではないので取り消す
    map.on('dragstart', cancelPress);
    map.on('zoomstart', cancelPress);
  };

  /**
   * @description 購読を解除し、残っているタイマーも止める
   * @returns {void}
   */
  const detach = () => {
    cancelPress();

    if (targetMap === null) {
      return;
    }

    targetMap.off('mousedown', handlePressStart);
    targetMap.off('touchstart', handlePressStart);
    targetMap.off('mousemove', handlePressMove);
    targetMap.off('touchmove', handlePressMove);
    targetMap.off('mouseup', cancelPress);
    targetMap.off('touchend', cancelPress);
    targetMap.off('dragstart', cancelPress);
    targetMap.off('zoomstart', cancelPress);
    targetMap = null;
  };

  // コンポーネントの破棄時にタイマーと購読が残らないようにする
  onBeforeUnmount(detach);

  return { attach, detach };
};
