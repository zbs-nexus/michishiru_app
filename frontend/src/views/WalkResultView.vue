<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';
import WalkResultStats from '@/components/feature/walk/WalkResultStats.vue';
import { useRouteStore } from '@/stores/routeStore';
import { useWalkStore } from '@/stores/walkStore';

/**
 * @description 散歩結果を表示する画面。
 * 集計値は案内中に計測した実績（walkStore）から表示する。
 * ルート作成時の予測値は使わない。
 * 労いの言葉はマスコットが吹き出しで話す。
 */
const router = useRouter();
const routeStore = useRouteStore();
const walkStore = useWalkStore();

/**
 * マスコットが話す労いの言葉。
 * 位置情報を取得できなかった場合は実績が空になるため、文言を変える。
 */
const mascotSubMessage = computed(() =>
  walkStore.hasLocationFix
    ? '今日の道のりを記録しておいたよ'
    : '位置情報を取得できなかったから、実績は記録できなかったよ'
);

/**
 * @description 条件と実績をリセットして条件入力画面へ戻る
 * @returns {void}
 */
const handleReturnHome = () => {
  routeStore.resetConditions();
  walkStore.resetWalk();
  router.push({ name: 'route-condition' });
};
</script>

<template>
  <DefaultLayout
    v-if="routeStore.currentRoute"
    class="is-result"
    :has-content-padding="false"
  >
    <div class="result-content">
      <div
        class="confetti"
        aria-hidden="true"
      />

      <MascotSpeechBubble
        class="result-mascot"
        placement="stacked"
        size="large"
        has-level-label
      >
        <h2 class="result-title">
          お疲れさまでした
        </h2>
        <p class="result-note">
          {{ mascotSubMessage }}
        </p>
      </MascotSpeechBubble>

      <WalkResultStats
        :distance-km="walkStore.totalDistanceKm"
        :spot-count="walkStore.spotCount"
        :duration-minutes="walkStore.elapsedMinutes"
      />
    </div>

    <template #footer>
      <BaseButton
        is-full-width
        @click="handleReturnHome"
      >
        ホームに戻る
      </BaseButton>
    </template>
  </DefaultLayout>
</template>

<style scoped>
/* 実績の一覧との間を空ける。下部の固定ボタンとも重ならないようにする */
.result-mascot {
  position: relative;
  margin-bottom: 32px;
}

/*
 * 吹き出しの中に入るため、画面見出しの大きさ（global.css）ではなく
 * 吹き出しに収まる大きさにする。
 */
.result-title {
  font-family: var(--font-display);
  font-size: 21px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--primary-color);
  margin-bottom: 6px;
}

.result-note {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.8;
  color: var(--text-gray);
}

/* 固定ボタンに最後の行が隠れないように空ける */
.result-content {
  padding-bottom: 110px;
}
</style>
