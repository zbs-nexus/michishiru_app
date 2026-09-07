import { createRouter, createWebHistory } from 'vue-router';
import RouteConditionView from '@/views/RouteConditionView.vue';
import RouteDetailView from '@/views/RouteDetailView.vue';
import RouteGenerationSpikeView from '@/views/RouteGenerationSpikeView.vue';
import RouteNavigationView from '@/views/RouteNavigationView.vue';
import RouteSuggestionView from '@/views/RouteSuggestionView.vue';
import WalkResultView from '@/views/WalkResultView.vue';
import { useRouteStore } from '@/stores/routeStore';

/**
 * @description URLと画面の対応を定義する。
 * ローディングと終了確認はURLを持たない表示状態のため、Viewには含めない。
 */
const routes = [
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
    path: '/detail',
    name: 'route-detail',
    component: RouteDetailView,
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
    // ルート生成方式の検証用。方式確定後は既存フローへ統合してこの定義を削除する
    path: '/spike/route-generation',
    name: 'route-generation-spike',
    component: RouteGenerationSpikeView
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: { name: 'route-condition' }
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
});

// ルート未取得の状態で直接URLを開いた場合は条件入力へ戻す
router.beforeEach((to) => {
  if (!to.meta.requiresRoute) {
    return true;
  }

  const routeStore = useRouteStore();

  return routeStore.hasRoute ? true : { name: 'route-condition' };
});

export default router;
