<script setup>
import { onBeforeUnmount, onMounted, watch } from 'vue';
import { useWalkResultSave } from '@/composables/useWalkResultSave';
import { useAuthStore } from '@/stores/authStore';

/**
 * @description アプリケーションのルートコンポーネント。
 * 表示中の画面の切り替えはVue Routerに委ねる。
 *
 * 保存できずに退避した実績の再送もここで起こす。画面に依存しない処理のため
 * 特定の View には置けず、main.js では Pinia のストアをまだ安全に読めない
 * （`createApp(App).use(createPinia())` の前にストアを触ることになる）。
 * `setup` はストアを使える最上位の場所であるため、ここに置く。
 *
 * 再送の成否はトーストで知らせない。利用者が見ていない場面で静かに動く処理で、
 * 成功しても失敗しても操作は変わらないため、割り込む理由がない。
 */
const authStore = useAuthStore();
const { flushPendingWalkResults } = useWalkResultSave();

// 保存APIは認可が必要なため、ログイン済みになった時点で送り直す。
// `immediate: true` が要るのは、ルーターガードが restoreSession() を待ってから
// isSignedIn を立てるため。onMounted の1回きりでは、再読み込み直後にまだ false で
// 取りこぼす。この書き方なら「すでにログイン済み」と「これからログインする」の
// 両方を1つの記述で拾える
watch(
  () => authStore.isSignedIn,
  (isSignedIn) => {
    if (isSignedIn) {
      flushPendingWalkResults();
    }
  },
  { immediate: true }
);

/**
 * @description 通信が回復したときに、退避している実績を送り直す
 * @returns {void}
 */
const handleOnline = () => {
  flushPendingWalkResults();
};

// 退避の原因は「通信できなかったこと」なので、復帰の合図も引き金に加える。
// 解除時に同じ参照を渡す必要があるため、ハンドラは名前付き関数で持つ
onMounted(() => {
  window.addEventListener('online', handleOnline);
});

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline);
});
</script>

<template>
  <div id="app">
    <RouterView />
  </div>
</template>
