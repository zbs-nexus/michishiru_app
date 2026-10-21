<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';

/**
 * @description ヘッダー右上のハンバーガーメニュー。
 * 開閉の状態だけを自分で持ち、ログアウトの処理は親へ委ねる。
 *
 * 表示上の文言は「ログアウト」、コード上の名前は signOut に統一している
 * （Cognito と認証ライブラリのAPI名が signOut のため）。
 */
const emit = defineEmits(['signOut']);

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
  padding: 10px;
  border: 1px solid var(--border-gold);
  border-radius: 10px;
  background: var(--surface);
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
  border: 1px solid var(--border-gold);
  border-radius: 10px;
  background: var(--surface);
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
