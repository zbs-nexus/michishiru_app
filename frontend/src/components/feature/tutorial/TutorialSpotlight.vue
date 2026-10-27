<script setup>
/**
 * @description チュートリアル中に、特定の要素だけを操作可能にするためのラッパー。
 * 状態ベースのロックを担う。座標は測らず、CSSだけで見た目と操作の可否を切り替える。
 *
 * - is-active が偽（チュートリアル外、またはこの要素が今のステップの対象でない）とき、
 *   中身を暗くし、ポインター操作を受け付けなくする。
 * - is-highlighted が真（今のステップで操作させたい要素）のとき、明るいまま浮かせて、
 *   操作を受け付ける。
 *
 * 端末の画面サイズやレイアウトの変化に左右されない（位置を測らないため）。
 */
defineProps({
  /**
   * チュートリアルによるロックを効かせるかどうか。
   * 偽のときは通常表示（暗転も浮き上がりもしない）で、中身をそのまま見せる。
   */
  isActive: {
    type: Boolean,
    default: false
  },
  /**
   * この要素が今のステップのハイライト対象かどうか。
   * 真のとき明るく浮かせて操作可能にし、偽のとき暗くして操作不可にする。
   * isActive が偽のときはこの値によらず通常表示になる。
   */
  isHighlighted: {
    type: Boolean,
    default: false
  }
});
</script>

<template>
  <div
    class="tutorial-spotlight"
    :class="{
      'is-locked': isActive && !isHighlighted,
      'is-highlighted': isActive && isHighlighted
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
/*
 * 既定（チュートリアル外、または対象でない）は素通し。
 * 余計な余白やスタイルを足さず、中身のレイアウトを変えない。
 */
.tutorial-spotlight {
  display: contents;
}

/*
 * ロック中・ハイライト中は、まとまりとして暗転・浮き上がりを効かせるため
 * display: contents を解除してブロックに戻す。
 */
.tutorial-spotlight.is-locked,
.tutorial-spotlight.is-highlighted {
  display: block;
}

/*
 * ロック対象。半透明にして触れないようにする。
 * pointer-events: none で、中のボタンやスライダーの操作をすべて止める。
 */
.tutorial-spotlight.is-locked {
  opacity: 0.35;
  pointer-events: none;
  filter: grayscale(0.4);
}

/*
 * ハイライト対象。羊皮紙色の台紙に乗せて浮かせ、周りの暗い部分から際立たせる。
 * position と z-index で、同じ画面の暗転した要素より手前に出す。
 */
.tutorial-spotlight.is-highlighted {
  position: relative;
  z-index: 60;
  border-radius: 12px;
  box-shadow:
    0 0 0 4px var(--primary-light),
    0 0 0 9999px rgba(43, 28, 74, 0.45);
}
</style>
