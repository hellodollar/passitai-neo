<script setup lang="ts">
import { ChevronDown, Check } from '@lucide/vue'
import { computed, ref } from 'vue'

import BasePopup from '@/components/common/BasePopup.vue'

defineOptions({ inheritAttrs: false })

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
    v-bind="$attrs"
    class="flex h-10 min-h-10 w-full items-center justify-between gap-2 rounded-xl border border-transparent bg-base-200/65 px-3.5 text-left text-sm transition-colors active:bg-base-200 disabled:opacity-50 dark:bg-base-300/45 dark:active:bg-base-300/70"
    :class="modelValue ? 'text-base-content' : 'text-base-content/45'"
    type="button"
    :aria-label="title"
    aria-haspopup="dialog"
    :disabled="disabled"
    @click="open = true"
  >
    <span class="min-w-0 truncate">{{ selectedLabel || placeholder }}</span>
    <ChevronDown :size="15" class="shrink-0 text-base-content/30" aria-hidden="true" />
  </button>

  <BasePopup v-model="open" :title="title">
    <div
      class="max-h-[52dvh] divide-y divide-base-content/[0.06] overflow-y-auto overscroll-contain rounded-xl bg-base-200/65 dark:divide-base-content/[0.08] dark:bg-base-300/45"
      role="radiogroup"
      :aria-label="title"
    >
      <button
        v-for="option in options"
        :key="option.value"
        class="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 text-left text-sm transition-colors active:bg-base-200 dark:active:bg-base-300/70"
        :class="
          option.value === modelValue
            ? 'bg-primary/10 font-medium text-primary dark:bg-primary/15'
            : 'text-base-content'
        "
        type="button"
        role="radio"
        :aria-checked="option.value === modelValue"
        @click="pick(option.value)"
      >
        <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
        <Check
          v-if="option.value === modelValue"
          :size="15"
          class="shrink-0 text-primary"
          aria-hidden="true"
        />
      </button>
    </div>
  </BasePopup>
</template>
