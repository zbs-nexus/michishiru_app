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
 * ロック中は、まとまりとして半透明を効かせるため display: contents を解除して
 * ブロックに戻す。ハイライト中は見た目を変えないので素通し（display: contents）のままにし、
 * 中のボタンの固定配置（position: fixed）やレイアウトに一切干渉しない。
 */
.tutorial-spotlight.is-locked {
  display: block;
}

/*
 * ロック対象。半透明にして触れないようにする（ホーム画面のジャンル選択と同じ見た目）。
 * pointer-events: none で、中のボタンやスライダーの操作をすべて止める。
 * 画面全体へ暗い膜はかけない。押せない要素だけを淡くする。
 */
.tutorial-spotlight.is-locked {
  opacity: 0.4;
  pointer-events: none;
  filter: grayscale(0.5);
}

/*
 * ハイライト対象。中身はそのまま通常表示にし、暗転も枠も足さない。
 * 周りのロック対象が淡くなることで相対的に際立つため、ここでは見た目を変えない。
 * 以前は position: relative と全画面オーバーレイで浮かせていたが、
 * 画面下部に固定したボタン（.primary-btn.full-width）の位置が崩れ、
 * 暗い膜が地図や結果画面にかぶるため取りやめた。
 */
</style>
