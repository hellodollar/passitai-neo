<script setup lang="ts">
import { watch } from 'vue'

import BasePopup from '@/components/common/BasePopup.vue'
import { useNotificationSettingsStore } from '@/stores/notification-settings'
const model = defineModel<boolean>({ default: false })
const preferences = useNotificationSettingsStore()
const rows = [
  { key: 'inAppBanner', title: 'App 内横幅通知' },
  { key: 'contentPreview', title: '显示内容预览' },
] as const
async function save(key: 'inAppBanner' | 'contentPreview', event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.checked
  try {
    await preferences.save({ [key]: value })
  } catch {
    /* 错误在开关下方显示，保留服务器原值。 */
  } finally {
    input.checked = preferences.settings?.[key] ?? false
  }
}
watch(model, (active) => {
  if (active) void preferences.load()
})
</script>
<template>
  <BasePopup v-model="model" title="通知">
    <div v-if="preferences.settings" class="space-y-2">
      <label
        v-for="row in rows"
        :key="row.key"
        class="flex min-h-12 items-center justify-between gap-4 rounded-xl bg-base-200/70 px-3 py-3 text-sm"
      >
        <span>{{ row.title }}</span
        ><input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          :checked="preferences.settings[row.key]"
          :disabled="preferences.loading || preferences.saving"
          @change="save(row.key, $event)"
        />
      </label>
    </div>
    <p v-else-if="preferences.loading" role="status" class="py-6 text-center text-sm">正在加载…</p>
    <p v-if="preferences.error" role="alert" class="mt-3 text-sm text-error">
      {{ preferences.error
      }}<button
        v-if="!preferences.settings"
        type="button"
        class="btn btn-ghost btn-sm ml-2"
        @click="preferences.load(true)"
      >
        重试
      </button>
    </p>
  </BasePopup>
</template>
