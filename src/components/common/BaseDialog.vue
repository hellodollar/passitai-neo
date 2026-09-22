<script setup lang="ts">
import { X } from '@lucide/vue'
import { nextTick, ref, watch } from 'vue'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    title: string
    closeOnBackdrop?: boolean
    showClose?: boolean
  }>(),
  {
    closeOnBackdrop: true,
    showClose: false,
  },
)

const dialogRef = ref<HTMLElement | null>(null)

function close() {
  model.value = false
}

function handleBackdropClick() {
  if (props.closeOnBackdrop) close()
}

watch(model, async (open) => {
  if (!open) return
  await nextTick()
  dialogRef.value?.focus()
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
      @keydown.esc="close"
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
