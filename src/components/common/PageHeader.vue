<script setup lang="ts">
import { ArrowLeft } from '@lucide/vue'

defineProps<{ title: string; backLabel: string }>()
defineEmits<{ back: [] }>()
</script>

<template>
  <header
    class="fixed left-1/2 top-0 z-40 w-full max-w-[32rem] -translate-x-1/2 border-b border-base-content/[0.06] bg-base-100/92 pt-[env(safe-area-inset-top)] backdrop-blur-xl dark:border-base-content/[0.08]"
  >
    <div
      class="grid h-12 items-center gap-2 px-2.5"
      :class="
        $slots.right
          ? 'grid-cols-[5rem_minmax(0,1fr)_5rem]'
          : 'grid-cols-[2.75rem_minmax(0,1fr)_2.75rem]'
      "
    >
      <button
        class="btn btn-circle btn-ghost size-11 min-h-11 p-0"
        type="button"
        :aria-label="backLabel"
        @click="$emit('back')"
      >
        <ArrowLeft :size="18" aria-hidden="true" />
      </button>
      <h1
        class="truncate text-center text-base font-semibold leading-snug tracking-tight text-base-content"
      >
        {{ title }}
      </h1>
      <div v-if="$slots.right" class="flex justify-end">
        <slot name="right" />
      </div>
      <span v-else aria-hidden="true"></span>
    </div>
    <slot />
  </header>
</template>
