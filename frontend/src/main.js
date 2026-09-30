import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { Amplify } from 'aws-amplify';
import App from '@/App.vue';
import router from '@/router';
import { AUTH_CONFIG, HAS_CONFIGURED_AUTH } from '@/constants/authConfig';
import '@/assets/styles/global.css';

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
