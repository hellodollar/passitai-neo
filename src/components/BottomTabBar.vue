<script setup lang="ts">
import type { Component } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

defineProps<{
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
  <nav class="grid grid-flow-col auto-cols-fr gap-1">
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px]"
      :class="isItemActive(item.to) ? 'font-semibold text-base-content' : 'text-base-content/60 hover:bg-base-200/80 hover:text-base-content'"
    >
      <span
        class="flex h-7 min-w-12 items-center justify-center rounded-full"
        :class="isItemActive(item.to) ? 'bg-primary/15 text-primary' : 'text-base-content'"
      >
        <component :is="item.icon" :size="21" :stroke-width="2.2" />
      </span>
      <span>{{ item.label }}</span>
    </RouterLink>
  </nav>
</template>
