<script setup lang="ts">
import { CircleAlert, CircleCheck } from '@lucide/vue'

import { dismissToast, useToasts } from '@/utils/toast'

const toasts = useToasts()
</script>

<template>
  <div v-if="toasts.length" class="toast toast-top toast-center z-[1000]">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      role="alert"
      class="flex max-w-[calc(100vw-2rem)] cursor-pointer items-center gap-2 rounded-full bg-neutral/92 py-2 pl-3.5 pr-4 text-xs font-medium text-neutral-content shadow-sm shadow-black/10 ring-1 ring-white/10 backdrop-blur-md"
      @click="dismissToast(toast.id)"
    >
      <CircleCheck v-if="toast.type === 'success'" :size="16" class="shrink-0 text-success" />
      <CircleAlert v-else :size="16" class="shrink-0 text-error" />
      <span class="leading-snug">{{ toast.message }}</span>
    </div>
  </div>
</template>
