<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

defineProps<{
  compact?: boolean
  direction?: 'rail' | 'tabs'
  items: Array<{
    label: string
    to: string
    icon: Component
  }>
}>()

const route = useRoute()

function isItemActive(to: string) {
  if (to === '/') {
    return route.path === '/'
  }

  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav :class="direction === 'tabs' ? 'grid grid-cols-5 gap-1' : 'grid gap-1.5'">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      :class="[
        direction === 'tabs'
          ? 'flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px]'
          : compact
            ? 'tooltip tooltip-right flex h-11 items-center justify-center rounded-2xl'
            : 'flex h-11 items-center gap-3 rounded-2xl px-3 text-sm',
        isItemActive(item.to)
          ? direction === 'tabs'
            ? 'font-semibold text-base-content'
            : 'bg-primary/10 font-semibold text-primary'
          : 'text-base-content/60 hover:bg-base-200/80 hover:text-base-content',
      ]"
      :data-tip="compact ? item.label : undefined"
    >
      <span
        v-if="direction === 'tabs'"
        class="flex h-7 min-w-12 items-center justify-center rounded-full"
        :class="isItemActive(item.to) ? 'bg-primary/15 text-primary' : 'text-base-content'"
      >
        <component :is="item.icon" :size="21" :stroke-width="2.2" />
      </span>
      <component v-else :is="item.icon" :size="20" />
      <span v-if="!compact || direction === 'tabs'">{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
