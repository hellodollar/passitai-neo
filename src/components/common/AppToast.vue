<script setup lang="ts">
import { CircleAlert, CircleCheck } from '@lucide/vue'
import { nextTick, ref, watch } from 'vue'

import { dismissToast, useToasts } from '@/utils/toast'

const toasts = useToasts()
const popoverRef = ref<HTMLElement | null>(null)

/**
 * 原生 popover="manual" 进入浏览器 Top Layer，确保提示始终浮在
 * <dialog>.showModal() 弹窗遮罩之上，且不抢焦点、不阻断底层交互。
 */
watch(
  () => toasts.value.map((toast) => toast.id).join(','),
  async (ids) => {
    await nextTick()
    const el = popoverRef.value
    if (!el) return
    try {
      if (ids) {
        if (el.matches(':popover-open')) el.hidePopover()
        el.showPopover()
      } else if (el.matches(':popover-open')) {
        el.hidePopover()
      }
    } catch {
      // 不支持 Popover API 的旧浏览器回退到普通 fixed + z-[1000] 展示。
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    ref="popoverRef"
    v-show="toasts.length > 0"
    popover="manual"
    class="pointer-events-none fixed inset-x-0 top-0 z-[1000] m-0 flex w-full flex-col items-center gap-2 border-0 bg-transparent px-4 pt-[calc(0.875rem+env(safe-area-inset-top))]"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      role="alert"
      class="pointer-events-auto flex max-w-[calc(100vw-2rem)] cursor-pointer items-center gap-2 rounded-full bg-neutral/92 py-2 pl-3.5 pr-4 text-xs font-medium text-neutral-content shadow-sm shadow-black/10 ring-1 ring-white/10 backdrop-blur-md"
      @click="dismissToast(toast.id)"
    >
      <CircleCheck v-if="toast.type === 'success'" :size="16" class="shrink-0 text-success" />
      <CircleAlert v-else :size="16" class="shrink-0 text-error" />
      <span class="leading-snug">{{ toast.message }}</span>
    </div>
  </div>
</template>
