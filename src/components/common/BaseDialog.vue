<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick, ref, watch } from 'vue'

import { restoreOverlayFocus, trapOverlayFocus } from './overlay'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    title: string
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
    showClose?: boolean
  }>(),
  {
    closeOnBackdrop: true,
    closeOnEscape: true,
    showClose: false,
  },
)

const dialogRef = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

function close() {
  model.value = false
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) close()
}

function handleEscape() {
  if (props.closeOnEscape) close()
}

watch(
  model,
  async (open, wasOpen) => {
    if (!open) {
      if (!wasOpen) return
      await nextTick()
      // 同一轮父状态可能已重新打开，等子组件接收新值后再恢复。
      await nextTick()
      if (model.value) return
      restoreOverlayFocus(previousFocus)
      previousFocus = null
      return
    }
    previousFocus ??= document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    if (model.value) dialogRef.value?.focus({ preventScroll: true })
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="model"
      ref="dialogRef"
      class="modal modal-open modal-middle px-5"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      tabindex="-1"
      @click.self="handleBackdropClick"
      @keydown.esc.stop.prevent="handleEscape"
      @keydown.tab="trapOverlayFocus($event, dialogRef)"
    >
      <div
        class="modal-box flex max-h-[calc(100dvh-2.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-0 shadow-none"
      >
        <div class="flex shrink-0 items-center justify-between gap-4 px-5 pb-2 pt-5">
          <h3 class="text-base font-semibold leading-tight">{{ title }}</h3>
          <button
            v-if="showClose"
            class="btn btn-square btn-ghost btn-sm"
            type="button"
            aria-label="关闭"
            @click="close"
          >
            <X :size="16" />
          </button>
        </div>

        <div class="min-h-0 overflow-y-auto px-5 pb-5 pt-2">
          <slot></slot>
        </div>

        <div v-if="$slots.footer" class="flex shrink-0 gap-2 border-t border-base-200 px-4 py-3">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
