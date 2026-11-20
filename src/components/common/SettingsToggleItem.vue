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
    class="flex items-center justify-between gap-4 rounded-xl bg-base-200/65 px-3.5 py-3 dark:bg-base-300/45"
    :class="{ 'cursor-not-allowed': disabled }"
  >
    <span class="min-w-0">
      <span class="block text-sm font-medium leading-snug text-base-content">{{ title }}</span>
      <span class="mt-0.5 block truncate text-xs leading-snug text-base-content/55">{{
        description
      }}</span>
    </span>
    <input
      v-model="model"
      type="checkbox"
      class="toggle toggle-primary toggle-sm shrink-0 disabled:opacity-100"
      :disabled="disabled"
    />
  </label>
</template>
