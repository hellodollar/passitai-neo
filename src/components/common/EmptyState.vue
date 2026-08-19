<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

const props = withDefaults(
  defineProps<{
    icon: Component
    title: string
    description?: string
    actionLabel?: string
    actionTo?: string
    tone?: 'primary' | 'success' | 'warning' | 'error'
  }>(),
  {
    actionLabel: '',
    actionTo: '',
    description: '',
    tone: 'primary',
  },
)

const emit = defineEmits<{
  action: []
}>()

const toneClasses = computed(() => {
  const map = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-error/10 text-error',
  }

  return map[props.tone]
})
</script>

<template>
  <section
    class="w-full min-w-full rounded-2xl border border-dashed border-base-300 bg-base-100 px-5 py-10 text-center"
  >
    <span
      class="mx-auto flex size-12 items-center justify-center rounded-full"
      :class="toneClasses"
    >
      <component :is="icon" :size="24" />
    </span>
    <h2 class="mt-4 text-base font-semibold leading-tight">{{ title }}</h2>
    <p
      v-if="description"
      class="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-base-content/55"
    >
      {{ description }}
    </p>
    <RouterLink v-if="actionLabel && actionTo" class="btn btn-primary btn-sm mt-5 rounded-full px-5" :to="actionTo">
      {{ actionLabel }}
    </RouterLink>
    <button
      v-else-if="actionLabel"
      class="btn btn-primary btn-sm mt-5 rounded-full px-5"
      type="button"
      @click="emit('action')"
    >
      {{ actionLabel }}
    </button>
  </section>
</template>
