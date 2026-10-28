<script setup>
/**
 * @description 通信の完了を待つ間に、画面全体を覆って文言だけを出す部品。
 * 「記録中…」「投稿中…」のように、待っている間の操作（二度押し・地図の長押しなど）を
 * 物理的に塞ぎ、処理中であることを伝える。表示の可否は親が v-if で制御する。
 *
 * ロード画面（RouteLoadingOverlay）の演出は流用せず、文字だけにする。
 * マスコットも出さない（1画面1体のため。案内画面ではバナーに既にいる）。
 */
defineProps({
  /** 画面中央に出す文言（例: 記録中… / 投稿中…） */
  message: {
    type: String,
    required: true
  }
});
</script>

<template>
  <!-- role="status" で、処理中であることを支援技術に読み上げさせる -->
  <div
    class="processing-overlay"
    role="status"
  >
    <p class="processing-text">
      {{ message }}
    </p>
  </div>
</template>

<style scoped>
/*
 * 羊皮紙色の半透明の膜で、地図と操作部をすべて覆う。
 *
 * 重なり順は次の間に置く。
 * - 口コミ投稿フォーム（z-index 150）より手前: 投稿中にフォームを覆うため
 * - トースト（z-index 200）より奥: 待っている間に出したエラーを読めるようにするため
 */
.processing-overlay {
  touch-action: manipulation; /* 理由は global.css の共通ルールのコメント */
  position: fixed;
  inset: 0;
  z-index: 180;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 下の画面をうっすら残しつつ、操作は受け付けない */
  background: rgba(241, 227, 200, 0.85);
}

.processing-text {
  font-family: var(--font-display);
  font-size: calc(18px + var(--fit) * 4);
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--primary-color);
  text-shadow: var(--text-halo);
}
</style>
