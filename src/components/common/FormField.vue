<script setup lang="ts">
import { CircleAlert } from '@lucide/vue'
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
    <label class="mb-1 block text-sm font-medium text-base-content/70" :for="id">{{ label }}</label>
    <span
      class="input h-12 w-full gap-2.5 rounded-2xl px-4"
      :class="
        error
          ? 'input-error bg-error/5'
          : 'border-base-300 focus-within:border-primary focus-within:outline-primary'
      "
    >
      <component
        :is="icon"
        :size="17"
        aria-hidden="true"
        :class="error ? 'text-error/70' : 'text-base-content/35'"
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
        class="min-w-0 grow bg-transparent text-sm outline-none placeholder:text-base-content/30"
        @blur="$emit('blur')"
      />
    </span>
    <!-- 固定高度提示行：错误出现/消失都不改变布局 -->
    <p
      :id="`${id}-error`"
      class="mt-0.5 flex min-h-4 items-center gap-1 px-1 text-xs font-medium text-error"
    >
      <CircleAlert v-if="error" :size="13" class="shrink-0" />
      {{ error }}
    </p>
  </div>
</template>
