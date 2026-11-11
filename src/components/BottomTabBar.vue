<script setup lang="ts">
import { BookMarked, Home, UserRound, XCircle } from '@lucide/vue'
import { RouterLink } from 'vue-router'

const items: Array<{ label: string; to: string; icon: typeof Home; dot?: boolean }> = [
  { label: '首页', to: '/', icon: Home },
  { label: '收藏', to: '/favorites', icon: BookMarked },
  { label: '错题', to: '/mistakes', icon: XCircle },
  // 占位:dot 由未读数驱动,接口落地后随未读数显示
  { label: '我的', to: '/me', icon: UserRound, dot: true },
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
        class="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px]"
        :class="
          isActive
            ? 'font-semibold text-base-content'
            : 'text-base-content/65 hover:bg-base-200/80 hover:text-base-content'
        "
        @click="navigate"
      >
        <span
          class="relative flex h-7 min-w-12 items-center justify-center rounded-full"
          :class="isActive ? 'bg-primary/15 text-primary' : 'text-base-content'"
        >
          <component :is="item.icon" :size="21" :stroke-width="2.2" />
          <span
            v-if="item.dot"
            class="absolute right-2.5 top-0 size-2 rounded-full bg-error"
            aria-hidden="true"
          ></span>
        </span>
        <span>{{ item.label }}</span>
      </a>
    </RouterLink>
  </nav>
</template>
