import { METERS_PER_KM } from './constants.js';

/**
 * @description Bedrockへ渡すプロンプトを組み立てる。
 * 純粋関数として実装し、外部サービスへのアクセスは持たない。
 *
 * 候補リストにないスポットを生成させないこと（ハルシネーション防止）が要点のため、
 * 制約をルールとして明記し、出力形式もJSONに固定する。
 */

/**
 * @description 前回生成の距離を踏まえた調整指示を組み立てる。
 * 再生成時に、前回が目標より短ければ「離して選ぶ」、長ければ「近づけて選ぶ」よう促し、
 * 目標距離へ近づける。初回（前回距離なし）は空文字を返す。
 * @param {number} targetDistanceKm 目標距離（km）
 * @param {number|null} previousDistanceM 前回生成した総距離（m）。初回はnull
 * @returns {string} プロンプトへ挿入する調整指示（初回は空文字）
 */
const buildDistanceFeedback = (targetDistanceKm, previousDistanceM) => {
  if (previousDistanceM === null) {
    return '';
  }

  const previousDistanceKm = (previousDistanceM / METERS_PER_KM).toFixed(1);
  const isShort = previousDistanceM < targetDistanceKm * METERS_PER_KM;
  const direction = isShort
    ? 'スポット同士をもっと離して選び、合計距離を伸ばしてください'
    : 'スポット同士をもっと近づけて選び、合計距離を縮めてください';

  return `
【前回の結果（重要）】
前回のルートの合計距離は約${previousDistanceKm}kmで、目標の${targetDistanceKm}kmと差がありました。
今回は前回と違う組み合わせにし、${direction}。
`;
};

/**
 * @description ルート案を生成させるプロンプトを組み立てる
 * @param {object} conditions プロンプトに埋め込む条件
 * @param {number} conditions.targetDistanceKm 目標距離（km）
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {object[]} conditions.candidateSpots 候補スポットの一覧
 * @param {number|null} [conditions.previousDistanceM] 前回生成した総距離（m）。再生成時に渡す
 * @returns {string} Bedrockへ渡すプロンプト
 */
export const buildRoutePlanPrompt = ({
  targetDistanceKm,
  currentLocation,
  candidateSpots,
  previousDistanceM = null
}) => `
あなたはお散歩ルートのプロのプランナーです。
以下の【ユーザー条件】と【候補スポットリスト】のみを使用して、散歩コースを提案してください。

【厳格なルール】
1. 経由地は【候補スポットリスト】からユーザー条件に合うものを2〜3箇所選んでください。
2. 選定したスポットを順に巡る合計距離が目標距離に近づくようにしてください。
3. スポット同士が極端に近すぎないよう、バランスよく選定してください。
4. リストにない架空のスポットや座標を出力することは厳禁です。
5. 出力は指定された【JSONフォーマット】のみとし、マークダウン (\`\`\`json など) や前置き・後書きの文章は一切含めないでください。

【ユーザー条件】
- 目標距離: ${targetDistanceKm} km
- 現在地座標: ${JSON.stringify(currentLocation)}
${buildDistanceFeedback(targetDistanceKm, previousDistanceM)}
【候補スポットリスト】
${JSON.stringify(candidateSpots)}

【JSONフォーマット】
{
  "route_title": "ルートタイトル",
  "concept_story": "見どころの解説文",
  "selected_waypoints": [
    {
      "name": "スポット名称",
      "position": [139.000, 35.000]
    }
  ]
}
`;
