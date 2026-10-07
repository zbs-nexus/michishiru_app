import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Amplify } from 'aws-amplify';
import App from '@/App.vue';
import router from '@/router';
import { AUTH_CONFIG, HAS_CONFIGURED_AUTH } from '@/constants/authConfig';
import '@/assets/styles/global.css';

/*
 * 見出し用の書体（解星特ミン）。外部CDNへ取りに行かせないため自前で配信する。
 * 使っているのは太字だけなので、ウェイトは700のみ読み込む。
 *
 * 日本語は文字数が多く、文字の範囲ごとに分割された @font-face の定義だけで
 * 90KB（gzip後）を超える。最初の描画を待たせないよう、動的importで
 * 本体のCSSから切り離して後から読み込む。
 * 読み込めるまでの間は --font-display の次の候補（端末の明朝）で表示される
 * （font-display: swap）。
 */
import('@fontsource/kaisei-tokumin/700.css');

// 認証の設定は最初の画面を描く前に渡す必要がある。
// 未設定のまま進むとログイン時に分かりにくい例外になるため、ここで気付けるようにする
if (HAS_CONFIGURED_AUTH) {
  Amplify.configure({ Auth: AUTH_CONFIG });
} else {
  console.error(
    'Cognito の接続情報が未設定です。frontend/.env.local を作成し、dev サーバーを再起動してください'
  );
}

createApp(App).use(createPinia()).use(router).mount('#app');
