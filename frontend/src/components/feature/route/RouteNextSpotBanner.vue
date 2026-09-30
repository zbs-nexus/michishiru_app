<script setup>
import { computed } from 'vue';

/**
 * @description 案内中に、次の目的地を画面上部へ表示する。
 * 表示する値は親から受け取り、到達判定は行わない。
 *
 * 歩きながら一瞥して読めることを優先し、見出しと距離を上段、
 * 目的地の名前を下段に置いて名前を大きく見せる。
 */
const props = defineProps({
  /** 次の目的地の名前。未取得の場合はnull */
  spotName: {
    type: String,
    default: null
  },
  /** 次の目的地までの距離（メートル）。判定できない場合はnull */
  distanceToNextM: {
    type: Number,
    default: null
  },
  /** すべてのスポットへ到達したかどうか */
  isCompleted: {
    type: Boolean,
    default: false
  }
});

/** 1kmあたりのメートル数 */
const METERS_PER_KM = 1000;

/**
 * 距離表示の丸め単位（メートル）。
 * GPSは静止していても数メートル揺れるため、1m単位で出すと歩いていなくても
 * 数字が動き続ける。歩行者に1m単位の精度は不要なので、単位を粗くして
 * 揺れが表示に出ないようにする。
 */
const DISTANCE_ROUNDING_UNIT_M = 10;

/** 距離の表示文字列。1km以上はkm、それ未満はmで表す */
const distanceLabel = computed(() => {
  if (props.distanceToNextM === null) {
    return '';
  }

  if (props.distanceToNextM >= METERS_PER_KM) {
    return `約${(props.distanceToNextM / METERS_PER_KM).toFixed(1)}km`;
  }

  // 丸めた結果が0mになると「到達したのに0m」と読めてしまうため、単位を下限にする
  const roundedM = Math.max(
    DISTANCE_ROUNDING_UNIT_M,
    Math.round(props.distanceToNextM / DISTANCE_ROUNDING_UNIT_M) *
      DISTANCE_ROUNDING_UNIT_M
  );

  return `約${roundedM}m`;
});
</script>

<template>
  <div
    class="next-spot-banner"
    role="status"
    aria-live="polite"
  >
    <p
      v-if="isCompleted"
      class="banner-message"
    >
      すべての目的地を通過しました。開始地点へ戻ります
    </p>

    <template v-else-if="spotName">
      <div class="banner-header">
        <span class="banner-label">次の目的地</span>
        <span
          v-if="distanceLabel"
          class="banner-distance"
        >{{ distanceLabel }}</span>
      </div>
      <p class="banner-name">
        {{ spotName }}
      </p>
    </template>

    <p
      v-else
      class="banner-message"
    >
      現在地を取得しています
    </p>
  </div>
</template>

<style scoped>
/*
 * 屋外で歩きながら見るため、地図の上でも文字が沈まないよう
 * 背景は不透明にし、影を強めて地図から浮かせる。
 * 画面幅が広い場合もアプリの表示幅に合わせて中央へ寄せる。
 */
.next-spot-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: calc(100% - 24px);
  max-width: 406px;
  padding: 12px 16px;
  border-radius: 14px;
  border-left: 5px solid var(--accent-green);
  background: var(--white);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
}

/* 見出しと距離を同じ行に置き、距離を右端に寄せる */
.banner-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.banner-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-gray);
  letter-spacing: 0.04em;
}

.banner-distance {
  flex-shrink: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--primary-color);
  font-variant-numeric: tabular-nums;
}

/* 目的地の名前。長い場合は2行まで表示する */
.banner-name {
  display: -webkit-box;
  overflow: hidden;
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-dark);
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.banner-message {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.45;
  color: var(--text-dark);
}

@media (max-width: 380px) {
  .banner-name {
    font-size: 17px;
  }

  .banner-distance {
    font-size: 15px;
  }
}
</style>
