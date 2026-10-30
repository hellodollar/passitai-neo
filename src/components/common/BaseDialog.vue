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

/**
 * 原生 <dialog> + daisyUI modal:焦点陷阱、Esc 关闭、关闭后焦点归还、
 * 背景惰性化均由浏览器提供,不再手写 overlay 焦点管理。
 */
const dialogRef = ref<HTMLDialogElement | null>(null)

watch(
  model,
  async (open) => {
    await nextTick()
    const dialog = dialogRef.value
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  },
  { immediate: true },
)

function close() {
  model.value = false
}

/** Esc:不允许关闭时拦截浏览器默认行为,dialog 保持打开 */
function handleCancel(event: Event) {
  if (!props.closeOnEscape) event.preventDefault()
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="modal modal-middle px-5"
      :aria-label="title"
      @click.self="props.closeOnBackdrop && close()"
      @cancel="handleCancel"
      @close="model = false"
    >
      <!-- 内容随开合挂载/销毁,关闭即重置内部状态;dialog 本体常驻以保留原生行为 -->
      <div v-if="model" class="modal-box flex max-h-[calc(100dvh-2.5rem)] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-0 shadow-none">
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
    </dialog>
  </Teleport>
</template>
