<script setup lang="ts">
import type { Component } from 'vue'
import { useId } from 'vue'

const model = defineModel<string>({ required: true })

defineProps<{
  label: string
  icon: Component
  type?: string
  inputmode?: 'text' | 'email' | 'numeric'
  autocomplete?: string
  placeholder?: string
  error?: string
}>()

defineEmits<{
  blur: []
}>()

const id = useId()
</script>

<template>
  <div>
    <label class="mb-1.5 block text-xs font-medium text-base-content/70" :for="id">{{
      label
    }}</label>
    <span
      class="flex h-11 w-full items-center gap-2.5 rounded-xl border px-3.5 transition-colors"
      :class="
        error
          ? 'border-error/40 bg-error/10'
          : 'border-transparent bg-base-200/65 focus-within:border-primary/40 focus-within:bg-base-100 dark:bg-base-300/45 dark:focus-within:bg-base-200'
      "
    >
      <component
        :is="icon"
        :size="16"
        aria-hidden="true"
        class="shrink-0"
        :class="error ? 'text-error' : 'text-base-content/40'"
      />
      <input
        :id="id"
        :type="type ?? 'text'"
        :inputmode="inputmode"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        v-model="model"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="min-w-0 grow bg-transparent text-sm text-base-content outline-none placeholder:text-base-content/40"
        @blur="$emit('blur')"
      />
    </span>
    <!-- 固定高度提示行：错误出现/消失都不改变布局 -->
    <p
      :id="`${id}-error`"
      class="flex min-h-4.5 items-center px-1 pt-0.5 text-xs font-medium text-error"
    >
      {{ error }}
    </p>
  </div>
</template>
