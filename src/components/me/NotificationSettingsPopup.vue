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
    title: 'App 内横幅通知',
    description: '在首页顶部展示最新未读消息提醒',
  },
  {
    key: 'contentPreview',
    title: '显示内容预览',
    description: '在通知横幅和消息列表中显示正文摘要',
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
    <p v-else-if="preferences.isLoading" role="status" class="py-6 text-center text-sm">
      正在加载…
    </p>
    <p v-if="preferences.error || saveError" role="alert" class="mt-3 text-sm text-error">
      {{ saveError ?? preferences.error
      }}<button
        v-if="!preferences.settings"
        type="button"
        class="btn btn-ghost btn-sm ml-2"
        @click="preferences.load()"
      >
        重试
      </button>
    </p>
  </BasePopup>
</template>
