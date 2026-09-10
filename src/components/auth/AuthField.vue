<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  label: string
  icon: Component
  type?: string
  inputmode?: 'text' | 'email' | 'numeric'
  autocomplete?: string
  placeholder?: string
  modelValue: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <label class="block">
    <span class="mb-1.5 block text-sm font-medium text-base-content/70">{{ label }}</span>
    <span
      class="flex h-12 w-full items-center gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-4 transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15"
    >
      <component :is="icon" :size="17" class="text-base-content/35" />
      <input
        :type="type ?? 'text'"
        :inputmode="inputmode"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :value="modelValue"
        class="grow bg-transparent text-sm outline-none placeholder:text-base-content/30"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </span>
  </label>
</template>
