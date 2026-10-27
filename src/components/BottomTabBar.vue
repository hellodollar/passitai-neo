<script setup lang="ts">
import { BookMarked, Home, UserRound, XCircle } from '@lucide/vue'
import { RouterLink } from 'vue-router'

const items = [
  { label: '首页', to: '/', icon: Home },
  { label: '收藏', to: '/favorites', icon: BookMarked },
  { label: '错题', to: '/mistakes', icon: XCircle },
  { label: '我的', to: '/me', icon: UserRound },
]
</script>

<template>
  <nav class="grid grid-flow-col auto-cols-fr gap-1">
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
          class="flex h-7 min-w-12 items-center justify-center rounded-full"
          :class="isActive ? 'bg-primary/15 text-primary' : 'text-base-content'"
        >
          <component :is="item.icon" :size="21" :stroke-width="2.2" />
        </span>
        <span>{{ item.label }}</span>
      </a>
    </RouterLink>
  </nav>
</template>
