<script setup>
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/base/BaseButton.vue';
import ReviewPhotoInput from '@/components/feature/review/ReviewPhotoInput.vue';
import ReviewPhotoViewer from '@/components/feature/review/ReviewPhotoViewer.vue';
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
  },
  /**
   * チュートリアルの案内文。チュートリアル中のみ渡し、フォーム上部に案内として出す。
   * 渡されない（null）ときはチュートリアル表示を一切行わない。
   */
  tutorialMessage: {
    type: String,
    default: null
  },
  /**
   * チュートリアルで強調する要素。
   * 'rating' は評価の★を、'submit' は投稿ボタンを目立たせる。チュートリアル外ではnull。
   */
  tutorialHighlight: {
    type: String,
    default: null
  }
});

const emit = defineEmits(['submitReview', 'close', 'changeExpanded', 'changeRating']);

/** ロケーション名の最大文字数 */
const SPOT_NAME_MAX_LENGTH = 30;

/** 上下スワイプを展開・収納と判定する最小の移動量（ピクセル） */
const SWIPE_THRESHOLD_PX = 24;

/**
 * フォームを全体表示しているかどうか。
 * 既定は半分（地図とピンが見えるように）で、上スワイプまたはハンドルの操作で広げる。
 */
const isExpanded = ref(false);

/** スワイプの開始位置（画面のY座標）。触れていないときはnull */
let swipeStartY = null;

/** 直前の操作がスワイプだったか。touchendに続くclickで二重に切り替えないための目印 */
let hasSwiped = false;

/**
 * @description 表示の高さを切り替え、変わった場合だけ親へ知らせる。
 * 親は可視範囲が変わったぶん、ピンの寄せ位置を測り直す。
 * @param {boolean} value 全体表示にするかどうか
 * @returns {void}
 */
const setExpanded = (value) => {
  if (isExpanded.value === value) {
    return;
  }

  isExpanded.value = value;
  emit('changeExpanded', value);
};

/**
 * @description スワイプの開始位置を覚える
 * @param {TouchEvent} event タッチイベント
 * @returns {void}
 */
const handleSwipeStart = (event) => {
  swipeStartY = event.touches[0].clientY;
  hasSwiped = false;
};

/**
 * @description 指を離した位置から、上スワイプなら展開、下スワイプなら収納する
 * @param {TouchEvent} event タッチイベント
 * @returns {void}
 */
const handleSwipeEnd = (event) => {
  if (swipeStartY === null) {
    return;
  }

  const movedY = event.changedTouches[0].clientY - swipeStartY;
  swipeStartY = null;

  if (Math.abs(movedY) < SWIPE_THRESHOLD_PX) {
    return;
  }

  // 続いて発火するclickで元に戻らないよう、ここで打ち切る
  hasSwiped = true;
  event.preventDefault();

  setExpanded(movedY < 0);
};

/**
 * @description ハンドルのタップ・Enterで表示の高さを切り替える。
 * スワイプで既に切り替えた直後は何もしない。
 * @returns {void}
 */
const handleToggleExpanded = () => {
  if (hasSwiped) {
    hasSwiped = false;
    return;
  }

  setExpanded(!isExpanded.value);
};

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

/** 拡大表示する写真のURLの一覧。空のときは非表示 */
const viewerPhotoUrls = ref([]);

/** 拡大表示を開いたときに見せる写真の位置 */
const viewerStartIndex = ref(0);

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

/** 残している既存写真のURLだけを並べたもの。拡大表示の送りに渡す */
const keptPhotoUrls = computed(() => keptPhotos.value.map((photo) => photo.url));

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

/**
 * 投稿済みの場所に表示する、現時点の平均評価と口コミ投稿数のラベル。
 * 新規・本人編集・評価のみの3モードすべてで出す（初回投稿した本人にも見せる）。
 * 集計値が欠けている場合でも表示が壊れないよう0として扱う。
 */
