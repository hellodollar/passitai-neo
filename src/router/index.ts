import { createRouter, createWebHistory } from 'vue-router'

import { ROUTE_NAMES } from '@/constants/app'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: ROUTE_NAMES.login,
      component: () => import('@/views/LoginView.vue'),
      meta: { publicOnly: true },
    },
    {
      path: '/register',
      name: ROUTE_NAMES.register,
      component: () => import('@/views/RegisterView.vue'),
      meta: { publicOnly: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/MainLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: ROUTE_NAMES.dashboard,
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'practice',
          name: ROUTE_NAMES.practice,
          component: () => import('@/views/PracticeView.vue'),
        },
        {
          path: 'practice/session/:paperId',
          name: ROUTE_NAMES.session,
          component: () => import('@/views/SessionView.vue'),
        },
        {
          path: 'favorites',
          name: ROUTE_NAMES.favorites,
          component: () => import('@/views/FavoritesView.vue'),
        },
        {
          path: 'wrong-book',
          name: ROUTE_NAMES.wrongQuestions,
          component: () => import('@/views/WrongQuestionsView.vue'),
        },
        {
          path: 'me',
          name: ROUTE_NAMES.settings,
          component: () => import('@/views/SettingsView.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      component: () => import('@/views/NotFoundView.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return {
      name: ROUTE_NAMES.login,
      query: { redirect: to.fullPath },
    }
  }

  if (to.meta.publicOnly && auth.isAuthenticated) {
    return { name: ROUTE_NAMES.dashboard }
  }
})

export default router
