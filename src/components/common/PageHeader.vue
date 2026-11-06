<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

defineProps<{ title: string; backLabel: string }>()
defineEmits<{ back: [] }>()
</script>

<template>
  <header
    class="fixed left-1/2 top-0 z-40 w-full max-w-[32rem] -translate-x-1/2 border-b border-base-200/80 bg-base-100/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl"
  >
    <div class="grid h-14 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3">
      <button
        class="btn btn-circle btn-ghost size-10 min-h-10 p-0"
        type="button"
        :aria-label="backLabel"
        @click="$emit('back')"
      >
        <ArrowLeft :size="21" aria-hidden="true" />
      </button>
      <h1 class="truncate text-center text-[15px] font-semibold leading-tight">{{ title }}</h1>
      <span aria-hidden="true"></span>
    </div>
    <slot />
  </header>
</template>
