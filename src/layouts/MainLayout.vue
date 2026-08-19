<script setup lang="ts">
import {
  BookMarked,
  Home,
  Target,
  UserRound,
  XCircle,
} from '@lucide/vue'
import { RouterView } from 'vue-router'

import NavRail from '@/components/NavRail.vue'
import { useAppStore } from '@/stores/app'

const app = useAppStore()

const navItems = [
  { label: '首页', to: '/', icon: Home },
  { label: '练习', to: '/practice', icon: Target },
  { label: '收藏', to: '/favorites', icon: BookMarked },
  { label: '错题', to: '/wrong-book', icon: XCircle },
  { label: '我的', to: '/me', icon: UserRound },
]
</script>

<template>
  <div class="min-h-screen overflow-x-hidden bg-base-100 text-base-content">
    <div
      class="mx-auto min-h-screen w-full max-w-[32rem] overflow-x-hidden bg-base-100 [--app-header-height:0rem] md:border-x md:border-base-300"
    >
      <main
        class="overflow-x-hidden px-5"
        :class="app.practiceSessionActive ? 'pb-0 pt-0' : 'pb-24 pt-5'"
      >
        <RouterView />
      </main>

      <NavRail
        v-if="!app.practiceSessionActive"
        class="fixed bottom-0 left-1/2 z-30 w-full max-w-[32rem] -translate-x-1/2 border-t border-base-200 bg-base-100/95 px-3 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur"
        direction="tabs"
        :items="navItems"
      />
    </div>
  </div>
</template>