const averageLabel = computed(() => {
  if (props.existingSpot === null) {
    return '';
  }

  const ratingAverage = props.existingSpot.ratingAverage ?? 0;
  const ratingCount = props.existingSpot.ratingCount ?? 0;

  return `${ratingAverage.toFixed(1)}（${ratingCount}件）`;
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

/*
 * 対象の場所、または解決結果が変わったら入力を作り直す。
 *
 * 2つを別のwatchで扱うと、発火の順番によって片方の処理がもう片方を打ち消す。
 * （場所の入れ替えでプリフィルが消える / プリフィル後にリセットが走る）。
 * どちらが変わっても「初期化してからプリフィル」を通すことで、順番に依存しなくなる。
 *
 * immediate を付けるのは、投稿済みのピンを選んだ場合に
 * 解決を終えてからフォームを描くため。このときpropsは最初から確定しており、
 * 変化を待っているとプリフィルが走らず、自分の投稿内容が空のまま表示される。
 */
watch(
  () => [props.pinPosition, props.existingSpot],
  () => {
    resetInputs();
    prefillForEditing();
  },
  { immediate: true }
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
 * @description 利用者が★で評価を付けたときに、値を反映して親へ通知する。
 * initialRating の反映（watch）とは別に、操作による変更だけをここで知らせる。
 * @param {number} value 選択された評価（1〜5）
 * @returns {void}
 */
const handleChangeRating = (value) => {
  rating.value = value;
  emit('changeRating', value);
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
 * @description 写真を全画面で拡大表示する。
 * 同じ場所の写真を送れるようにするため、押された1枚だけでなく一覧と位置を受け取る。
 * @param {{photoUrls: string[], index: number}} params 表示する写真の一覧と位置
 * @returns {void}
 */
const openPhotoViewer = ({ photoUrls, index }) => {
  viewerPhotoUrls.value = photoUrls;
  viewerStartIndex.value = index;
};

/**
 * @description 拡大表示を閉じる
 * @returns {void}
 */
const closePhotoViewer = () => {
  viewerPhotoUrls.value = [];
  viewerStartIndex.value = 0;
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
    :class="{ 'is-expanded': isExpanded }"
    role="dialog"
    aria-modal="false"
    aria-label="口コミを投稿"
  >
    <!--
      高さを切り替えるハンドル。上スワイプで全体表示、下スワイプで半分に戻す。
      タッチ以外でも操作できるようボタンにし、タップとEnterでも切り替える
    -->
    <button
      class="review-form-handle"
      type="button"
      :aria-expanded="isExpanded"
      aria-label="口コミ投稿フォームの表示の高さを切り替える"
      @touchstart="handleSwipeStart"
      @touchend="handleSwipeEnd"
      @click="handleToggleExpanded"
    >
      <span class="review-form-handle-bar" />
    </button>

    <!-- チュートリアル中の案内。フォーム上部に出し、評価・投稿へ誘導する -->
    <p
      v-if="tutorialMessage"
      class="review-tutorial-hint"
      role="status"
    >
      {{ tutorialMessage }}
    </p>

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

    <!--
      投稿済みの場所の集計。モードに依らず出すことで、初回投稿した本人が
      開き直したときも現時点の平均と件数が分かるようにする
    -->
    <p
      v-if="existingSpot !== null"
      class="review-summary"
    >
      平均 ★{{ averageLabel }}
    </p>

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
              @click="openPhotoViewer({ photoUrls: existingSpot.photoUrls, index })"
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
                @click="openPhotoViewer({ photoUrls: keptPhotoUrls, index })"
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
        <ReviewRatingInput
          :model-value="rating"
          @update:model-value="handleChangeRating"
        />
      </div>

      <BaseButton
        class="review-submit"
        :class="{ 'is-tutorial-target': tutorialHighlight === 'submit' }"
        :is-disabled="isBusy"
        @click="handleSubmit"
      >
        投稿
      </BaseButton>
    </div>

    <!-- 写真の全画面表示。複数枚はスワイプ・矢印・キーボードで切り替える -->
    <ReviewPhotoViewer
      v-if="viewerPhotoUrls.length > 0"
      :photo-urls="viewerPhotoUrls"
      :start-index="viewerStartIndex"
      @close="closePhotoViewer"
    />
  </div>
</template>

<style scoped>
/*
 * 全画面地図の上に、画面下部から現れる投稿フォーム。
 * 終了ボタン（global.css の .primary-btn.full-width、z-index: 50）に重ねてよいため、
 * 画面下端に固定し、より手前（z-index: 150）に置く。
 *
 * 初期は半分の高さに留め、立てたピンと地図が見える状態から始める。
 * 上スワイプで全体表示（85vh）に広げる。
 * max-height にアニメーションを付けないのは、親が開閉直後に offsetHeight を測って
 * ピンの寄せ位置を決めるため。途中の高さを測ると寄せ位置がずれる。
 */
.review-form {
  touch-action: manipulation; /* 理由は global.css の共通ルールのコメント */
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  width: 100%;
  max-width: 430px;
  /*
   * vh はスマホではツールバーの分だけ大きくなるため、表示中の高さ（dvh）で測る
   * （dvh に対応していないブラウザ向けに vh を先に書いている）。全体表示も同じ。
   */
  max-height: 42vh;
  max-height: 42dvh;
  overflow-y: auto;
  padding: 0 20px 16px;
  background: var(--surface);
  /* 地図の上に重なるシートなので、上辺と左右に茶の線を回して紙の端を見せる */
  border: 2px solid var(--border-ink);
  border-bottom: none;
  border-radius: 10px 10px 0 0;
  box-shadow: 0 -4px 0 rgba(92,68,48,0.25);
  animation: review-form-slide-in 0.2s ease-out;
}

.review-form.is-expanded {
  max-height: 85vh;
  max-height: 85dvh;
}

/*
 * 高さを切り替えるハンドル。
 * スクロールしても常に見えるよう上端に貼り付け、指で掴める高さを確保する。
 */
.review-form-handle {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 28px;
  padding: 0;
  background: var(--surface);
  border: none;
  cursor: pointer;
  /* ハンドル上の縦スワイプをブラウザのスクロールに取られないようにする */
  touch-action: none;
}

.review-form-handle-bar {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--border-ink);
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
  background: var(--bg-deep);
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
  padding: 10px 12px;
  font-size: 16px;
  border: var(--pixel-frame-width) solid var(--border-ink);
  border-image: var(--pixel-frame-ink);
  background: var(--surface);
  background-clip: padding-box;
  box-shadow: var(--shadow);
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
  border-radius: 6px;
  border: 2px solid var(--border-ink);
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

/* 投稿済みの場所の平均評価と口コミ投稿数 */
.review-summary {
  margin-bottom: 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-gray);
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
  border-radius: 6px;
  border: 2px solid var(--border-ink);
}

/* 投稿ボタン押下時の未入力エラー */
.review-error {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--danger);
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

/* チュートリアルの案内。フォーム上部に羊皮紙色の帯で出す */
.review-tutorial-hint {
  position: sticky;
  top: 28px;
  z-index: 1;
  margin: 0 0 8px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
  color: var(--primary-color);
  background: var(--bg-light);
  border: var(--pixel-frame-width) solid var(--border-ink);
  border-image: var(--pixel-frame-ink);
  background-clip: padding-box;
}

/*
 * チュートリアルで操作させる投稿ボタンを枠で浮かせる。
 * 評価（★）には枠を付けない（星の周りに枠が出て見た目が悪いため）。
 * 評価の段階はフォーム上部の案内文（review-tutorial-hint）で「★をタップ」と誘導する。
 */
.review-submit.is-tutorial-target.primary-btn {
  border-radius: 10px;
  box-shadow: 0 0 0 3px var(--primary-light);
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
