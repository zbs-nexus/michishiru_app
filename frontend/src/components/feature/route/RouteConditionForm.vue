<script setup>
import { computed } from 'vue';
import BaseSlider from '@/components/base/BaseSlider.vue';

/**
 * @description ルート作成条件（ジャンル・距離）の入力フォーム。
 * 選択肢は親から受け取り、表示と入力のみを担当する。
 * 値の保持はストア側で行う。
 */
const props = defineProps({
  /** 選択中のジャンル */
  genre: {
    type: String,
    default: null
  },
  /** 選択中の距離（km） */
  distanceKm: {
    type: Number,
    required: true
  },
  /** ジャンルのおまかせ機能が有効か */
  isGenreRandom: {
    type: Boolean,
    required: true
  },
  /** 距離のおまかせ機能が有効か */
  isDistanceRandom: {
    type: Boolean,
    required: true
  },
  /** ジャンルの選択肢 */
  genreOptions: {
    type: Array,
    required: true
  },
  /** 距離の選択範囲 */
  distanceRange: {
    type: Object,
    required: true
  },
  /**
   * チュートリアル中かどうか。
   * 真のとき、tutorialGenreValue で指定したジャンル以外のボタンとおまかせを無効化し、
   * tutorialSection で指定した区画（ジャンル or 距離）だけを操作可能にする。
   */
  isTutorial: {
    type: Boolean,
    default: false
  },
  /**
   * チュートリアルで操作させる区画。
   * 'genre' はジャンルの選択だけ、'distance' は距離の調整だけを有効にする。
   * それ以外（null 等）のときはどちらも無効にする（作成ボタンへ誘導する段階）。
   */
  tutorialSection: {
    type: String,
    default: null
  },
  /**
   * チュートリアルで選ばせるジャンルの値（genreId）。
   * ジャンルの区画が有効なとき、この値のボタンだけを押せるようにする。
   */
  tutorialGenreValue: {
    type: String,
    default: null
  }
});

defineEmits(['selectGenre', 'selectDistance', 'toggleGenreRandom', 'toggleDistanceRandom']);

/** 距離スライダーの目盛り。下限と上限のラベルを表示する */
const distanceScaleLabels = computed(() => [
  props.distanceRange.minLabel,
  props.distanceRange.maxLabel
]);

/** チュートリアルでジャンルの区画を操作させる段階かどうか */
const isTutorialGenreActive = computed(
  () => props.isTutorial && props.tutorialSection === 'genre'
);

/** チュートリアルで距離の区画を操作させる段階かどうか */
const isTutorialDistanceActive = computed(
  () => props.isTutorial && props.tutorialSection === 'distance'
);

/**
 * @description チュートリアル中に、指定したジャンルのボタンを押せないようにするか判定する。
 * ジャンルの区画が有効で、かつ対象のジャンル（tutorialGenreValue）でないボタンを無効にする。
 * チュートリアル外では常に押せる。
 * @param {string} value ジャンルの値（genreId）
 * @returns {boolean} 無効にする場合はtrue
 */
const isGenreButtonLocked = (value) => {
  if (!props.isTutorial) {
    return false;
  }

  // ジャンルの区画が有効なときだけ、対象のジャンル以外を押せるようにする
  return !(isTutorialGenreActive.value && value === props.tutorialGenreValue);
};
</script>

