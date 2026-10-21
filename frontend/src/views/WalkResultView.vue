<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/base/BaseButton.vue';
import BaseToast from '@/components/base/BaseToast.vue';
import DefaultLayout from '@/components/layout/DefaultLayout.vue';
import MascotExperienceBar from '@/components/feature/mascot/MascotExperienceBar.vue';
import MascotLevelUpCelebration from '@/components/feature/mascot/MascotLevelUpCelebration.vue';
import MascotSpeechBubble from '@/components/feature/mascot/MascotSpeechBubble.vue';
import WalkResultStats from '@/components/feature/walk/WalkResultStats.vue';
import { useMascotLevelUp } from '@/composables/useMascotLevelUp';
import { useToastMessage } from '@/composables/useToastMessage';
import { useWalkResultSave } from '@/composables/useWalkResultSave';
import { useMascotStore } from '@/stores/mascotStore';
import { useRouteStore } from '@/stores/routeStore';
import { MEASUREMENT_STATUS, useWalkStore } from '@/stores/walkStore';

/**
 * @description 散歩結果を表示する画面。
 * 集計値は案内中に計測した実績（walkStore）から表示する。
 * ルート作成時の予測値は使わない。
 * 労いの言葉はマスコットが吹き出しで話す。
 *
 * 実績のサーバーへの保存もこの画面で起こす。案内画面で起こすと、`router.push` の
 * 直後に案内画面が破棄され、保存の成否を結果画面から読めなくなる。
 * この画面で起こせば、保存の起点と結果の表示先が同じコンポーネントに収まる。
 * 案内画面側は `endWalk()` → `push` だけなので、保存を一切待たない。
 */
const router = useRouter();
const mascotStore = useMascotStore();
const routeStore = useRouteStore();
const walkStore = useWalkStore();
const {
  message: toastMessage,
  showMessage,
  hideMessage
} = useToastMessage();
// 保存中であることは画面に出さないため isSaving は受け取らない。
// 実績は既に確定していて利用者の操作を待たせる必要がなく、
// スピナーを出すとかえって失敗したように見える
const { saveErrorMessage, saveCurrentWalkResult } = useWalkResultSave();
// レベルアップの検知と、お祝い演出に見せるレベルの一覧を持つ
const {
  isCelebrationVisible,
  celebrationLevels,
  captureBeforeLoad,
  detectLevelUp,
  closeCelebration
} = useMascotLevelUp();

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

// 描画された時点のストアには確定した実績が入っている（endWalk は遷移前に呼ばれる）。
// 「ホームに戻る」の resetWalk() より前に送る内容を確定させるため、ここで起こす
onMounted(async () => {
  const isSucceeded = await saveCurrentWalkResult();

  if (!isSucceeded) {
    showMessage(saveErrorMessage.value ?? '実績を保存できませんでした');
  }

  // 取り直す前のレベルを控える。これと取り直した後のレベルを比べて
  // 今回の散歩でレベルが上がったかを判定する（実績未取得で来た場合は控えない）
  captureBeforeLoad();

  // 保存の後に取り直すことで、今終えた散歩の分を含めたレベルと経験値が見える。
  // 保存に失敗した場合でも呼ぶ（値は前のままだが、取り直しても害はない）
  await mascotStore.loadExperience();

  // 取り直した後のレベルと比べ、上がっていればお祝い演出を起こす
  detectLevelUp();
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

    <BaseToast
      v-if="toastMessage"
      :message="toastMessage"
      @close="hideMessage"
    />

    <!--
      レベルアップ演出。今回の散歩でレベルが上がったときだけ、結果画面の上に重ねる。
      閉じると（最後の段で close）通常の結果画面に戻る。
    -->
    <MascotLevelUpCelebration
      v-if="isCelebrationVisible"
      :levels="celebrationLevels"
      @close="closeCelebration"
    />

    <div class="result-content">
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

          <!-- 今終えた散歩の分を含めた経験値を出す（保存の直後に取り直している） -->
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
