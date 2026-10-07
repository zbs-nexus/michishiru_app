<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import RouteLoadingOverlay from '@/components/feature/route/RouteLoadingOverlay.vue';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description デザイン確認用の画面。開発時のみルーターへ登録する。
 *
 * ログイン済みの状態と作成済みのルートをストアへ入れてから各画面へ移動するため、
 * Cognito と ルート作成API（Location Service / Bedrock）が無くても
 * 本物の画面をそのまま確認できる。
 *
 * 見た目の確認が目的なので、ここで入れる値はすべて固定の見本。
 * 本番ビルドには含めないこと（登録箇所の `import.meta.env.DEV` を外さない）。
 */
const router = useRouter();
const authStore = useAuthStore();
const routeStore = useRouteStore();
const walkStore = useWalkStore();

/** 見本のルート。新宿駅を出て御苑と花園神社を回る周回コース */
const SAMPLE_ROUTE = {
  routeId: 'preview-route',
  routeName: '夕暮れの御苑と花園神社をめぐる道',
  description:
    '木立の影が長くなる時間に歩きます。御苑の塀沿いで緑の匂いを拾い、路地を抜けて朱色の鳥居へ。最後は甘いもので一息つきましょう。',
  distanceKm: 3.4,
  durationMinutes: 48,
  spots: [
    {
      spotId: 'preview-spot-1',
      name: '新宿御苑 大木戸門',
      lat: 35.6866,
      lng: 139.711,
      spotType: 'park',
      icon: null
    },
    {
      spotId: 'preview-spot-2',
      name: '花園神社',
      lat: 35.6936,
      lng: 139.7048,
      spotType: 'shrine',
      icon: null
    },
    {
      spotId: 'preview-spot-3',
      name: '甘味処 ひなた',
      lat: 35.6905,
      lng: 139.7005,
      spotType: 'cafe',
      icon: null
    }
  ],
  geometry: {
    type: 'LineString',
    coordinates: [
      [139.702973, 35.686338],
      [139.7048, 35.6858],
      [139.7072, 35.6861],
      [139.7098, 35.6863],
      [139.711, 35.6866],
      [139.7113, 35.688],
      [139.7101, 35.6902],
      [139.7074, 35.6921],
      [139.7048, 35.6936],
      [139.7029, 35.6931],
      [139.7012, 35.6918],
      [139.7005, 35.6905],
      [139.7014, 35.6888],
      [139.7025, 35.6872],
      [139.702973, 35.686338]
    ]
  },
  selectedGenres: [{ genreId: 'nature', genreName: '自然' }],
  selectedDistanceKm: 3.4
};

/** 見本の実績。結果画面に数字が入った状態を見せるために使う */
const SAMPLE_WALK = {
  totalDistanceM: 3240,
  visitedSpotIds: ['preview-spot-1', 'preview-spot-2', 'preview-spot-3'],
  elapsedMinutes: 48
};

/** 1分あたりのミリ秒数 */
const MILLISECONDS_PER_MINUTE = 60000;

/** ルート作成中の画面を重ねて表示しているかどうか */
const isLoadingScreenVisible = ref(false);

/**
 * @description ログイン済みの状態と作成済みのルートをストアへ入れる。
 * ルーターガードの「ログイン必須」「ルート取得済み必須」を満たすために必要。
 * @returns {void}
 */
const seedSignedInState = () => {
  authStore.username = 'デザイン確認';
  authStore.isSessionRestored = true;
  routeStore.selectGenre('nature', '自然');
  routeStore.selectDistance(3);
  routeStore.setCurrentRoute(SAMPLE_ROUTE);
};

/**
 * @description 歩き終えた実績をストアへ入れる。
 * 案内画面は表示時に実績を初期化するため、結果画面へ移る直前に入れ直す。
 * @returns {void}
 */
const seedWalkRecord = () => {
  walkStore.totalDistanceM = SAMPLE_WALK.totalDistanceM;
  walkStore.setVisitedSpotIds(SAMPLE_WALK.visitedSpotIds);
  walkStore.hasLocationFix = true;
  walkStore.startedAt =
    Date.now() - SAMPLE_WALK.elapsedMinutes * MILLISECONDS_PER_MINUTE;
  walkStore.endedAt = Date.now();
};

// 画面を開いた時点で整えておき、どのボタンからでもすぐ移動できるようにする
onMounted(seedSignedInState);

/**
 * @description 指定した画面へ移動する
 * @param {string} name ルート名
 * @returns {void}
 */
const openScreen = (name) => {
  seedSignedInState();
  router.push({ name });
};

/**
 * @description 実績を入れてから結果画面へ移動する
 * @returns {void}
 */
const openWalkResult = () => {
  seedSignedInState();
  seedWalkRecord();
  router.push({ name: 'walk-result' });
};
</script>

<template>
  <!-- ルート作成中の画面は画面全体を覆うため、上に重ねて表示する -->
  <template v-if="isLoadingScreenVisible">
    <RouteLoadingOverlay />
    <button
      class="preview-close-btn"
      type="button"
      @click="isLoadingScreenVisible = false"
    >
      プレビューを閉じる
    </button>
  </template>

  <div
    v-else
    class="screen"
  >
    <div class="content">
      <p class="preview-badge">
        開発時のみ / デザイン確認用
      </p>

      <h1 class="preview-title">
        画面デザインの確認
      </h1>

      <p class="hint">
        ログイン済みの状態と作成済みのルートを入れてから本物の画面へ移動します。
        Cognito とルート作成APIは呼びません。
      </p>

      <ul class="preview-list">
        <li>
          <button
            class="primary-btn"
            type="button"
            @click="openScreen('route-condition')"
          >
            ホーム画面
          </button>
          <span class="hint">US-1 / 条件の入力</span>
        </li>
        <li>
          <button
            class="primary-btn"
            type="button"
            @click="isLoadingScreenVisible = true"
          >
            ルート作成中画面
          </button>
          <span class="hint">US-2 / URLを持たない重ね表示</span>
        </li>
        <li>
          <button
            class="primary-btn"
            type="button"
            @click="openScreen('route-suggestion')"
          >
            ルート提案画面
          </button>
          <span class="hint">US-3 / 地図とルートの紹介</span>
        </li>
        <li>
          <button
            class="primary-btn"
            type="button"
            @click="openScreen('route-navigation')"
          >
            ルート案内画面
          </button>
          <span class="hint">US-6, US-7 / 位置情報の許可を求められます</span>
        </li>
        <li>
          <button
            class="primary-btn"
            type="button"
            @click="openWalkResult"
          >
            案内終了画面
          </button>
          <span class="hint">US-8 / 実績入りの状態</span>
        </li>
      </ul>

      <p class="hint">
        各画面からここへ戻るには、ブラウザの戻るか
        <code>/design-preview</code> を開いてください。
      </p>
    </div>
  </div>
</template>

<style scoped>
.preview-badge {
  display: inline-block;
  margin-bottom: 14px;
  padding: 3px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--white);
  background: var(--danger);
  border-radius: 999px;
}

.preview-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--primary-color);
  margin-bottom: 10px;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin: 26px 0;
  padding: 0;
  list-style: none;
}

.preview-list li {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 重ねたローディング画面より前へ出す */
.preview-close-btn {
  position: fixed;
  top: 14px;
  right: 14px;
  z-index: 300;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 700;
  color: var(--white);
  background: var(--danger);
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
</style>
