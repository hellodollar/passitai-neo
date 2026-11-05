<script setup lang="ts">
import { ChevronDown, Check } from '@lucide/vue'
import { computed, ref } from 'vue'

import BasePopup from '@/components/common/BasePopup.vue'

/**
 * 字段式选项选择:点击打开弹层单选列表,替代原生 select。
 * 原生下拉的展开列表无法样式化且会被视口裁剪,弹层方案与全局深浅主题一致。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    options: ReadonlyArray<{ value: string; label: string }>
    /** 弹层标题,同时作为可访问名称 */
    title: string
    placeholder?: string
    disabled?: boolean
  }>(),
  {
    placeholder: '请选择',
    disabled: false,
  },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const selectedLabel = computed(
  () => props.options.find((option) => option.value === props.modelValue)?.label ?? '',
)

function pick(value: string) {
  open.value = false
  if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>

<template>
  <button
    class="flex h-10 min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-base-300 bg-base-100 px-3.5 text-left text-sm transition-colors disabled:opacity-50"
    :class="modelValue ? 'text-base-content' : 'text-base-content/45'"
    type="button"
    :aria-label="title"
    aria-haspopup="dialog"
    :disabled="disabled"
    @click="open = true"
  >
    <span class="min-w-0 truncate">{{ selectedLabel || placeholder }}</span>
    <ChevronDown :size="16" class="shrink-0 text-base-content/40" aria-hidden="true" />
  </button>

  <BasePopup v-model="open" :title="title">
    <div class="max-h-[52dvh] overflow-y-auto overscroll-contain" role="radiogroup" :aria-label="title">
      <button
        v-for="option in options"
        :key="option.value"
        class="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3.5 text-left text-sm transition-colors active:bg-base-200/60"
        :class="option.value === modelValue ? 'bg-primary/5 font-medium text-primary' : 'text-base-content'"
        type="button"
        role="radio"
        :aria-checked="option.value === modelValue"
        @click="pick(option.value)"
      >
        <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
        <Check
          v-if="option.value === modelValue"
          :size="17"
          class="shrink-0 text-primary"
          aria-hidden="true"
        />
      </button>
    </div>
  </BasePopup>
</template>
