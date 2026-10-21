import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { GeoPlacesClient } from '@aws-sdk/client-geo-places';

/**
 * @description 周辺検索の Repository のテスト。
 * チェーン店の判定（BusinessChains の有無）がアプリ形式へ正しく写るかを確かめる。
 * AWSへは接続しない。GeoPlacesClient の send を差し替える。
 */

process.env.AWS_REGION = process.env.AWS_REGION ?? 'ap-northeast-1';

/** 送られたコマンドの記録 */
let sentCommands = [];

/** send が返す応答。テストごとに差し替える */
let response = { ResultItems: [] };

mock.method(GeoPlacesClient.prototype, 'send', async (command) => {
  sentCommands.push(command);
  return response;
});

const { searchNearbySpots } = await import('../repositories/placesRepository.js');

/** 検索条件 */
const conditions = {
  currentLocation: { lat: 35.6862, lng: 139.7036 },
  spotCategoryId: 'cafe',
  queryRadiusM: 1500
};

describe('searchNearbySpots', () => {
  beforeEach(() => {
    sentCommands = [];
    response = { ResultItems: [] };
  });

  it('BusinessChains を持つ場所はチェーン店、持たない場所はチェーン店でないとする', async () => {
    response = {
      ResultItems: [
        {
          Title: 'チェーンのカフェ',
          Position: [139.704, 35.687],
          BusinessChains: [{ Name: 'Some Coffee', Id: 'chain-1' }]
        },
        { Title: '個人のカフェ', Position: [139.705, 35.688] },
        // 空配列はチェーンに属していないものとして扱う
        { Title: '空のチェーン情報', Position: [139.706, 35.689], BusinessChains: [] }
      ]
    };

    const spots = await searchNearbySpots(conditions);

    assert.deepEqual(spots, [
      { name: 'チェーンのカフェ', position: [139.704, 35.687], isChain: true },
      { name: '個人のカフェ', position: [139.705, 35.688], isChain: false },
      { name: '空のチェーン情報', position: [139.706, 35.689], isChain: false }
    ]);
  });

  it('チェーン店を検索段階で除外しない（優先度を下げるのは Service の役割）', async () => {
    await searchNearbySpots(conditions);

    const { input } = sentCommands[0];
    assert.deepEqual(input.Filter, { IncludeCategories: ['cafe'] });
    assert.equal(input.QueryRadius, 1500);
  });
});
