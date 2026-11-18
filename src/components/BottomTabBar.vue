<script setup lang="ts">
import { BookMarked, BookX, Home, UserRound } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { useNotificationsStore } from '@/stores/notifications'

const notifications = useNotificationsStore()
const items: Array<{ label: string; to: string; icon: typeof Home }> = [
  { label: '首页', to: '/', icon: Home },
  { label: '收藏', to: '/favorites', icon: BookMarked },
  { label: '错题', to: '/mistakes', icon: BookX },
  { label: '我的', to: '/me', icon: UserRound },
]
</script>

<template>
  <nav class="grid grid-flow-col auto-cols-fr gap-1" aria-label="主导航">
    <RouterLink
      v-for="item in items"
      :key="item.label"
      v-slot="{ href, navigate, isActive }"
      :to="item.to"
      custom
    >
      <a
        :href="href"
        :aria-current="isActive ? 'page' : undefined"
        class="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] transition-colors"
        :class="
          isActive
            ? 'font-semibold text-primary'
            : 'text-base-content/60 active:bg-base-200/80 hover:text-base-content'
        "
        @click="navigate"
      >
        <span
          class="relative flex h-6.5 min-w-11 items-center justify-center rounded-full transition-colors"
          :class="isActive ? 'bg-primary/12 text-primary' : 'text-base-content/75'"
        >
          <component :is="item.icon" :size="19" :stroke-width="isActive ? 2.2 : 1.9" />
          <span
            v-if="item.to === '/me' && notifications.unreadCount > 0"
            class="absolute right-2 top-0.5 size-2 rounded-full bg-error"
            aria-hidden="true"
          ></span>
        </span>
        <span>{{ item.label }}</span>
      </a>
    </RouterLink>
  </nav>
</template>
