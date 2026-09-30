<script setup>
import { computed } from 'vue';

/**
 * @description 案内中に、次の目的地を画面上部へ表示する。
 * 表示する値は親から受け取り、到達判定は行わない。
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

/** 距離の表示文字列。1km以上はkm、それ未満はmで表す */
const distanceLabel = computed(() => {
  if (props.distanceToNextM === null) {
    return '';
  }

  if (props.distanceToNextM >= METERS_PER_KM) {
    return `約${(props.distanceToNextM / METERS_PER_KM).toFixed(1)}km`;
  }

  return `約${Math.round(props.distanceToNextM)}m`;
});
</script>

<template>
  <div
    class="next-spot-banner"
    role="status"
    aria-live="polite"
  >
    <template v-if="isCompleted">
      <span class="banner-label">おつかれさまでした</span>
      <span class="banner-name">すべてのスポットを巡りました</span>
    </template>

    <template v-else-if="spotName">
      <span class="banner-label">次の目的地</span>
      <span class="banner-name">{{ spotName }}</span>
      <span
        v-if="distanceLabel"
        class="banner-distance"
      >{{ distanceLabel }}</span>
    </template>

    <template v-else>
      <span class="banner-label">現在地を取得しています</span>
    </template>
  </div>
</template>

<style scoped>
/* 画面幅が広い場合もアプリの表示幅に合わせて中央へ寄せる */
.next-spot-banner {
  position: fixed;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  align-items: baseline;
  gap: 8px;
  width: calc(100% - 24px);
  max-width: 406px;
  padding: 12px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.95);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
}

.banner-label {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-gray);
}

.banner-name {
  flex: 1;
  overflow: hidden;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-dark);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.banner-distance {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
}
</style>
