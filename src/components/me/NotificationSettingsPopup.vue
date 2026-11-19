<script setup lang="ts">
import { ref, watch } from 'vue'

import BasePopup from '@/components/common/BasePopup.vue'
import SettingsToggleItem from '@/components/common/SettingsToggleItem.vue'
import { useNotificationSettingsStore } from '@/stores/notification-settings'

const model = defineModel<boolean>({ default: false })
const preferences = useNotificationSettingsStore()
const saving = ref(false)
const saveError = ref<string | null>(null)
const rows = [
  {
    key: 'inAppBanner',
    title: '应用内横幅',
    description: '在首页顶部展示最新未读消息提醒',
  },
  {
    key: 'contentPreview',
    title: '显示内容预览',
    description: '在消息横幅和消息列表中显示正文摘要',
  },
] as const

async function save(key: 'inAppBanner' | 'contentPreview', value: boolean) {
  if (saving.value) return
  saving.value = true
  saveError.value = null
  try {
    await preferences.save({ [key]: value })
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : '设置保存失败'
  } finally {
    saving.value = false
  }
}

watch(model, (active) => {
  saveError.value = null
  if (active) void preferences.load()
})
</script>
<template>
  <BasePopup v-model="model" title="通知">
    <div v-if="preferences.settings" class="grid gap-2">
      <SettingsToggleItem
        v-for="row in rows"
        :key="row.key"
        :model-value="preferences.settings[row.key]"
        :title="row.title"
        :description="row.description"
        :disabled="preferences.isLoading || saving"
        @update:model-value="save(row.key, $event)"
      />
    </div>
    <div
      v-else-if="preferences.isLoading"
      role="status"
      aria-live="polite"
      class="flex flex-col items-center justify-center gap-2 py-8 text-center"
    >
      <span class="loading loading-spinner loading-sm text-primary" aria-hidden="true"></span>
      <p class="text-xs font-medium text-base-content/55">正在加载…</p>
    </div>
    <div
      v-if="preferences.error || saveError"
      role="alert"
      class="mt-3 flex items-center justify-between gap-3 rounded-xl bg-error/10 px-3.5 py-2.5 text-xs text-error"
    >
      <p class="min-w-0 flex-1">{{ saveError ?? preferences.error }}</p>
      <button
        v-if="!preferences.settings"
        type="button"
        class="shrink-0 rounded-lg bg-base-100 px-2.5 py-1 text-xs font-medium text-error transition-colors active:opacity-80 dark:bg-base-200"
        @click="preferences.load()"
      >
        重试
      </button>
    </div>
  </BasePopup>
</template>
