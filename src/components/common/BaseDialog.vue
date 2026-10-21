<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick, ref, watch } from 'vue'

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

function handleTab(event: KeyboardEvent) {
  const buttons = dialogRef.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
  const first = buttons?.[0]
  const last = buttons?.[buttons.length - 1]
  if (!first || !last) {
    event.preventDefault()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === dialogRef.value)
  ) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(model, async (open) => {
  if (!open) {
    await nextTick()
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
    return
  }
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  dialogRef.value?.focus({ preventScroll: true })
})
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
      @keydown.tab="handleTab"
    >
      <div
        class="modal-box w-full max-w-sm overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-0 shadow-none"
      >
        <div class="flex items-center justify-between gap-4 px-5 pb-2 pt-5">
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

        <div class="px-5 pb-5 pt-2">
          <slot></slot>
        </div>

        <div v-if="$slots.footer" class="flex gap-2 border-t border-base-200 px-4 py-3">
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
