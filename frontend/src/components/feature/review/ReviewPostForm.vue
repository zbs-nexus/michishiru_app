<script setup>
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ReviewPhotoInput from '@/components/feature/review/ReviewPhotoInput.vue';
import ReviewRatingInput from '@/components/feature/review/ReviewRatingInput.vue';

/** 1つの場所に付けられる写真の最大枚数 */
const PHOTO_MAX_COUNT = 4;

/**
 * @description 画面下部に表示する口コミ投稿フォーム。
 * ロケーション名・ジャンル・5段階評価を入力し、投稿内容をemitで親へ返す。
 *
 * 投稿済みの場所（existingSpot あり）では、名前とジャンルは初回投稿者が決めた値に
 * 固定し、評価のみ入力できる「評価のみモード」になる。
 * ジャンルの選択肢は親（View）がDBから取得して渡す。
 */
const props = defineProps({
  /** ジャンルの選択肢（検索条件マスタ由来）。{ value, label, icon } の配列 */
  genreOptions: {
    type: Array,
    required: true
  },
  /** 対象のピンの座標 { lng, lat }。別の場所に変わったら入力をリセットする */
  pinPosition: {
    type: Object,
    default: null
  },
  /**
   * 投稿済みの既存の場所。ある場合は評価のみモードになり、
   * 名前・ジャンルは固定表示にする。未投稿の場所の場合はnull。
   */
  existingSpot: {
    type: Object,
    default: null
  },
  /** 呼び出し元がこの場所に既に付けている評価。初期値として反映する */
  initialRating: {
    type: Number,
    default: 0
  },
  /** 場所の解決中かどうか（投稿ボタンを押せないようにする） */
  isResolving: {
    type: Boolean,
    default: false
  },
  /** 投稿中かどうか（二重送信を防ぐ） */
  isPosting: {
    type: Boolean,
    default: false
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
const rating = ref(props.initialRating);

/** 選択中の写真（アップロード前のFile。初回投稿のみ） */
const photos = ref([]);

/** 評価のみモードか（投稿済みの場所） */
const isRatingOnly = computed(() => props.existingSpot !== null);

/** 評価のみモードで固定表示するジャンル（アイコン・名称） */
const existingGenre = computed(() => {
  if (props.existingSpot === null) {
    return null;
  }

  const matched = props.genreOptions.find(
    (option) => option.value === props.existingSpot.genreId
  );

  return {
    icon: matched?.icon ?? '',
    label: props.existingSpot.genreName ?? matched?.label ?? props.existingSpot.genreId
  };
});

/** 評価のみモードで表示する平均評価のラベル */
const averageLabel = computed(() => {
  if (props.existingSpot === null) {
    return '';
  }

  return `${props.existingSpot.ratingAverage.toFixed(1)}（${props.existingSpot.ratingCount}件）`;
});

/**
 * @description 入力内容を初期状態へ戻す（評価は既存評価があればその値にする）
 * @returns {void}
 */
const resetInputs = () => {
  spotName.value = '';
  selectedGenreId.value = null;
  rating.value = props.initialRating;
  photos.value = [];
};

// ピンが別の場所に立て直されたら、前の場所の入力を持ち越さないようにする
watch(
  () => props.pinPosition,
  () => {
    resetInputs();
  }
);

// 場所の解決後に既存評価が分かったら、評価の初期値へ反映する
watch(
  () => props.initialRating,
  (value) => {
    rating.value = value;
  }
);

/** 投稿できる状態か */
const canSubmit = computed(() => {
  if (props.isPosting || props.isResolving || rating.value <= 0) {
    return false;
  }

  // 評価のみモードは評価だけで投稿できる
  if (isRatingOnly.value) {
    return true;
  }

  // 初回はロケーション名とジャンルも必要
  return spotName.value.trim().length > 0 && selectedGenreId.value !== null;
});

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
 * 評価のみモードでは名前・ジャンルを送らない（nullにする）。
 * @returns {void}
 */
const handleSubmit = () => {
  if (!canSubmit.value) {
    return;
  }

  if (isRatingOnly.value) {
    emit('submitReview', {
      spotName: null,
      genreId: null,
      genreName: null,
      rating: rating.value,
      photos: []
    });
    return;
  }

  const selectedGenre = props.genreOptions.find(
    (option) => option.value === selectedGenreId.value
  );

  emit('submitReview', {
    spotName: spotName.value.trim(),
    genreId: selectedGenreId.value,
    genreName: selectedGenre?.label ?? null,
    rating: rating.value,
    photos: photos.value
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

    <!-- 投稿済みの場所: 名前・ジャンルは固定表示にし、評価のみ受け付ける -->
    <template v-if="isRatingOnly">
      <div class="review-existing">
        <p class="review-existing-name">
          {{ existingSpot.spotName }}
        </p>
        <p class="review-existing-meta">
          <span class="review-existing-genre">
            <span>{{ existingGenre.icon }}</span>
            <span>{{ existingGenre.label }}</span>
          </span>
          <span class="review-existing-average">平均 ★{{ averageLabel }}</span>
        </p>
        <ul
          v-if="existingSpot.photoUrls && existingSpot.photoUrls.length > 0"
          class="review-existing-photos"
        >
          <li
            v-for="(url, index) in existingSpot.photoUrls"
            :key="index"
          >
            <img
              :src="url"
              alt=""
              class="review-existing-photo"
            >
          </li>
        </ul>
      </div>
    </template>

    <!-- 未投稿の場所: ロケーション名とジャンルを入力する -->
    <template v-else>
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
        <span class="review-label">写真（最大{{ PHOTO_MAX_COUNT }}枚・任意）</span>
        <ReviewPhotoInput
          v-model="photos"
          :max-count="PHOTO_MAX_COUNT"
        />
      </div>
    </template>

    <div class="review-footer">
      <div class="review-rating">
        <span class="review-label review-label-inline">評価</span>
        <ReviewRatingInput v-model="rating" />
      </div>

      <BaseButton
        class="review-submit"
        :is-disabled="!canSubmit"
        @click="handleSubmit"
      >
        投稿
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
/*
 * 全画面地図の上に、画面下部から現れる投稿フォーム。
 * 終了ボタン（global.css の .primary-btn.full-width、z-index: 50）に重ねてよいため、
 * 画面下端に固定し、より手前（z-index: 150）に置く。
 */
.review-form {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  width: 100%;
  max-width: 430px;
  max-height: 85vh;
  overflow-y: auto;
  padding: 10px 20px 16px;
  background: var(--white);
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.2);
  animation: review-form-slide-in 0.2s ease-out;
}

.review-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
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
  margin-bottom: 12px;
}

.review-label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-dark);
}

/* 評価の行では、ラベルを星の左に小さく添える */
.review-label-inline {
  margin-bottom: 0;
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
  gap: 8px;
}

/* 全画面地図の上に重ねるフォームなので、ホームより少し詰めて高さを抑える */
.genre-grid .select-btn {
  padding: 10px 6px;
}

.genre-grid .btn-icon {
  margin-bottom: 2px;
  font-size: 20px;
}

.review-hint {
  font-size: 12px;
  color: var(--text-gray);
}

/* 投稿済みの場所の固定表示（名前・ジャンル・平均） */
.review-existing {
  margin-bottom: 12px;
}

.review-existing-name {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-dark);
}

.review-existing-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 4px;
  font-size: 13px;
  color: var(--text-gray);
}

.review-existing-genre {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* 投稿済みの場所に付いている写真のサムネイル */
.review-existing-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.review-existing-photo {
  width: 56px;
  height: 56px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #DDE3E8;
}

/* 評価と投稿ボタンを1行に並べ、全幅ボタンの分の高さを節約する */
.review-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
}

.review-rating {
  display: flex;
  align-items: center;
  gap: 8px;
}

/*
 * 投稿ボタンは行内に収まる幅にしつつ、押しやすい高さ（約44px）を保つ。
 * BaseButtonのルート要素に review-submit クラスが合流するため、primary-btn と併せて指定する。
 */
.review-submit.primary-btn {
  width: auto;
  min-width: 88px;
  padding: 12px 20px;
}

@keyframes review-form-slide-in {
  from {
    opacity: 0;
    transform: translate(-50%, 16px);
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
