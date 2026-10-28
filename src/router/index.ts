import { createRouter, type RouterHistory } from 'vue-router'

import { AUTH_INVALIDATED_EVENT } from '@/constants/app'
import { useAuthStore } from '@/stores/auth'
import { showErrorToast } from '@/utils/toast'

export function createAppRouter(history: RouterHistory) {
  const router = createRouter({
    history,
    scrollBehavior(to, from, savedPosition) {
      if (['home', 'favorites', 'mistakes'].includes(String(to.name)) || to.path === from.path)
        return false
      return savedPosition ?? { left: 0, top: 0 }
    },
    routes: [
      {
        path: '/',
        name: 'home',
        component: () => import('@/views/home/HomeView.vue'),
      },
      {
        path: '/practice/:paperId',
        name: 'practice',
        component: () => import('@/views/practice/PracticeView.vue'),
        props: (route) => ({ source: 'practice', paperId: route.params.paperId }),
      },
      {
        path: '/practice/:paperId/result/:submissionId',
        name: 'practice-result',
        component: () => import('@/views/practice/PracticeResultView.vue'),
        props: true,
      },
      {
        path: '/favorites',
        name: 'favorites',
        component: () => import('@/views/favorites/FavoritesView.vue'),
      },
      {
        path: '/favorites/practice/:groupBy(subject|paper)/:groupId',
        name: 'favorites-practice',
        component: () => import('@/views/practice/PracticeView.vue'),
        props: (route) => ({
          source: 'favorites',
          groupBy: route.params.groupBy,
          groupId: route.params.groupId,
        }),
      },
      {
        path: '/mistakes',
        name: 'mistakes',
        component: () => import('@/views/mistakes/MistakesView.vue'),
      },
      {
        path: '/mistakes/practice/:groupBy(subject|paper)/:groupId',
        name: 'mistakes-practice',
        component: () => import('@/views/practice/PracticeView.vue'),
        props: (route) => ({
          source: 'mistakes',
          groupBy: route.params.groupBy,
          groupId: route.params.groupId,
        }),
      },
      {
        path: '/me',
        name: 'me',
        component: () => import('@/views/me/MeView.vue'),
      },
      {
        path: '/login',
        name: 'login',
        component: () => import('@/views/auth/LoginView.vue'),
      },
      {
        path: '/register',
        name: 'register',
        component: () => import('@/views/auth/RegisterView.vue'),
      },
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
      },
    ],
  })

  // 登录、注册和未找到页公开，其余页面均需登录。
  router.beforeEach((to) => {
    const auth = useAuthStore()
    const isAuthPage = to.name === 'login' || to.name === 'register'
    if (!isAuthPage && to.name !== 'not-found' && !auth.isAuthenticated) {
      return { name: 'login', query: { redirect: to.fullPath } }
    }
    if (isAuthPage && auth.isAuthenticated) return { name: 'home' }
  })

  window.addEventListener(AUTH_INVALIDATED_EVENT, () => {
    // 先清会话，登录页守卫才能放行。
    useAuthStore().clearSession()
    const current = router.currentRoute.value
    if (!current.name || ['login', 'register', 'not-found'].includes(String(current.name))) return
    showErrorToast('登录状态已失效，请重新登录')
    void router.replace({ name: 'login', query: { redirect: current.fullPath } })
  })

  return router
}
