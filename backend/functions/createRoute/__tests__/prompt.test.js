import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRoutePlanPrompt } from '../prompt.js';

/**
 * @description プロンプトの組み立てのテスト。
 * 口コミの場所とチェーン店の扱いをBedrockへ指示しているか、
 * 候補の目印がそのまま渡るかを確かめる。
 */

const baseConditions = {
  targetDistanceKm: 3,
  currentLocation: { lat: 35.6862, lng: 139.7036 },
  candidateSpots: [
    { name: '口コミ近', position: [139.7045, 35.6872], isReviewSpot: true },
    { name: '公園A', position: [139.703, 35.686] },
    { name: 'チェーンX', position: [139.703, 35.686], isChain: true }
  ]
};

describe('buildRoutePlanPrompt', () => {
  it('口コミの場所を4割程度を目安に、最低1か所・多くても4割まで含めるよう指示し、距離を優先させる', () => {
    const prompt = buildRoutePlanPrompt(baseConditions);

    assert.match(prompt, /"isReviewSpot": true の候補は、利用者の口コミが付いた場所です/);
    assert.match(prompt, /4割程度を目安に/);
    assert.match(prompt, /最低1か所、多くても4割までを口コミの場所にしてください/);
    // 以前の指示（2割）が残っていない
    assert.doesNotMatch(prompt, /2割/);
    assert.match(prompt, /合計距離を目標距離に収めることを最優先/);
  });

  it('口コミの場所の中では平均評価の高いものを優先するよう指示する', () => {
    const prompt = buildRoutePlanPrompt(baseConditions);

    assert.match(prompt, /"ratingAverage"（5段階の平均評価）が\s*高いものを優先して選んでください/);
  });

  it('チェーン店の優先順位を下げるよう指示する', () => {
    const prompt = buildRoutePlanPrompt(baseConditions);

    assert.match(prompt, /"isChain": true の候補はチェーン店です/);
    assert.match(prompt, /優先順位を下げ/);
  });

  it('候補の目印（isReviewSpot / isChain）をそのまま候補リストに含める', () => {
    const prompt = buildRoutePlanPrompt(baseConditions);
    const candidates = JSON.parse(prompt.match(/【候補スポットリスト】\n(.+)\n/)[1]);

    assert.deepEqual(candidates, baseConditions.candidateSpots);
  });

  it('出力形式は従来どおり selected_waypoints を返させる（Repository の解析と合わせる）', () => {
    const prompt = buildRoutePlanPrompt(baseConditions);

    assert.match(prompt, /"selected_waypoints"/);
  });
});
