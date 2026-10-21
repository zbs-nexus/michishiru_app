import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';
import { GeoRoutesClient } from '@aws-sdk/client-geo-routes';

/**
 * @description 徒歩経路の Repository のテスト。
 * 区間（leg）ごとの座標列が Legs の順のまま返るか、全体の線が従来どおりかを確かめる。
 * AWSへは接続しない。GeoRoutesClient の send を差し替える。
 */

process.env.AWS_REGION = process.env.AWS_REGION ?? 'ap-northeast-1';

/** 送られたコマンドの記録 */
let sentCommands = [];

/** send が返す応答。テストごとに差し替える */
let response = { Routes: [] };

mock.method(GeoRoutesClient.prototype, 'send', async (command) => {
  sentCommands.push(command);
  return response;
});

const { calculateWalkingRoute } = await import('../repositories/routesRepository.js');

/** 現在地（出発地かつ目的地） */
const currentLocation = { lat: 35.686, lng: 139.7 };

/** 巡るスポット（3件） */
const spots = [
  { name: 'スポット1', position: [139.701, 35.687] },
  { name: 'スポット2', position: [139.702, 35.688] },
  { name: 'スポット3', position: [139.703, 35.687] }
];

/** 各区間の線（2点なので間引きの影響を受けない） */
const legLines = [
  [
    [139.7, 35.686],
    [139.701, 35.687]
  ],
  [
    [139.701, 35.687],
    [139.702, 35.688]
  ],
  [
    [139.702, 35.688],
    [139.703, 35.687]
  ],
  [
    [139.703, 35.687],
    [139.7, 35.686]
  ]
];

describe('calculateWalkingRoute', () => {
  beforeEach(() => {
    sentCommands = [];
    response = {
      Routes: [
        {
          Legs: legLines.map((lineString) => ({ Geometry: { LineString: lineString } })),
          Summary: { Distance: 1200, Duration: 900 }
        }
      ]
    };
  });

  it('区間ごとの座標列を Legs の順のまま返す', async () => {
    const route = await calculateWalkingRoute({ currentLocation, spots });

    assert.equal(route.legCoordinates.length, 4);
    assert.deepEqual(route.legCoordinates, legLines);
  });

  it('全体の座標列は従来どおり区間を連結したものになる', async () => {
    const route = await calculateWalkingRoute({ currentLocation, spots });

    // 一直線に並ばないため、間引いても連結した各点が残る
    assert.deepEqual(route.coordinates[0], legLines[0][0]);
    assert.deepEqual(route.coordinates.at(-1), legLines[3][1]);
    assert.equal(route.totalDistanceM, 1200);
  });

  it('経路が返らない場合は区間を空にし、全体は直線で代替する', async () => {
    response = { Routes: [] };

    const route = await calculateWalkingRoute({ currentLocation, spots });

    assert.deepEqual(route.legCoordinates, []);
    // 直線の代替も間引かれるため、一直線上の点は省かれる。両端が現在地であることを確かめる
    assert.deepEqual(route.coordinates[0], [139.7, 35.686]);
    assert.deepEqual(route.coordinates.at(-1), [139.7, 35.686]);
    assert.ok(route.coordinates.length >= 3);
  });

  it('出発地・目的地を現在地、経由点をスポットの順にして Simple 形式で要求する', async () => {
    await calculateWalkingRoute({ currentLocation, spots });

    const { input } = sentCommands[0];
    assert.deepEqual(input.Origin, [139.7, 35.686]);
    assert.deepEqual(input.Destination, [139.7, 35.686]);
    assert.deepEqual(
      input.Waypoints,
      spots.map((spot) => ({ Position: spot.position }))
    );
    assert.equal(input.LegGeometryFormat, 'Simple');
  });
});
