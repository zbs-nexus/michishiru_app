<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * @description ヘッダー右上のハンバーガーメニュー。
 * 開閉の状態だけを自分で持ち、各項目の処理は親へ委ねる。
 *
 * 「ログアウト」の表示上の文言とコード上の名前（signOut）が揃っていないのは、
 * Cognito と認証ライブラリのAPI名が signOut のため。
 * 「チュートリアル」は親でチュートリアルを開始するために startTutorial を通知する。
 * チュートリアル中は「チュートリアルを終了」を出し、endTutorial で終了を通知する。
 */
const props = defineProps({
  /**
   * チュートリアル中かどうか。
   * 真のとき、メニューの「チュートリアル」を「チュートリアルを終了」に差し替える。
   */
  isTutorialActive: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['signOut', 'startTutorial', 'endTutorial']);

/** メニューを開いているかどうか */
const isOpen = ref(false);

/** メニュー全体のDOM要素。外側が押されたかの判定に使う */
const menuContainer = ref(null);

/**
 * @description メニューの開閉を切り替える
 * @returns {void}
 */
const toggleMenu = () => {
  isOpen.value = !isOpen.value;
};

/**
 * @description メニューを閉じる
 * @returns {void}
 */
const closeMenu = () => {
  isOpen.value = false;
};

/**
 * @description ログアウトを親へ通知する。
 * 画面が切り替わる前にメニューを閉じ、戻ってきたときに開いたままにならないようにする。
 * @returns {void}
 */
const handleSignOut = () => {
  closeMenu();
  emit('signOut');
};

/**
 * @description チュートリアルの開始を親へ通知する。
 * ログアウトと同じく、通知の前にメニューを閉じる。
 * @returns {void}
 */
const handleStartTutorial = () => {
  closeMenu();
  emit('startTutorial');
};

/**
 * @description チュートリアルの終了を親へ通知する。
 * 終了してホーム画面へ戻す処理は親に委ねる。通知の前にメニューを閉じる。
 * @returns {void}
 */
const handleEndTutorial = () => {
  closeMenu();
  emit('endTutorial');
};

/**
 * @description メニューの外側が押されたら閉じる
 * @param {PointerEvent} event 押下のイベント
 * @returns {void}
 */
const handleOutsideClick = (event) => {
  if (menuContainer.value === null) {
    return;
  }

  // メニュー内（ハンバーガーボタンを含む）の押下では閉じない
  if (menuContainer.value.contains(event.target)) {
    return;
  }

  closeMenu();
};

/**
 * @description Escキーでメニューを閉じる
 * @param {KeyboardEvent} event キー入力のイベント
 * @returns {void}
 */
const handleKeydown = (event) => {
  if (event.key === 'Escape') {
    closeMenu();
  }
};

// 画面のどこを押しても閉じられるよう、監視はdocumentに対して行う
onMounted(() => {
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <div
    ref="menuContainer"
    class="signout-menu"
  >
    <button
      class="menu-btn"
      :class="{ 'is-open': isOpen }"
      type="button"
      aria-label="メニュー"
      aria-haspopup="true"
      :aria-expanded="isOpen"
      aria-controls="signout-menu-list"
      @click="toggleMenu"
    >
      <span
        class="menu-bar"
        aria-hidden="true"
      />
      <span
        class="menu-bar"
        aria-hidden="true"
      />
      <span
        class="menu-bar"
        aria-hidden="true"
      />
    </button>

    <ul
      v-show="isOpen"
      id="signout-menu-list"
      class="menu-list"
    >
      <li>
        <!--
          チュートリアル中は「チュートリアルを終了」を出し、押すとチュートリアルを
          終わらせてホーム画面へ戻す。チュートリアル外は「チュートリアル」で開始する。
        -->
        <button
          v-if="props.isTutorialActive"
          class="menu-item"
          type="button"
          @click="handleEndTutorial"
        >
          チュートリアルを終了
        </button>
        <button
          v-else
          class="menu-item"
          type="button"
          @click="handleStartTutorial"
        >
          チュートリアル
        </button>
      </li>
      <li>
        <button
          class="menu-item"
          type="button"
          @click="handleSignOut"
        >
          ログアウト
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.signout-menu {
  position: relative;
}

.menu-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  /*
   * 40px の中に枠（--pixel-frame-width × 2）が入るため、
   * 3本の線（2px × 3 + 隙間 5px × 2 = 16px）が収まる余白までしか取れない。
   * 枠を太くするときはこの値も見直すこと。
   */
  padding: 3px;
  border: var(--pixel-frame-width) solid var(--border-ink);
  border-image: var(--pixel-frame-ink);
  background: var(--surface);
  background-clip: padding-box;
  box-shadow: var(--shadow);
  cursor: pointer;
}

.menu-btn:hover,
.menu-btn.is-open {
  background: var(--bg-light);
}

.menu-bar {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 1px;
  background: var(--primary-color);
}

/* ヘッダーの高さを押し広げないよう、一覧はボタンに重ねて出す */
.menu-list {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 10;
  min-width: 160px;
  padding: 6px;
  list-style: none;
  border: var(--pixel-frame-width) solid var(--border-ink);
  border-image: var(--pixel-frame-ink);
  background: var(--surface);
  background-clip: padding-box;
  box-shadow: var(--shadow);
}

.menu-item {
  width: 100%;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-dark);
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}

.menu-item:hover {
  background: var(--bg-light);
}
</style>
