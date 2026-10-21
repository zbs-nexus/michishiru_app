<script setup>
import { computed } from 'vue';
import MascotAvatar from '@/components/feature/mascot/MascotAvatar.vue';
import { DEFAULT_MASCOT_LEVEL } from '@/constants/mascotLevels';

/**
 * @description マスコットが画面のコメントを話しているように見せる吹き出し。
 * 1画面に1体だけ置く。短い一文は message で渡し、
 * 見出しや複数行を含める場合は既定のスロットへ入れる。
 */
const props = defineProps({
  /** 話す文言。スロットを使う場合は省略できる */
  message: {
    type: String,
    default: ''
  },
  /** マスコットのレベル */
  level: {
    type: Number,
    default: DEFAULT_MASCOT_LEVEL
  },
  /** マスコットの表示サイズ */
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  },
  /** マスコットと吹き出しの並べ方。side は横並び、stacked は吹き出しを上に置く */
  placement: {
    type: String,
    default: 'side',
    validator: (value) => ['side', 'stacked'].includes(value)
  },
  /** 吹き出しの種類。alert は注意として見せ、読み上げを割り込ませる */
  variant: {
    type: String,
    default: 'normal',
    validator: (value) => ['normal', 'alert'].includes(value)
  },
  /** `Lv.1 ミチのタマゴ` の表示を添えるかどうか */
  hasLevelLabel: {
    type: Boolean,
    default: false
  }
});

/** 注意として見せるかどうか */
const isAlert = computed(() => props.variant === 'alert');
</script>

<template>
  <div
    class="mascot-speech"
    :class="[`is-${placement}`, { 'is-alert': isAlert }]"
  >
    <MascotAvatar
      :level="level"
      :size="size"
      :has-level-label="hasLevelLabel"
    />

    <!-- 文言が入れ替わるため読み上げの対象にする。注意のときだけ割り込ませる -->
    <div
      class="speech-bubble"
      :role="isAlert ? 'alert' : 'status'"
      :aria-live="isAlert ? 'assertive' : 'polite'"
    >
      <slot>{{ message }}</slot>
    </div>
  </div>
</template>

<style scoped>
.mascot-speech {
  display: flex;
}

/* 横並び。マスコットを左、吹き出しを右に置く */
.mascot-speech.is-side {
  align-items: flex-start;
  gap: 14px;
}

/*
 * 縦並び。DOM上はマスコットが先だが、吹き出しを上に見せたいので
 * column-reverse で並び替える（読み上げの順序は変えない）。
 */
.mascot-speech.is-stacked {
  flex-direction: column-reverse;
  align-items: center;
  gap: 18px;
}

/*
 * 吹き出し。羊皮紙の色に金の縁取りで、巻物に書かれた言葉のように見せる。
 * 三角のしっぽは縁取りの色と内側の色を2枚重ねて描く。
 */
.speech-bubble {
  position: relative;
  padding: 14px 16px;
  border: 2px solid var(--border-gold);
  border-radius: 18px;
  background: var(--surface);
  box-shadow: var(--shadow);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.7;
  color: var(--text-dark);
}

.mascot-speech.is-side .speech-bubble {
  flex: 1;
  min-width: 0;
}

.mascot-speech.is-stacked .speech-bubble {
  max-width: 100%;
  text-align: center;
}

.speech-bubble::before,
.speech-bubble::after {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
}

/* 横並びのしっぽ。左のマスコットを指す */
.mascot-speech.is-side .speech-bubble::before {
  top: 20px;
  left: -12px;
  border-width: 11px 12px 11px 0;
  border-color: transparent var(--border-gold) transparent transparent;
}

.mascot-speech.is-side .speech-bubble::after {
  top: 22px;
  left: -8px;
  border-width: 9px 9px 9px 0;
  border-color: transparent var(--surface) transparent transparent;
}

/* 縦並びのしっぽ。下のマスコットを指す */
.mascot-speech.is-stacked .speech-bubble::before {
  bottom: -12px;
  left: 50%;
  margin-left: -11px;
  border-width: 12px 11px 0;
  border-color: var(--border-gold) transparent transparent;
}

.mascot-speech.is-stacked .speech-bubble::after {
  bottom: -8px;
  left: 50%;
  margin-left: -9px;
  border-width: 9px 9px 0;
  border-color: var(--surface) transparent transparent;
}

/* 注意。縁取りを赤へ変え、文字色も合わせて見分けられるようにする */
.mascot-speech.is-alert .speech-bubble {
  border-color: var(--danger);
  background: var(--surface-alert);
  color: var(--danger);
}

.mascot-speech.is-alert.is-side .speech-bubble::before {
  border-right-color: var(--danger);
}

.mascot-speech.is-alert.is-side .speech-bubble::after {
  border-right-color: var(--surface-alert);
}

.mascot-speech.is-alert.is-stacked .speech-bubble::before {
  border-top-color: var(--danger);
}

.mascot-speech.is-alert.is-stacked .speech-bubble::after {
  border-top-color: var(--surface-alert);
}
</style>
