<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description?: string
}>()
</script>

<template>
  <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
    <div class="min-w-0">
      <p v-if="eyebrow" class="text-xs font-medium text-base-content/45">{{ eyebrow }}</p>
      <h1 class="mt-1 truncate text-lg font-semibold sm:text-xl">{{ title }}</h1>
      <p v-if="description" class="mt-1.5 max-w-2xl text-sm leading-relaxed text-base-content/55">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 flex-wrap items-center gap-2">
      <slot name="actions"></slot>
    </div>
  </div>
</template>
