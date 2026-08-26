<script setup>
/**
 * @description 確認用のモーダル部品。
 * 表示の可否は親が制御し、選択結果はemitで通知する。
 */
defineProps({
  /** 確認メッセージ */
  message: {
    type: String,
    required: true
  },
  /** 実行ボタンのラベル */
  confirmLabel: {
    type: String,
    default: 'OK'
  },
  /** 取消ボタンのラベル */
  cancelLabel: {
    type: String,
    default: 'キャンセル'
  }
});

defineEmits(['confirm', 'cancel']);
</script>

<template>
  <div
    class="popup"
    role="dialog"
    aria-modal="true"
  >
    <div class="popup-content">
      <p>{{ message }}</p>
      <div class="popup-buttons">
        <button
          class="popup-btn secondary"
          type="button"
          @click="$emit('cancel')"
        >
          {{ cancelLabel }}
        </button>
        <button
          class="popup-btn primary"
          type="button"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
