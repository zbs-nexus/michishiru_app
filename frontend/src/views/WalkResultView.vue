<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import MascotExperienceBar from '@/components/feature/mascot/MascotExperienceBar.vue';
import MascotLevelUpCelebration from '@/components/feature/mascot/MascotLevelUpCelebration.vue';
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';
import WalkResultStats from '@/components/feature/walk/WalkResultStats.vue';
import { useMascotStore } from '@/stores/mascotStore';
import { useRouteStore } from '@/stores/routeStore';
import { MEASUREMENT_STATUS, useWalkStore } from '@/stores/walkStore';

/**
 * @description 散歩結果を表示する画面。
 * 集計値は案内中に計測した実績（walkStore）から表示する。
 * ルート作成時の予測値は使わない。
 * 労いの言葉はマスコットが吹き出しで話す。
 *
 * 実績の保存・取り直し・レベルアップ判定は、この画面へ来る前（案内画面の終了処理）で
 * すべて済ませている。遷移してきた時点で経験値もレベルも確定しているため、
 * この画面は保存の成否を気にせず、確定した値を表示するだけでよい。
 * レベルアップがあった場合は、結果の本体を隠したままお祝い演出を先に見せ、
 * 閉じてから結果を見せる（結果が一瞬ちらつくのを防ぐ）。
 */
const router = useRouter();
const mascotStore = useMascotStore();
const routeStore = useRouteStore();
const walkStore = useWalkStore();

/**
 * お祝い演出を表示中かどうか。
 * 遷移前に積まれたレベルアップ（pendingLevelUpLevels）があれば、最初から表示する。
 * 演出を出している間は結果の本体を隠し、「演出 → 結果」の順に見せる。
 */
const isCelebrationVisible = ref(mascotStore.pendingLevelUpLevels.length > 0);

/** 演出で順に見せるレベルの一覧（経由レベルを含む昇順）。遷移前に積まれたものを読む */
const celebrationLevels = computed(() => mascotStore.pendingLevelUpLevels);

/**
 * @description お祝い演出を閉じる。最後の段で閉じたときに呼ばれる。
 * 積んだレベルアップを消して、次に結果画面へ来たとき再演されないようにする。
 * @returns {void}
 */
const closeCelebration = () => {
  isCelebrationVisible.value = false;
  mascotStore.clearPendingLevelUp();
};

/**
 * 計測状態に応じた注記。注記が不要な場合はnull。
 * 数値そのものは計測状態にかかわらず常に表示し、測れた分だけを見せたうえで
 * 足りない可能性をこの注記で補う
 */
const measurementNote = computed(() => {
  if (walkStore.measurementStatus === MEASUREMENT_STATUS.UNAVAILABLE) {
    return '位置情報を取得できなかったため、実績を計測できませんでした';
  }

  if (walkStore.measurementStatus === MEASUREMENT_STATUS.PARTIAL) {
    return '一部の区間を計測できなかったため、実際より短く表示されている可能性があります';
  }

  return null;
});

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
    <template #background>
      <div class="paper-map-bg" />
    </template>

    <!--
      レベルアップ演出。今回の散歩でレベルが上がったときだけ、結果の本体より手前に出す。
      遷移前に判定済みのため最初から表示でき、結果が一瞬ちらつかない。
      閉じると（最後の段で close）結果の本体だけが残る。
    -->
    <MascotLevelUpCelebration
      v-if="isCelebrationVisible"
      :levels="celebrationLevels"
      @close="closeCelebration"
    />

    <!-- 演出中は結果の本体を隠し、閉じてから見せる（演出 → 結果の順にする） -->
    <div
      v-if="!isCelebrationVisible"
      class="result-content"
    >
      <div class="result-body">
        <MascotSpeechBubble
          class="result-mascot"
          :level="mascotStore.mascotLevel"
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

          <!-- 今終えた散歩の分を含めた経験値を出す（遷移前に取り直し済み） -->
          <template
            v-if="mascotStore.hasExperience"
            #experience
          >
            <MascotExperienceBar
              :level-progress="mascotStore.levelProgress"
              :total-experience-points="mascotStore.totalExperiencePoints"
              size="large"
            />
          </template>
        </MascotSpeechBubble>

        <WalkResultStats
          :distance-km="walkStore.totalDistanceKm"
          :spot-count="walkStore.spotCount"
          :duration-minutes="walkStore.elapsedMinutes"
        />

        <p
          v-if="measurementNote"
          class="hint"
          role="status"
        >
          {{ measurementNote }}
        </p>
      </div>
    </div>

    <!--
      ボタンは画面に固定せず、本文の下に置く。
      固定すると本文がボタンの裏へ回り込むため、その分の余白を本文に足す必要があり、
      低い端末では余白のせいで画面がスクロールしていた。
    -->
    <template #footer>
      <div class="result-footer">
        <BaseButton @click="handleReturnHome">
          ホームに戻る
        </BaseButton>
      </div>
    </template>
  </DefaultLayout>
</template>

<style scoped>
/*
 * 上下の余りを均等に分けて、本文を画面の中央へ寄せる。
 * 収まりきらない場合は余りが0になり、上端から並ぶ（中央寄せで上端が切れるのを防ぐ）。
 */
.result-body {
  margin: auto 0;
}

/* 実績の一覧との間を空ける */
.result-mascot {
  margin-bottom: calc(10px + var(--fit) * 22);
}

/*
 * 吹き出しの中に入るため、画面見出しの大きさ（global.css）ではなく
 * 吹き出しに収まる大きさにする。
 */
.result-title {
  font-family: var(--font-display);
  font-size: calc(18px + var(--fit) * 3);
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--primary-color);
  margin-bottom: calc(2px + var(--fit) * 4);
}

.result-note {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.8;
  color: var(--text-gray);
}

/*
 * 背景の絵（.paper-map-bg、position: fixed）より手前に出すため、位置指定を持たせる。
 * 消すと「ホームに戻る」が絵の下に隠れる（理由は global.css の .result-content を参照）。
 */
.result-footer {
  position: relative;
  z-index: 1;
  padding: calc(4px + var(--fit) * 8) 20px calc(14px + var(--fit) * 14);
}
</style>
