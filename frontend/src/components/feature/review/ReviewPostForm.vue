<script setup>
import { computed, ref } from 'vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ReviewRatingInput from '@/components/feature/review/ReviewRatingInput.vue';

/**
 * @description 画面上部に表示する口コミ投稿フォーム。
 * ロケーション名・ジャンル・5段階評価を入力し、投稿内容をemitで親へ返す。
 * ジャンルの選択肢は親（View）がDBから取得して渡す。
 * 入力値はこのフォーム内で保持し、投稿・閉じるの操作のみを外へ通知する。
 */
const props = defineProps({
  /** ジャンルの選択肢（検索条件マスタ由来）。{ value, label, icon } の配列 */
  genreOptions: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['submitReview', 'close']);

/** ロケーション名の最大文字数 */
const SPOT_NAME_MAX_LENGTH = 30;

/** 入力されたロケーション名 */
const spotName = ref('');

/** 選択中のジャンル（genreId）。未選択はnull */
const selectedGenreId = ref(null);

/** 選択中の評価（0は未選択） */
const rating = ref(0);

/** 投稿できる状態か。名前・ジャンル・評価がすべてそろったら有効にする */
const canSubmit = computed(
  () =>
    spotName.value.trim().length > 0 &&
    selectedGenreId.value !== null &&
    rating.value > 0
);

/**
 * @description ジャンルを選択する
 * @param {string} genreId 選択したジャンルのID
 * @returns {void}
 */
const handleSelectGenre = (genreId) => {
  selectedGenreId.value = genreId;
};

/**
 * @description 入力内容を投稿として親へ通知する。
 * ジャンルは表示名も合わせて渡す（後続の内部処理で使えるようにするため）。
 * @returns {void}
 */
const handleSubmit = () => {
  if (!canSubmit.value) {
    return;
  }

  const selectedGenre = props.genreOptions.find(
    (option) => option.value === selectedGenreId.value
  );

  emit('submitReview', {
    spotName: spotName.value.trim(),
    genreId: selectedGenreId.value,
    genreName: selectedGenre?.label ?? null,
    rating: rating.value
  });
};
</script>

<template>
  <div
    class="review-form"
    role="dialog"
    aria-modal="false"
    aria-label="口コミを投稿"
  >
    <div class="review-form-header">
      <h3 class="review-form-title">
        口コミを投稿
      </h3>
      <button
        class="review-form-close"
        type="button"
        aria-label="閉じる"
        @click="$emit('close')"
      >
        ×
      </button>
    </div>

    <div class="review-field">
      <label
        class="review-label"
        for="review-spot-name"
      >ロケーション名</label>
      <input
        id="review-spot-name"
        v-model="spotName"
        class="review-name-input"
        type="text"
        :maxlength="SPOT_NAME_MAX_LENGTH"
        placeholder="例: 中央公園の東屋"
      >
      <span class="review-char-count">
        {{ spotName.length }} / {{ SPOT_NAME_MAX_LENGTH }}
      </span>
    </div>

    <div class="review-field">
      <span class="review-label">ジャンル</span>
      <p
        v-if="genreOptions.length === 0"
        class="review-hint"
      >
        ジャンルを取得できませんでした
      </p>
      <div
        v-else
        class="genre-grid"
      >
        <button
          v-for="option in genreOptions"
          :key="option.value"
          class="select-btn"
          :class="{ selected: selectedGenreId === option.value }"
          type="button"
          :aria-pressed="selectedGenreId === option.value"
          @click="handleSelectGenre(option.value)"
        >
          <span class="btn-icon">{{ option.icon }}</span>
          <span>{{ option.label }}</span>
        </button>
      </div>
    </div>

    <div class="review-field">
      <span class="review-label">評価</span>
      <ReviewRatingInput v-model="rating" />
    </div>

    <BaseButton
      :is-disabled="!canSubmit"
      @click="handleSubmit"
    >
      投稿する
    </BaseButton>
  </div>
</template>

<style scoped>
/* 全画面地図の上に、画面上部から現れる投稿フォーム */
.review-form {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  width: 100%;
  max-width: 430px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 16px 20px 20px;
  background: var(--white);
  border-radius: 0 0 16px 16px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
  animation: review-form-slide-in 0.2s ease-out;
}

.review-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.review-form-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-dark);
}

.review-form-close {
  width: 32px;
  height: 32px;
  padding: 0;
  font-size: 22px;
  line-height: 1;
  color: var(--text-gray);
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

.review-form-close:hover {
  background: #F0F4F8;
}

.review-field {
  margin-bottom: 18px;
}

.review-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dark);
}

/* 16px未満にするとiOSで入力時に画面が拡大されるため、下げない */
.review-name-input {
  width: 100%;
  padding: 12px 14px;
  font-size: 16px;
  border: 1px solid #DDE3E8;
  border-radius: 10px;
  background: var(--white);
}

.review-name-input:focus {
  outline: 2px solid var(--route-blue);
  outline-offset: 1px;
}

.review-char-count {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--text-gray);
  text-align: right;
}

/* ホーム画面のジャンル選択と同じ見た目にする（.select-btn はグローバル定義） */
.genre-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.review-hint {
  font-size: 12px;
  color: var(--text-gray);
}

@keyframes review-form-slide-in {
  from {
    opacity: 0;
    transform: translate(-50%, -16px);
  }

  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .review-form {
    animation: none;
  }
}
</style>
