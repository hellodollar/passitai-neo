import { createRouter, createWebHistory } from 'vue-router'

import { ROUTE_NAMES } from '@/constants/app'
import { useAuthStore } from '@/stores/auth'
import { isBrowseRoute } from '@/utils/browse-state'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (isBrowseRoute(to.name) || to.path === from.path) return false
    return savedPosition ?? { left: 0, top: 0 }
  },
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
          name: ROUTE_NAMES.practiceHome,
          component: () => import('@/views/PracticeHomeView.vue'),
        },
        {
          path: 'practice',
          redirect: (to) => ({
            name: ROUTE_NAMES.practiceHome,
            query: to.query,
            hash: to.hash,
          }),
        },
        {
          path: 'practice/papers/:paperId',
          name: ROUTE_NAMES.practicePaper,
          component: () => import('@/views/PracticePaperView.vue'),
        },
        {
          path: 'practice/papers/:paperId/result',
          name: ROUTE_NAMES.practicePaperResult,
          component: () => import('@/views/PracticeResultView.vue'),
        },
        {
          path: 'favorites',
          name: ROUTE_NAMES.favorites,
          component: () => import('@/views/CollectionOverviewView.vue'),
          props: { source: 'favorites' },
        },
        {
          path: 'wrong-book',
          name: ROUTE_NAMES.wrongQuestions,
          component: () => import('@/views/CollectionOverviewView.vue'),
          props: { source: 'wrong-questions' },
        },
        {
          path: 'me',
          name: ROUTE_NAMES.me,
          component: () => import('@/views/MeView.vue'),
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
    return { name: ROUTE_NAMES.practiceHome }
  }
})

export default router
