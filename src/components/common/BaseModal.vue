<script setup lang="ts">
const model = defineModel<boolean>({ default: false })

defineProps<{
  title?: string
  compactFooter?: boolean
}>()

function close() {
  model.value = false
}
</script>

<template>
  <Teleport to="body">
    <div v-if="model" class="modal modal-open modal-bottom sm:modal-middle" @click.self="close">
      <div
        class="modal-box mx-0 mb-0 max-h-[88dvh] w-full max-w-none overflow-hidden rounded-b-none rounded-t-2xl border-t border-base-300 p-0 sm:mx-3 sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-2xl sm:border"
      >
        <div
          v-if="title || $slots.header"
          class="flex items-center justify-center border-b border-base-200 px-4 py-2.5"
        >
          <slot name="header">
            <h3 class="text-[15px] font-semibold leading-tight">{{ title }}</h3>
          </slot>
        </div>

        <div class="max-h-[calc(88dvh-9rem)] overflow-y-auto p-4 sm:max-h-[calc(100dvh-10rem)]">
          <slot></slot>
        </div>

        <div
          v-if="$slots.footer"
          class="flex gap-2 border-t border-base-200"
          :class="
            compactFooter
              ? 'items-center justify-end px-4 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]'
              : 'p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]'
          "
        >
          <slot name="footer"></slot>
        </div>
      </div>
    </div>
  </Teleport>
</template>
