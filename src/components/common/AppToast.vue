<script setup lang="ts">
import { CircleAlert } from '@lucide/vue'

import { dismissToast, useToasts } from '@/utils/toast'

const toasts = useToasts()
</script>

<template>
  <div v-if="toasts.length" class="toast toast-top toast-center z-50">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      role="alert"
      class="flex max-w-[calc(100vw-2rem)] cursor-pointer items-center gap-2 rounded-full bg-neutral/90 py-2.5 pr-5 pl-4 text-sm font-medium text-neutral-content shadow-lg backdrop-blur-sm"
      @click="dismissToast(toast.id)"
    >
      <CircleAlert :size="15" class="shrink-0 opacity-80" />
      <span class="leading-snug">{{ toast.message }}</span>
    </div>
  </div>
</template>
