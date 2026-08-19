<script setup lang="ts">
import { Brain } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { APP_NAME, APP_TAGLINE } from '@/constants/app'

const props = withDefaults(
  defineProps<{
    compact?: boolean
    variant?: 'default' | 'inverse'
  }>(),
  {
    compact: false,
    variant: 'default',
  },
)

const iconClass = computed(() =>
  props.variant === 'inverse'
    ? 'bg-primary-content/15 text-primary-content'
    : 'bg-primary text-primary-content',
)

const taglineClass = computed(() =>
  props.variant === 'inverse' ? 'text-primary-content/70' : 'text-base-content/55',
)
</script>

<template>
  <RouterLink to="/" class="flex items-center gap-3" :class="compact ? 'justify-center' : 'px-0'">
    <span
      class="flex shrink-0 items-center justify-center rounded-2xl"
      :class="[iconClass, compact ? 'size-9' : 'size-9']"
    >
      <Brain :size="20" />
    </span>
    <span v-if="!compact" class="min-w-0">
      <span class="block text-sm font-bold">{{ APP_NAME }}</span>
      <span class="truncate text-xs" :class="taglineClass">{{ APP_TAGLINE }}</span>
    </span>
  </RouterLink>
</template>
