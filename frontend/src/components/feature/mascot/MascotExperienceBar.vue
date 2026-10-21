<script setup>
import { computed } from 'vue';

/**
 * @description マスコットの下に置く経験値バー。
 * レベル内の進捗を props で受け取って描くだけを担い、取得も計算も行わない。
 * ゲームの経験値ゲージのように、枠の中を左から塗って次のレベルまでの道のりを示す。
 */
const props = defineProps({
  /**
   * レベルの進捗。utils/mascotLevelProgress.js の toMascotLevelProgress の戻り値。
   * 個別に渡すと props が増えすぎるため、バーが使う値だけをまとめて受け取る
   */
  levelProgress: {
    type: Object,
    required: true
  },
  /** 累計経験値。large のときだけ添える */
  totalExperiencePoints: {
    type: Number,
    default: 0
  },
  /** 表示サイズ。small は数値を出さずバーだけにする */
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  /**
   * 装飾として置くかどうか。
   * 読み上げ範囲（role="status" など）の中に置く場合に真にして、
   * 本文が読み直されるたびに経験値まで読まれるのを防ぐ。
   */
  isDecorative: {
    type: Boolean,
    default: false
  }
});

/** 上限レベルかどうか。塗りを満たして MAX と表示する */
const isMaxLevel = computed(() => props.levelProgress.isMaxLevel === true);

/** 塗りの幅（％）。割合は0〜1に収まっている前提 */
const progressWidth = computed(
  () => `${(props.levelProgress.levelProgressRatio ?? 0) * 100}%`
);

/** 支援技術へ渡す進捗（百分率の整数） */
const progressPercentage = computed(() =>
  Math.round((props.levelProgress.levelProgressRatio ?? 0) * 100)
);

/**
 * @description 数値を3桁区切りの文字列にする
 * @param {number} value 数値
 * @returns {string} 3桁区切りの文字列
 */
const toLocaleNumber = (value) => (value ?? 0).toLocaleString('ja-JP');

/** バーに添える数値。上限レベルでは `x / 0` にならないよう MAX と出す */
const progressLabel = computed(() => {
  if (isMaxLevel.value) {
    return 'MAX';
  }

  return `${toLocaleNumber(props.levelProgress.experienceInCurrentLevel)} / ${toLocaleNumber(props.levelProgress.experienceToNextLevel)}`;
});

/** 読み上げる進捗の説明 */
const progressText = computed(() =>
  isMaxLevel.value ? '最大レベル' : progressLabel.value
);

/** 数値を添えるかどうか。small はバナーに収めるためバーだけにする */
const hasProgressLabel = computed(() => props.size !== 'small');

/** 累計経験値を添えるかどうか。large のときだけ出す */
const hasTotalLabel = computed(() => props.size === 'large');
</script>

<template>
  <div
    class="mascot-experience"
    :class="[`is-${size}`, { 'is-max-level': isMaxLevel }]"
    :aria-hidden="isDecorative ? 'true' : undefined"
  >
    <div
      class="experience-track"
      :role="isDecorative ? undefined : 'progressbar'"
      :aria-label="isDecorative ? undefined : '経験値'"
      :aria-valuemin="isDecorative ? undefined : 0"
      :aria-valuemax="isDecorative ? undefined : 100"
      :aria-valuenow="isDecorative ? undefined : progressPercentage"
      :aria-valuetext="isDecorative ? undefined : progressText"
    >
      <span
        class="experience-fill"
        :style="{ width: progressWidth }"
      />
    </div>

    <p
      v-if="hasProgressLabel"
      class="experience-label"
    >
      <span class="experience-progress">{{ progressLabel }}</span>
      <span
        v-if="hasTotalLabel"
        class="experience-total"
      >累計 {{ toLocaleNumber(totalExperiencePoints) }}</span>
    </p>
  </div>
</template>

<style scoped>
/*
 * マスコットの下に収めるため、幅は置かれた場所に合わせる。
 * 色と書体は :root の変数だけを使い、画面ごとに違う色が混ざらないようにする。
 */
.mascot-experience {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 3px;
  width: 100%;
}

/* バーの地。羊皮紙より沈んだ色に金の縁を回し、枠に溜まった墨のように見せる */
.experience-track {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 8px;
  border: 1px solid var(--border-gold);
  border-radius: 999px;
  background: var(--bg-deep);
}

.mascot-experience.is-small .experience-track {
  height: 6px;
}

.mascot-experience.is-large .experience-track {
  height: 11px;
}

/* 塗り。紫のインクが左から満ちていく */
.experience-fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--primary-light) 0%,
    var(--primary-color) 100%
  );
  transition: width 0.4s ease-out;
}

/* 上限レベルは金で満たし、これ以上積めないことを色で示す */
.mascot-experience.is-max-level .experience-fill {
  background: linear-gradient(
    90deg,
    var(--border-gold) 0%,
    var(--accent-gold) 100%
  );
}

.experience-label {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin: 0;
  font-family: var(--font-display);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-gray);
  /* 数字の幅を揃え、経験値が増えても文字が揺れないようにする */
  font-variant-numeric: tabular-nums;
}

.mascot-experience.is-large .experience-label {
  font-size: 12px;
}

.experience-progress {
  color: var(--primary-color);
}

/* 動きを減らす設定の場合は塗りの伸びを止める */
@media (prefers-reduced-motion: reduce) {
  .experience-fill {
    transition: none;
  }
}
</style>
