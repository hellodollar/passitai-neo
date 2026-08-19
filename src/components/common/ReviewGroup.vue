<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'
import { ChevronDown, ChevronRight, Trash2 } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    title: string
    meta: string
    expanded: boolean
    icon: Component
    tone?: 'primary' | 'error'
  }>(),
  {
    tone: 'primary',
  },
)

const emit = defineEmits<{
  toggle: []
  remove: []
}>()

const toneClasses = computed(() =>
  props.tone === 'error' ? 'bg-error/10 text-error' : 'bg-primary/10 text-primary',
)
</script>

<template>
  <article class="overflow-hidden rounded-2xl border border-base-200 bg-base-100">
    <div class="flex items-center gap-2 p-3">
      <button
        class="flex min-w-0 flex-1 items-center gap-3 text-left"
        type="button"
        @click="emit('toggle')"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full"
          :class="toneClasses"
        >
          <component :is="icon" :size="20" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-base font-medium">{{ title }}</span>
          <span class="mt-1 block truncate text-sm text-base-content/50">{{ meta }}</span>
        </span>
        <component
          :is="expanded ? ChevronDown : ChevronRight"
          :size="18"
          class="shrink-0 text-base-content/35"
        />
      </button>

      <button
        class="btn btn-square btn-ghost btn-sm shrink-0 text-error"
        type="button"
        aria-label="Delete group"
        @click="emit('remove')"
      >
        <Trash2 :size="15" />
      </button>
    </div>

    <div v-if="expanded" class="border-t border-base-200 bg-base-200/40 p-3">
      <slot></slot>
    </div>
  </article>
</template>
