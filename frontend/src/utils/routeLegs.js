/**
 * @description 経路の区間（leg）を、案内中の描き分けに使う3つにまとめる。
 * Vueに依存しない純粋な変換のみを行う。
 *
 * 区間の並びの前提: legs[i] はスポット i へ向かう区間（legs[0] は開始地点→1スポット目）、
 * 最後の legs[N] は最終スポット→開始地点の帰り道。数はスポット数+1になる。
 * 今の区間の番号（currentLegIndex）は到達済みのスポット数（visitedCount）と同じ値で、
 * 全スポット到達後（visitedCount = N）は帰り道が今の区間になる。
 *
 * この前提を確かめられない場合（区間が無い・数が合わない・線にならない区間がある・
 * 到達数が範囲外）は null を返し、呼び出し側は全体の線を1色で描く。
 */

/**
 * @description 区間を「歩き終えた区間・今の区間・これからの区間」に分ける
 * @param {object} params パラメータ
 * @param {Array<{geometry: {coordinates: number[][]}}>|undefined} params.legs 区間の一覧（巡る順）
 * @param {number} params.spotCount スポットの数
 * @param {number} params.visitedCount 到達済みのスポット数
 * @returns {{walkedLegs: object[], currentLeg: object, upcomingLegs: object[]}|null} 区間の描き分け。確かめられない場合はnull
 */
export const toRouteLegSections = ({ legs, spotCount, visitedCount }) => {
  if (!Array.isArray(legs) || legs.length === 0) {
    return null;
  }

  if (!Number.isInteger(spotCount) || spotCount < 1 || legs.length !== spotCount + 1) {
    return null;
  }

  if (!Number.isInteger(visitedCount) || visitedCount < 0 || visitedCount > spotCount) {
    return null;
  }

  const hasInvalidLeg = legs.some(
    (leg) => !Array.isArray(leg?.geometry?.coordinates) || leg.geometry.coordinates.length < 2
  );

  if (hasInvalidLeg) {
    return null;
  }

  const currentLegIndex = visitedCount;
  const geometries = legs.map((leg) => leg.geometry);

  return {
    walkedLegs: geometries.slice(0, currentLegIndex),
    currentLeg: geometries[currentLegIndex],
    upcomingLegs: geometries.slice(currentLegIndex + 1)
  };
};