<template>
  <div>
    <div class="input-section">
      <div class="section-header">
        <h3>ジャンル</h3>
        <button
          class="random-icon-btn"
          :class="{ selected: isGenreRandom }"
          type="button"
          :aria-pressed="isGenreRandom"
          aria-label="ジャンルをおまかせで選ぶ"
          :disabled="isTutorial"
          @click="$emit('toggleGenreRandom')"
        >
          おまかせ
        </button>
      </div>
      <div
        v-if="!isGenreRandom"
        class="button-grid"
      >
        <button
          v-for="option in genreOptions"
          :key="option.value"
          class="select-btn"
          :class="{
            selected: genre === option.value,
            'is-tutorial-locked': isGenreButtonLocked(option.value),
            'is-tutorial-target':
              isTutorialGenreActive && option.value === tutorialGenreValue
          }"
          type="button"
          :aria-pressed="genre === option.value"
          :disabled="isGenreButtonLocked(option.value)"
          @click="$emit('selectGenre', option.value)"
        >
          <span class="btn-icon">{{ option.icon }}</span>
          <span>{{ option.label }}</span>
        </button>
      </div>
      <p
        v-else
        class="hint random-message"
      >
        おまかせでジャンルを選択します
      </p>
    </div>

    <div
      class="input-section"
      :class="{
        'is-tutorial-locked': isTutorial && !isTutorialDistanceActive,
        'is-tutorial-target': isTutorialDistanceActive
      }"
    >
      <div class="section-header">
        <h3 id="distance-label">
          距離
        </h3>
        <button
          class="random-icon-btn"
          :class="{ selected: isDistanceRandom }"
          type="button"
          :aria-pressed="isDistanceRandom"
          aria-label="距離をおまかせで選ぶ"
          :disabled="isTutorial"
          @click="$emit('toggleDistanceRandom')"
        >
          おまかせ
        </button>
      </div>
      <template v-if="!isDistanceRandom">
        <BaseSlider
          :model-value="distanceKm"
          :min-value="distanceRange.minKm"
          :max-value="distanceRange.maxKm"
          :scale-labels="distanceScaleLabels"
          unit="km"
          labelled-by="distance-label"
          @update:model-value="$emit('selectDistance', $event)"
        />
        <p class="hint">
          {{ distanceRange.minLabel }} 〜 {{ distanceRange.maxLabel }} の範囲で選べます
        </p>
      </template>
      <p
        v-else
        class="hint random-message"
      >
        おまかせで距離を選択します
      </p>
    </div>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: calc(6px + var(--fit) * 6);
}

/* 見出しの下余白は .section-header が持つため、横並びの中央揃えを崩さないよう消す */
.section-header h3 {
  margin-bottom: 0;
}

/*
 * おまかせの札。選ぶと紫のインクで塗られる。
 * 見出しの行の高さを決めるため、低い画面では少し小さくする（28〜32px）。
 */
.random-icon-btn {
  height: calc(28px + var(--fit) * 4);
  padding: 0 calc(10px + var(--fit) * 2);
  border: 2px solid var(--border-ink);
  border-radius: calc(14px + var(--fit) * 2);
  background-color: var(--surface);
  color: var(--text-dark);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: bold;
  white-space: nowrap;
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: all 0.2s;
}

.random-icon-btn:hover {
  border-color: var(--primary-light);
  background-color: var(--bg-deep);
}

.random-icon-btn.selected {
  border-color: var(--border-ink);
  background-color: var(--primary-color);
  color: var(--white);
}

.random-message {
  color: var(--primary-color);
  font-weight: bold;
}

/*
 * チュートリアルでロックするジャンルのボタン。
 * 操作できないことを見た目でも示すため、暗く・淡くする。
 * disabled と合わせて使い、押下そのものも止める。
 */
.select-btn.is-tutorial-locked {
  opacity: 0.4;
  filter: grayscale(0.5);
  cursor: not-allowed;
}

/*
 * チュートリアルで選ばせる対象のジャンルのボタン。
 * 枠は足さず通常表示のままにする。周りのロック対象（半透明）との対比で際立たせる。
 */
.select-btn.is-tutorial-target {
  position: relative;
  z-index: 1;
}

/*
 * チュートリアルでロックする距離の区画。
 * ジャンルの段階では距離を触らせないため、区画ごと淡くして操作を止める。
 */
.input-section.is-tutorial-locked {
  opacity: 0.4;
  filter: grayscale(0.5);
  pointer-events: none;
}

/*
 * チュートリアルで操作させる距離の区画。枠は足さず通常表示のままにする。
 * 以前は紫の枠（box-shadow）で囲んでいたが、区画の下辺に紺色の線が残って見えるため取りやめた。
 * ジャンルの区画がロック（半透明）される対比で、距離の区画が際立つ。
 */
.input-section.is-tutorial-target {
  position: relative;
  z-index: 1;
}
</style>
