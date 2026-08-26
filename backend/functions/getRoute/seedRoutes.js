/**
 * @description DynamoDBのテーブルが未設定の場合に使うローカル開発用のデータ。
 * 本番では使用しない。テーブル投入用の初期データとしても利用できる。
 */
export const SEED_ROUTES = [
  {
    routeId: '4f3c1b6e-6f1a-4a2e-9b5c-6d7f8a9b0c11',
    routeName: '緑とカフェのんびりコース',
    description: '公園とカフェを巡る、歩きやすいルート',
    category: 'nature',
    purpose: 'refresh',
    distance: 3,
    waypoints: [
      { waypointId: 'w-0001', name: '緑の公園', type: 'park', icon: '🌳' },
      { waypointId: 'w-0002', name: '展望スポット', type: 'viewpoint', icon: '📷' },
      { waypointId: 'w-0003', name: 'こもれびカフェ', type: 'cafe', icon: '☕' },
      { waypointId: 'w-0004', name: 'やすらぎ神社', type: 'shrine', icon: '⛩️' }
    ],
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    routeId: '7a2d9c4b-1e8f-4c3a-8d6b-2f4e6a8c0d22',
    routeName: 'まちなか歴史めぐり',
    description: '神社と旧街道をたどる、見どころの多いルート',
    category: 'history',
    purpose: 'sightseeing',
    distance: 5,
    waypoints: [
      { waypointId: 'w-0011', name: 'さくら神社', type: 'shrine', icon: '⛩️' },
      { waypointId: 'w-0012', name: '旧街道の並木', type: 'viewpoint', icon: '📷' },
      { waypointId: 'w-0013', name: '古民家カフェ', type: 'cafe', icon: '☕' }
    ],
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    routeId: 'b93e5f27-8c4d-4b1a-9e2f-3a5c7d9e1f33',
    routeName: 'ぐるっと商店街コース',
    description: '商店街と広場をつなぐ、にぎやかなルート',
    category: 'city',
    purpose: 'cafe',
    distance: 1,
    waypoints: [
      { waypointId: 'w-0021', name: 'なかまち商店街', type: 'city', icon: '🏛️' },
      { waypointId: 'w-0022', name: '駅前広場', type: 'viewpoint', icon: '📷' }
    ],
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    routeId: 'c47a8b13-2d9e-4f5c-8a1b-4e6f8a0c2d44',
    routeName: 'たっぷり歩く river コース',
    description: '川沿いを長めに歩く、運動向けのルート',
    category: 'nature',
    purpose: 'exercise',
    distance: 8,
    waypoints: [
      { waypointId: 'w-0031', name: 'river サイド遊歩道', type: 'park', icon: '🌳' },
      { waypointId: 'w-0032', name: '中央公園', type: 'park', icon: '🌲' },
      { waypointId: 'w-0033', name: '見晴らしの丘', type: 'viewpoint', icon: '📷' },
      { waypointId: 'w-0034', name: 'カフェ ブルー', type: 'cafe', icon: '☕' }
    ],
    createdAt: '2026-08-01T00:00:00.000Z'
  },
  {
    routeId: 'd58b9c24-3e0f-4a6d-9b2c-5f7a9b1d3e55',
    routeName: 'food めぐり散歩コース',
    description: '食べ歩きを楽しむ、寄り道の多いルート',
    category: 'gourmet',
    purpose: 'cafe',
    distance: 3,
    waypoints: [
      { waypointId: 'w-0041', name: 'ベーカリー こむぎ', type: 'gourmet', icon: '🍴' },
      { waypointId: 'w-0042', name: 'こもれびカフェ', type: 'cafe', icon: '☕' },
      { waypointId: 'w-0043', name: '緑の公園', type: 'park', icon: '🌳' }
    ],
    createdAt: '2026-08-01T00:00:00.000Z'
  }
];
