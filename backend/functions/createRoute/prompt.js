/**
 * @description Bedrockへ渡すプロンプトを組み立てる。
 * 純粋関数として実装し、外部サービスへのアクセスは持たない。
 *
 * 候補リストにないスポットを生成させないこと（ハルシネーション防止）が要点のため、
 * 制約をルールとして明記し、出力形式もJSONに固定する。
 */

/**
 * @description ルート案を生成させるプロンプトを組み立てる
 * @param {object} conditions プロンプトに埋め込む条件
 * @param {number} conditions.targetDistanceKm 目標距離（km）
 * @param {{lat: number, lng: number}} conditions.currentLocation 現在地
 * @param {object[]} conditions.candidateSpots 候補スポットの一覧
 * @returns {string} Bedrockへ渡すプロンプト
 */
export const buildRoutePlanPrompt = ({
  targetDistanceKm,
  currentLocation,
  candidateSpots
}) => `
あなたはお散歩ルートのプロのプランナーです。
以下の【ユーザー条件】と【候補スポットリスト】のみを使用して、散歩コースを提案してください。

【厳格なルール】
1. 経由地は【候補スポットリスト】からユーザー条件に合うものを2〜3箇所選んでください。
2. スポット同士が極端に近すぎないよう、バランスよく選定してください。
3. リストにない架空のスポットや座標を出力することは厳禁です。
4. 出力は指定された【JSONフォーマット】のみとし、マークダウン (\`\`\`json など) や前置き・後書きの文章は一切含めないでください。

【ユーザー条件】
- 目標距離: ${targetDistanceKm} km
- 現在地座標: ${JSON.stringify(currentLocation)}

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
