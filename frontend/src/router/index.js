import { createRouter, createWebHistory } from 'vue-router';
import LoginView from '@/views/LoginView.vue';
import PasswordResetView from '@/views/PasswordResetView.vue';
import RouteConditionView from '@/views/RouteConditionView.vue';
import RouteNavigationView from '@/views/RouteNavigationView.vue';
import RouteSuggestionView from '@/views/RouteSuggestionView.vue';
import SignUpView from '@/views/SignUpView.vue';
import WalkResultView from '@/views/WalkResultView.vue';
import { useAuthStore } from '@/stores/authStore';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description URLと画面の対応を定義する。
 * ローディングと終了確認はURLを持たない表示状態のため、Viewには含めない。
 */
const routes = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    // 未ログインで開ける画面（ほかにユーザー登録とパスワード再設定）
    meta: { isPublic: true }
  },
  {
    path: '/sign-up',
    name: 'sign-up',
    component: SignUpView,
    meta: { isPublic: true }
  },
  {
    path: '/password-reset',
    name: 'password-reset',
    component: PasswordResetView,
    meta: { isPublic: true }
  },
  {
    path: '/',
    name: 'route-condition',
    component: RouteConditionView
  },
  {
    path: '/suggestion',
    name: 'route-suggestion',
    component: RouteSuggestionView,
    meta: { requiresRoute: true }
  },
  {
    path: '/navigation',
    name: 'route-navigation',
    component: RouteNavigationView,
    meta: { requiresRoute: true }
  },
  {
    path: '/result',
    name: 'walk-result',
    component: WalkResultView,
    meta: { requiresRoute: true }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'route-condition' }
  }
];

/**
 * デザイン確認用の画面。開発サーバーでのみ登録する。
 * 本番ビルドでは import.meta.env.DEV が false になり、
 * この画面とDesignPreviewViewのコードは成果物に含まれない。
 */
if (import.meta.env.DEV) {
  routes.unshift({
    path: '/design-preview',
    name: 'design-preview',
    component: () => import('@/views/DesignPreviewView.vue'),
    meta: { isPreview: true }
  });
}

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

// ログイン状態とルート取得状態を、この順で見て遷移を決める
router.beforeEach(async (to) => {
  // デザイン確認用の画面は、ログイン状態を整えるために判定より先に通す。
  // 開発サーバー以外ではこのmetaを持つ画面が登録されないため、本番では効かない
  if (import.meta.env.DEV && to.meta.isPreview) {
    return true;
  }

  const authStore = useAuthStore();

  // 再読み込み直後はストアが空になるため、残っているセッションを一度だけ確認する
  if (!authStore.isSessionRestored) {
    await authStore.restoreSession();
  }

  if (to.meta.isPublic) {
    // ログイン済みならログイン画面には留まらせず、ホームへ送る
    return authStore.isSignedIn ? { name: 'route-condition' } : true;
  }

  if (!authStore.isSignedIn) {
    return { name: 'login' };
  }

  if (!to.meta.requiresRoute) {
    return true;
  }

  const routeStore = useRouteStore();

  // ルート未取得の状態で直接URLを開いた場合は条件入力へ戻す
  return routeStore.hasRoute ? true : { name: 'route-condition' };
});

export default router;
