<script setup>
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ReviewPhotoInput from '@/components/feature/review/ReviewPhotoInput.vue';
import ReviewRatingInput from '@/components/feature/review/ReviewRatingInput.vue';

/** 1つの場所に付けられる写真の最大枚数 */
const PHOTO_MAX_COUNT = 4;

/**
 * @description 画面下部に表示する口コミ投稿フォーム。
 * 3つのモードがある。
 * - 新規: 未投稿の場所。ロケーション名・ジャンル・評価・写真を入力して作成する。
 * - 本人編集: 作成者本人が既存の場所を開いたとき。名前・ジャンル・写真・評価を編集できる。
 * - 評価のみ: 他ユーザーが作った場所。名前・ジャンルは固定表示で、評価だけ付けられる。
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
  /** 投稿済みの既存の場所。未投稿の場合はnull */
  existingSpot: {
    type: Object,
    default: null
  },
  /** 呼び出し元がその場所の作成者か（本人なら名前・ジャンル・写真も編集できる） */
  isOwner: {
    type: Boolean,
    default: false
  },
  /** 呼び出し元がこの場所に既に付けている評価。初期値として反映する */
  initialRating: {
    type: Number,
    default: 0
  },
  /** 既存の写真（{ key, url } の配列）。本人編集で削除候補として扱う */
  existingPhotos: {
    type: Array,
    default: () => []
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

/** 新しくアップロードする写真（File） */
const photos = ref([]);

/** 残す既存写真（{ key, url }）。本人編集で削除すると減る */
const keptPhotos = ref([]);

/** 拡大表示中の写真URL。nullのときは非表示 */
const viewingPhotoUrl = ref(null);

/** 投稿ボタン押下時の未入力エラー。満たしていればnull */
const validationMessage = ref(null);

/** 評価のみモードか（他ユーザーが作った場所） */
const isRatingOnly = computed(() => props.existingSpot !== null && !props.isOwner);

/** 本人編集モードか（自分が作った既存の場所） */
const isEditing = computed(() => props.existingSpot !== null && props.isOwner);

/** フォームの見出し */
const formTitle = computed(() => (isEditing.value ? '口コミを編集' : '口コミを投稿'));

/** 追加できる新規写真の残り枠（既存の残しぶんを差し引く） */
const newPhotoRoom = computed(() => PHOTO_MAX_COUNT - keptPhotos.value.length);

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
 * @description 入力内容を初期状態へ戻す（新規の場所向けの既定値）
 * @returns {void}
 */
const resetInputs = () => {
  spotName.value = '';
  selectedGenreId.value = null;
  rating.value = props.initialRating;
  photos.value = [];
  keptPhotos.value = [];
  validationMessage.value = null;
};

/**
 * @description 本人編集のとき、既存の値をフォームへ反映する
 * @returns {void}
 */
const prefillForEditing = () => {
  if (!isEditing.value) {
    return;
  }

  spotName.value = props.existingSpot.spotName ?? '';
  selectedGenreId.value = props.existingSpot.genreId ?? null;
  keptPhotos.value = [...props.existingPhotos];
};

// ピンが別の場所に立て直されたら、前の場所の入力を持ち越さない
watch(
  () => props.pinPosition,
  () => {
    resetInputs();
  }
);

// 場所の解決後に既存情報が分かったら、本人編集ならプリフィルする
watch(
  () => props.existingSpot,
  () => {
    resetInputs();
    prefillForEditing();
  }
);

// 解決後に既存評価が分かったら、評価の初期値へ反映する
watch(
  () => props.initialRating,
  (value) => {
    rating.value = value;
  }
);

// 入力が変わったら未入力エラーを消す（直したのに警告が残らないように）
watch([spotName, selectedGenreId, rating], () => {
  validationMessage.value = null;
});

/** 送信中・解決中は投稿ボタンを押せないようにする（二重送信・解決前の送信を防ぐ） */
const isBusy = computed(() => props.isPosting || props.isResolving);

/**
 * @description 未入力の必須項目から、投稿できない理由のメッセージを組み立てる。
 * 新規・本人編集はロケーション名・ジャンル・評価、評価のみモードは評価が必須。
 * @returns {string|null} 不足があればメッセージ、満たしていればnull
 */
const buildValidationMessage = () => {
  const missing = [];

  if (!isRatingOnly.value) {
    if (spotName.value.trim().length === 0) {
      missing.push('ロケーション名');
    }
    if (selectedGenreId.value === null) {
      missing.push('ジャンル');
    }
  }

  if (rating.value <= 0) {
    missing.push('5段階評価');
  }

  return missing.length > 0 ? `${missing.join('・')}を入力してください` : null;
};

/**
 * @description ジャンルを選択する
 * @param {string} genreId 選択したジャンルのID
 * @returns {void}
 */
const handleSelectGenre = (genreId) => {
  selectedGenreId.value = genreId;
};

/**
 * @description 残す既存写真から1枚を取り除く（本人編集）
 * @param {number} index 取り除く位置
 * @returns {void}
 */
const handleRemoveKeptPhoto = (index) => {
  keptPhotos.value = keptPhotos.value.filter((_, position) => position !== index);
};

/**
 * @description 写真を原寸で拡大表示する
 * @param {string} url 表示する写真のURL
 * @returns {void}
 */
const openPhotoViewer = (url) => {
  viewingPhotoUrl.value = url;
};

/**
 * @description 拡大表示を閉じる
 * @returns {void}
 */
const closePhotoViewer = () => {
  viewingPhotoUrl.value = null;
};

/**
 * @description 入力内容を投稿として親へ通知する。
 * 評価のみモードでは名前・ジャンル・写真を送らない。
 * 本人編集・新規では、残す既存写真のキーと新規写真を渡す。
 * @returns {void}
 */
const handleSubmit = () => {
  if (isBusy.value) {
    return;
  }

  // 必須が欠けていればエラーを表示して送らない
  const message = buildValidationMessage();

  if (message !== null) {
    validationMessage.value = message;
    return;
  }

  validationMessage.value = null;

  if (isRatingOnly.value) {
    emit('submitReview', {
      spotName: null,
      genreId: null,
      genreName: null,
      rating: rating.value,
      photos: [],
      keptPhotoKeys: []
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
    photos: photos.value,
    keptPhotoKeys: keptPhotos.value.map((photo) => photo.key)
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
        {{ formTitle }}
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

    <!-- 評価のみモード（他ユーザーが作った場所）: 名前・ジャンルは固定表示 -->
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
            <button
              class="review-existing-photo-btn"
              type="button"
              aria-label="写真を拡大表示"
              @click="openPhotoViewer(url)"
            >
              <img
                :src="url"
                alt=""
                class="review-existing-photo"
              >
            </button>
          </li>
        </ul>
      </div>
    </template>

    <!-- 新規・本人編集: ロケーション名・ジャンル・写真を入力/編集する -->
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
        <div class="review-photos">
          <!-- 本人編集で残している既存写真（削除可・タップで拡大） -->
          <ul
            v-if="keptPhotos.length > 0"
            class="kept-photo-list"
          >
            <li
              v-for="(photo, index) in keptPhotos"
              :key="photo.key"
              class="kept-photo-item"
            >
              <button
                class="kept-photo-btn"
                type="button"
                aria-label="写真を拡大表示"
                @click="openPhotoViewer(photo.url)"
              >
                <img
                  :src="photo.url"
                  alt=""
                  class="kept-photo-thumb"
                >
              </button>
              <button
                class="kept-photo-remove"
                type="button"
                aria-label="写真を削除"
                @click="handleRemoveKeptPhoto(index)"
              >
                ×
              </button>
            </li>
          </ul>

          <ReviewPhotoInput
            v-model="photos"
            :max-count="newPhotoRoom"
            @view="openPhotoViewer"
          />
        </div>
      </div>
    </template>

    <p
      v-if="validationMessage"
      class="review-error"
      role="alert"
    >
      {{ validationMessage }}
    </p>

    <div class="review-footer">
      <div class="review-rating">
        <span class="review-label review-label-inline">評価</span>
        <ReviewRatingInput v-model="rating" />
      </div>

      <BaseButton
        class="review-submit"
        :is-disabled="isBusy"
        @click="handleSubmit"
      >
        投稿
      </BaseButton>
    </div>

    <!-- 写真の原寸表示（ライトボックス） -->
    <div
      v-if="viewingPhotoUrl"
      class="photo-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="写真の拡大表示"
      @click="closePhotoViewer"
    >
      <img
        :src="viewingPhotoUrl"
        alt=""
        class="photo-viewer-image"
      >
      <button
        class="photo-viewer-close"
        type="button"
        aria-label="閉じる"
        @click="closePhotoViewer"
      >
        ×
      </button>
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

/* 写真欄（既存の残しぶん＋新規追加） */
.review-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.kept-photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.kept-photo-item {
  position: relative;
  width: 56px;
  height: 56px;
}

.kept-photo-btn {
  display: block;
  width: 100%;
  height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.kept-photo-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #DDE3E8;
}

.kept-photo-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 13px;
  line-height: 1;
  color: var(--white);
  background: rgba(45, 62, 80, 0.9);
  border: none;
  border-radius: 50%;
  cursor: pointer;
}

/* 投稿済みの場所に付いている写真のサムネイル */
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

.review-existing-photos {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.review-existing-photo-btn {
  display: block;
  width: 56px;
  height: 56px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.review-existing-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #DDE3E8;
}

/* 投稿ボタン押下時の未入力エラー */
.review-error {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #D93025;
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

/* 写真の原寸表示（ライトボックス）。フォームより手前に全画面で出す */
.photo-viewer {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.85);
  cursor: zoom-out;
}

.photo-viewer-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.photo-viewer-close {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 40px;
  height: 40px;
  padding: 0;
  font-size: 24px;
  line-height: 1;
  color: var(--white);
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  cursor: pointer;
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
