<script setup>
import { computed } from 'vue';
import BaseSlider from '@/components/base/BaseSlider.vue';
import { getGenreImage } from '@/constants/genreImages';

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
  },
  /**
   * チュートリアルで合わせさせる距離の上限（km）。
   * 距離の区画が有効なとき、スライダーの目盛り・可動域は本番と同じ（上限10km）に保ちつつ、
   * 選べる値だけをこの値（5km）で頭打ちにする。これより右へはドラッグし続けても動かない。
   * null のときは頭打ちにしない。
   */
  tutorialMaxDistanceKm: {
    type: Number,
    default: null
  }
});

defineEmits(['selectGenre', 'selectDistance', 'toggleGenreRandom', 'toggleDistanceRandom']);

/**
 * スライダーで選べる値の上限（km）。
 * チュートリアルで距離を操作させる段階では、目盛りの上限（10km）は本番と同じに保ったまま、
 * 選べる値だけを tutorialMaxDistanceKm（5km）で頭打ちにする。
 * BaseSlider がドラッグ中もこの値で押し戻すため、5kmより右へは動かせない。
 * 頭打ちしない場合は null。
 */
const distanceValueMaxKm = computed(() => {
  if (props.isTutorial && props.tutorialMaxDistanceKm !== null) {
    return props.tutorialMaxDistanceKm;
  }

  return null;
});

/**
 * 距離スライダーの目盛り。本番と同じく、マスタの下限と上限（10km）のラベルを表示する。
 * チュートリアルでも可動域は変えず、選べる値だけを頭打ちにするため目盛りは本番のままにする。
 */
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
 * ジャンルの区画が有効なときは、対象のジャンル（tutorialGenreValue）以外を無効にする。
 * ジャンルを選び終えた後（距離・作成の段階）は、選択済みのジャンルだけ押せるまま残し、
 * それ以外を無効にして選び直しを防ぐ。選択済みは見た目も薄くしない。
 * チュートリアル外では常に押せる。
 * @param {string} value ジャンルの値（genreId）
 * @returns {boolean} 無効にする場合はtrue
 */
const isGenreButtonLocked = (value) => {
  if (!props.isTutorial) {
    return false;
  }

  // ジャンルを選ぶ段階では、対象のジャンルだけ押せるようにする
  if (isTutorialGenreActive.value) {
    return value !== props.tutorialGenreValue;
  }

  // 選び終えた後は、今選ばれているジャンル以外を無効にする（選択済みは押せるまま＝固定）
  return value !== props.genre;
};

/**
 * @description チュートリアル中に、ジャンルのボタンを薄く（ロック表示）するか判定する。
 * 無効でも、選択済みのジャンルは固定したうえで通常の見た目を保つため薄くしない。
 * @param {string} value ジャンルの値（genreId）
 * @returns {boolean} 薄くする場合はtrue
 */
const isGenreButtonDimmed = (value) => {
  // 選択済みのジャンルは、ロック（選び直し防止）していても薄くしない
  if (props.isTutorial && value === props.genre) {
    return false;
  }

  return isGenreButtonLocked(value);
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
            'is-tutorial-locked': isGenreButtonDimmed(option.value),
            'is-tutorial-target':
              isTutorialGenreActive && option.value === tutorialGenreValue
          }"
          type="button"
          :aria-pressed="genre === option.value"
          :disabled="isGenreButtonLocked(option.value)"
          @click="$emit('selectGenre', option.value)"
        >
          <!--
            ジャンルのアイコンは同梱した画像に固定する（option.icon の絵文字は使わない）。
            画像はラベルで内容が分かるため、読み上げの重複を避けて装飾扱い（alt は空）にする。
            対応する画像が無いジャンルは画像を出さず、ラベルだけを見せる。
          -->
          <span class="btn-icon">
            <img
              v-if="getGenreImage(option.value, option.label)"
              class="btn-icon-image"
              :src="getGenreImage(option.value, option.label)"
              alt=""
            >
          </span>
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
          :value-max-value="distanceValueMaxKm"
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

/*
 * チュートリアル中のおまかせ。チュートリアルは必ず手動で選ばせる一本道にするため
 * disabled で押せなくしている。押せないことが見た目でも分かるよう淡くする。
 */
.random-icon-btn:disabled {
  opacity: 0.4;
  filter: grayscale(0.5);
  cursor: not-allowed;
}

.random-icon-btn:disabled:hover {
  border-color: var(--border-ink);
  background-color: var(--surface);
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

/*
 * ジャンルのアイコン画像。
 * 背景を透過したピクセルアートのため、額縁は付けず絵柄だけを見せる。
 * 絵文字のときと同じ程度の大きさ（global.css の .btn-icon の font-size を踏襲）で、
 * 画面の高さに合わせて少し伸び縮みさせる。
 * contain で全体を収め、ピクセルの輪郭がにじまないよう最近傍で拡大する。
 */
.btn-icon-image {
  display: block;
  width: calc(28px + var(--fit) * 8);
  height: calc(28px + var(--fit) * 8);
  object-fit: contain;
  image-rendering: pixelated;
}
</style>
