<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    icon: Component
    title: string
    description?: string
    actionLabel?: string
    secondaryActionLabel?: string
    tone?: 'primary' | 'success' | 'warning' | 'error'
    /** 卡片内嵌或无底色场景：去掉背景色，压缩留白 */
    embedded?: boolean
  }>(),
  {
    actionLabel: '',
    secondaryActionLabel: '',
    description: '',
    tone: 'primary',
    embedded: false,
  },
)

const emit = defineEmits<{
  action: []
  'secondary-action': []
}>()

const toneClasses = computed(() => {
  const map = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
  }

  return map[props.tone]
})
</script>

<template>
  <section
    class="w-full min-w-full rounded-2xl px-5 text-center"
    :class="embedded ? 'py-8' : 'bg-base-100 py-9 dark:bg-base-200'"
  >
    <span class="mx-auto flex size-12 items-center justify-center rounded-2xl" :class="toneClasses">
      <component :is="icon" :size="24" />
    </span>
    <h2 class="mt-4 text-base font-semibold leading-snug tracking-tight text-base-content">
      {{ title }}
    </h2>
    <p
      v-if="description"
      class="mx-auto mt-1.5 max-w-xs text-xs leading-relaxed text-base-content/55"
    >
      {{ description }}
    </p>
    <div
      v-if="actionLabel && secondaryActionLabel"
      class="mx-auto mt-6 grid w-full max-w-[14.5rem] grid-cols-2 gap-2.5"
    >
      <button
        class="flex h-10 w-full items-center justify-center rounded-xl bg-base-200/70 text-sm font-medium text-base-content/75 transition-colors active:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-base-300/45 dark:active:bg-base-300/70"
        type="button"
        @click="emit('secondary-action')"
      >
        {{ secondaryActionLabel }}
      </button>
      <button
        class="flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-medium text-primary-content transition-colors active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        type="button"
        @click="emit('action')"
      >
        {{ actionLabel }}
      </button>
    </div>
    <div v-else-if="actionLabel || secondaryActionLabel" class="mt-6 flex justify-center">
      <button
        v-if="actionLabel"
        class="inline-flex h-10 min-w-[7.5rem] items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-primary-content transition-colors active:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        type="button"
        @click="emit('action')"
      >
        {{ actionLabel }}
      </button>
      <button
        v-else
        class="inline-flex h-10 min-w-[7.5rem] items-center justify-center rounded-xl bg-base-200/70 px-6 text-sm font-medium text-base-content/75 transition-colors active:bg-base-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-base-300/45 dark:active:bg-base-300/70"
        type="button"
        @click="emit('secondary-action')"
      >
        {{ secondaryActionLabel }}
      </button>
    </div>
  </section>
</template>
