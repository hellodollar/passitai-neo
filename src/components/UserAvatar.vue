<script setup lang="ts">
import { computed } from 'vue'
import { UserRound } from '@lucide/vue'

const props = defineProps<{
  email: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}>()

const sizeStyle = computed(() => {
  switch (props.size) {
    case 'sm':
      return { box: 'size-8', icon: 18 }
    case 'lg':
      return { box: 'size-12', icon: 26 }
    case 'xl':
      return { box: 'size-20', icon: 46 }
    default:
      return { box: 'size-9', icon: 20 }
  }
})
</script>

<template>
  <span
    class="flex shrink-0 items-center justify-center rounded-full bg-base-200 text-base-content/35"
    :class="sizeStyle.box"
    :aria-label="email"
  >
    <UserRound :size="sizeStyle.icon" stroke-width="1.7" />
  </span>
</template>
