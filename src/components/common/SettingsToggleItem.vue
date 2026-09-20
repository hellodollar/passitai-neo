<script setup lang="ts">
const model = defineModel<boolean>({ required: true })

withDefaults(
  defineProps<{
    title: string
    description: string
    disabled?: boolean
  }>(),
  {
    disabled: false,
  },
)
</script>

<template>
  <label
    class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3"
    :class="{ 'cursor-not-allowed': disabled }"
  >
    <span class="min-w-0">
      <span class="block text-sm font-medium">{{ title }}</span>
      <span class="block truncate text-xs text-base-content/50">{{ description }}</span>
    </span>
    <input
      v-model="model"
      type="checkbox"
      class="toggle toggle-primary toggle-sm shrink-0 disabled:opacity-100"
      :disabled="disabled"
    />
  </label>
</template>
