<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

defineOptions({ inheritAttrs: false })

const model = defineModel<boolean>({ default: false })
const props = withDefaults(
  defineProps<{
    title?: string
    compactFooter?: boolean
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
    /** 追加到内容盒的类;如答题卡传入固定高度,让抽屉恒高、底部操作恒定居底 */
    boxClass?: string
  }>(),
  { closeOnBackdrop: true, closeOnEscape: true, boxClass: '' },
)
const emit = defineEmits<{ opened: []; closed: [] }>()

/**
 * 原生 <dialog> + daisyUI modal-bottom:焦点陷阱、Esc 关闭、关闭后焦点归还、
 * 背景惰性化均由浏览器提供,不再手写 overlay 焦点管理。
 */
const dialogRef = ref<HTMLDialogElement | null>(null)

watch(
  model,
  async (open) => {
    await nextTick()
    const dialog = dialogRef.value
    if (!dialog) return
    if (open) {
      if (!dialog.open) {
        dialog.showModal()
        emit('opened')
      }
    } else if (dialog.open) {
      // 外部置 false 时主动关闭;closed 统一在 close 事件中发出
      dialog.close()
    }
  },
  { immediate: true },
)

/** Esc:不允许关闭时拦截浏览器默认行为,dialog 保持打开 */
function handleCancel(event: Event) {
  if (!props.closeOnEscape) event.preventDefault()
}

/** 关闭事件是唯一出口:同步 model 并通知外部,无论 Esc/遮罩/程序化关闭 */
function handleClose() {
  if (model.value) model.value = false
  emit('closed')
}
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="modal modal-bottom"
      :aria-label="title || '弹出层'"
      v-bind="$attrs"
      @click.self="props.closeOnBackdrop && (model = false)"
      @cancel="handleCancel"
      @close="handleClose"
    >
      <!-- 内容随开合挂载/销毁,关闭即重置内部状态;dialog 本体常驻以保留原生行为 -->
      <section
        v-if="model"
        class="modal-box mx-auto mb-0 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-b-none rounded-t-2xl border-t border-base-300 bg-base-100 p-0 shadow-none"
        :class="props.boxClass"
      >
        <slot name="header">
          <div v-if="title" class="shrink-0 border-b border-base-200 px-4 py-2.5 text-center">
            <h3 class="text-[15px] font-semibold leading-tight">{{ title }}</h3>
          </div>
        </slot>

        <slot name="body">
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            <slot></slot>
          </div>
        </slot>

        <div
          v-if="$slots.footer"
          class="flex shrink-0 gap-2 border-t border-base-200"
          :class="
            compactFooter
              ? 'items-center justify-end px-4 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]'
              : 'p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]'
          "
        >
          <slot name="footer"></slot>
        </div>
      </section>
    </dialog>
  </Teleport>
</template>
