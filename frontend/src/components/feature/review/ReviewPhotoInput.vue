<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';

/**
 * @description 口コミ写真を選ぶ入力部品（最大枚数まで）。
 * 選んだファイルは親がmodelValueで保持し、ここではサムネイル表示と追加・削除のみ行う。
 * 画像はアップロード前のFileのまま扱い、プレビューはオブジェクトURLで表示する。
 */
const props = defineProps({
  /** 選択中のファイル（File の配列） */
  modelValue: {
    type: Array,
    required: true
  },
  /** 選べる最大枚数 */
  maxCount: {
    type: Number,
    default: 4
  }
});

const emit = defineEmits(['update:modelValue']);

/** プレビュー用のオブジェクトURL。modelValueに追従して作り直す */
const previewUrls = ref([]);

/**
 * @description プレビュー用URLを作り直す（古いURLは解放する）
 * @returns {void}
 */
const rebuildPreviews = () => {
  previewUrls.value.forEach((url) => URL.revokeObjectURL(url));
  previewUrls.value = props.modelValue.map((file) => URL.createObjectURL(file));
};

watch(() => props.modelValue, rebuildPreviews, { immediate: true });

// 画面を離れるときにオブジェクトURLを解放する
onBeforeUnmount(() => {
  previewUrls.value.forEach((url) => URL.revokeObjectURL(url));
});

/** これ以上追加できるか */
const canAdd = computed(() => props.modelValue.length < props.maxCount);

/**
 * @description 選ばれたファイルを上限まで追加する
 * @param {Event} event ファイル選択イベント
 * @returns {void}
 */
const handleSelect = (event) => {
  const picked = Array.from(event.target.files ?? []);
  const room = props.maxCount - props.modelValue.length;

  emit('update:modelValue', [...props.modelValue, ...picked.slice(0, room)]);

  // 同じファイルを選び直せるよう入力をクリアする
  event.target.value = '';
};

/**
 * @description 指定位置の写真を取り除く
 * @param {number} index 取り除く位置
 * @returns {void}
 */
const handleRemove = (index) => {
  emit(
    'update:modelValue',
    props.modelValue.filter((_, position) => position !== index)
  );
};
</script>

<template>
  <div class="photo-input">
    <ul
      v-if="modelValue.length > 0"
      class="photo-list"
    >
      <li
        v-for="(url, index) in previewUrls"
        :key="url"
        class="photo-item"
      >
        <img
          :src="url"
          alt=""
          class="photo-thumb"
        >
        <button
          class="photo-remove"
          type="button"
          aria-label="写真を削除"
          @click="handleRemove(index)"
        >
          ×
        </button>
      </li>
    </ul>

    <label
      v-if="canAdd"
      class="photo-add"
    >
      <span class="photo-add-icon">＋</span>
      <span class="photo-add-text">写真を追加</span>
      <input
        class="photo-add-input"
        type="file"
        accept="image/*"
        multiple
        @change="handleSelect"
      >
    </label>
  </div>
</template>

<style scoped>
.photo-input {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.photo-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.photo-item {
  position: relative;
  width: 56px;
  height: 56px;
}

.photo-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #DDE3E8;
}

.photo-remove {
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

/* 追加ボタン（破線の枠）。ファイル入力は視覚的に隠してラベルで受ける */
.photo-add {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 1px dashed #B6C0CA;
  border-radius: 8px;
  color: var(--text-gray);
  cursor: pointer;
}

.photo-add-icon {
  font-size: 18px;
  line-height: 1;
}

.photo-add-text {
  margin-top: 2px;
  font-size: 10px;
}

.photo-add-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
