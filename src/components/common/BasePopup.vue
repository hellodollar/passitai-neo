<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import { restoreOverlayFocus, trapOverlayFocus } from './overlay'

defineOptions({ inheritAttrs: false })

const model = defineModel<boolean>({ default: false })
const props = withDefaults(
  defineProps<{
    title?: string
    compactFooter?: boolean
    closeOnBackdrop?: boolean
    closeOnEscape?: boolean
  }>(),
  { closeOnBackdrop: true, closeOnEscape: true },
)
const emit = defineEmits<{ opened: []; closed: [] }>()
const popupRef = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

watch(
  model,
  async (open, wasOpen) => {
    if (open) {
      previousFocus ??=
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      await nextTick()
      if (!model.value) return
      popupRef.value?.focus({ preventScroll: true })
      emit('opened')
    } else {
      if (!wasOpen) return
      await nextTick()
      await nextTick()
      if (model.value) return
      restoreOverlayFocus(previousFocus)
      previousFocus = null
      emit('closed')
    }
  },
  { immediate: true },
)
</script>

<template>
  <Teleport to="body">
    <div
      v-if="model"
      class="modal modal-open modal-bottom"
      @click.self="props.closeOnBackdrop && (model = false)"
    >
      <section
        ref="popupRef"
        class="modal-box mx-auto mb-0 flex max-h-[88dvh] w-full max-w-lg flex-col overflow-hidden rounded-b-none rounded-t-2xl border-t border-base-300 bg-base-100 p-0 shadow-none"
        role="dialog"
        aria-modal="true"
        :aria-label="title || '弹出层'"
        tabindex="-1"
        v-bind="$attrs"
        @keydown.esc.stop.prevent="props.closeOnEscape && (model = false)"
        @keydown.tab="trapOverlayFocus($event, popupRef)"
      >
        <slot name="header">
          <div v-if="title" class="shrink-0 border-b border-base-200 px-4 py-2.5 text-center">
            <h3 class="text-[15px] font-semibold leading-tight">{{ title }}</h3>
          </div>
        </slot>

        <slot name="body">
          <div class="min-h-0 overflow-y-auto overscroll-contain p-4">
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
    </div>
  </Teleport>
</template>
