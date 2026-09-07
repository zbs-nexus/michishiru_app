<script setup>
import { ref } from 'vue';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import RouteGeoJsonMap from '@/components/feature/route/RouteGeoJsonMap.vue';
import { useRouteGeneration } from '@/composables/useRouteGeneration';

/**
 * @description ルート生成方式の検証用画面。
 * バックエンドが返すGeoJSONをそのまま地図へ渡し、描画できるかを確認する。
 *
 * 段階1aの検証専用であり、本採用時は既存のルート作成フローへ統合してこの画面は破棄する。
 * ジャンルの選択肢は検証を単独で成立させるためこのファイルに持つ。
 * 値は検索条件マスタが返す genreId と一致させている。
 */

/** ジャンルの選択肢 */
const GENRE_OPTIONS = [
  { value: 'nature', label: '自然' },
  { value: 'city', label: '街歩き' },
  { value: 'history', label: '歴史' },
  { value: 'gourmet', label: 'グルメ' }
];

/** 現在地の初期値（東京駅）。固定データが東京駅周辺のため既定値にする */
const FALLBACK_ORIGIN = { lat: 35.681236, lng: 139.767125 };

const { isGenerating, errorMessage, generatedRoute, hasGeneratedRoute, generate } =
  useRouteGeneration();

const genre = ref(GENRE_OPTIONS[0].value);
const distanceKm = ref(3);
const origin = ref({ ...FALLBACK_ORIGIN });
const originMessage = ref('東京駅を初期値として使用しています');

/**
 * @description 端末の現在地を取得して出発地に設定する
 * @returns {void}
 */
const handleUseCurrentLocation = () => {
  if (!navigator.geolocation) {
    originMessage.value = 'この端末では現在地を取得できません';
    return;
  }

  originMessage.value = '現在地を取得中...';

  navigator.geolocation.getCurrentPosition(
    (position) => {
      origin.value = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
      originMessage.value = '現在地を取得しました';
    },
    () => {
      originMessage.value = '現在地を取得できなかったため、東京駅を使用します';
    }
  );
};

/**
 * @description 入力した条件でルートを生成する
 * @returns {Promise<void>}
 */
const handleGenerate = async () => {
  await generate({
    genre: genre.value,
    distanceKm: Number(distanceKm.value),
    origin: origin.value
  });
};

/**
 * @description ルート線を構成する座標の点数を数える
 * @param {object} geojson FeatureCollection
 * @returns {number} 座標の点数
 */
const countWaypoints = (geojson) => {
  const routeFeature = geojson.features.find(
    (feature) => feature.properties.featureKind === 'route'
  );

  return routeFeature?.geometry.coordinates.length ?? 0;
};
</script>

<template>
  <DefaultLayout>
    <h2 class="page-title">
      ルート生成の検証
    </h2>

    <p class="note">
      固定データから生成したGeoJSONを、そのまま地図へ渡して描画しています。AWSへは接続しません。
    </p>

    <div class="condition-form">
      <label class="field">
        <span class="field-label">ジャンル</span>
        <select v-model="genre">
          <option
            v-for="option in GENRE_OPTIONS"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="field">
        <span class="field-label">目標距離（km）</span>
        <input
          v-model="distanceKm"
          type="number"
          min="1"
          max="10"
          step="1"
        >
      </label>
    </div>

    <div class="origin-row">
      <p
        class="note"
        role="status"
      >
        出発地: {{ origin.lat.toFixed(6) }}, {{ origin.lng.toFixed(6) }}
        <br>
        {{ originMessage }}
      </p>
      <BaseButton
        variant="secondary"
        @click="handleUseCurrentLocation"
      >
        現在地を使う
      </BaseButton>
    </div>

    <BaseButton
      :is-disabled="isGenerating"
      @click="handleGenerate"
    >
      {{ isGenerating ? '生成中...' : 'ルートを生成' }}
    </BaseButton>

    <p
      v-if="errorMessage"
      class="note is-error"
      role="alert"
    >
      {{ errorMessage }}
    </p>

    <template v-if="hasGeneratedRoute">
      <RouteGeoJsonMap :geojson="generatedRoute.geojson" />

      <div class="result">
        <h3 class="result-title">
          {{ generatedRoute.routeName }}
        </h3>
        <p class="result-story">
          {{ generatedRoute.story }}
        </p>

        <dl class="result-stats">
          <div class="stat">
            <dt>距離</dt>
            <dd>{{ generatedRoute.distance }} km</dd>
          </div>
          <div class="stat">
            <dt>所要時間</dt>
            <dd>{{ generatedRoute.duration }} 分</dd>
          </div>
          <div class="stat">
            <dt>スポット数</dt>
            <dd>{{ generatedRoute.spotCount }}</dd>
          </div>
          <div class="stat">
            <dt>経路の点数</dt>
            <dd>{{ countWaypoints(generatedRoute.geojson) }}</dd>
          </div>
        </dl>

        <ol class="spot-list">
          <li
            v-for="spot in generatedRoute.spots"
            :key="spot.spotId"
          >
            <span class="spot-name">{{ spot.name }}</span>
            <span class="spot-description">{{ spot.description }}</span>
          </li>
        </ol>
      </div>
    </template>
  </DefaultLayout>
</template>

<style scoped>
.page-title {
  margin: 8px 0;
  font-size: 20px;
}

.note {
  margin: 4px 0;
  font-size: 13px;
  color: #555;
}

.note.is-error {
  color: #c62828;
  font-weight: 700;
}

.condition-form {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin: 12px 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-label {
  font-size: 12px;
  font-weight: 700;
  color: #444;
}

.field select,
.field input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.origin-row {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.result {
  margin-top: 12px;
}

.result-title {
  margin: 8px 0 4px;
  font-size: 17px;
}

.result-story {
  margin: 0 0 8px;
  font-size: 14px;
  color: #444;
}

.result-stats {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin: 0 0 12px;
}

.stat dt {
  font-size: 12px;
  color: #666;
}

.stat dd {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.spot-list {
  margin: 0;
  padding-left: 20px;
}

.spot-list li {
  margin-bottom: 6px;
  font-size: 14px;
}

.spot-name {
  font-weight: 700;
}

.spot-description {
  display: block;
  font-size: 13px;
  color: #555;
}
</style>
