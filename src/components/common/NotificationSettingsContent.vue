<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import SettingsToggleItem from '@/components/common/SettingsToggleItem.vue'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    notifications?: {
      dailyReminder?: boolean
      reminderTime?: string
      weeklyReport?: boolean
    } | null
  }>(),
  {
    notifications: null,
  },
)

const notificationSettings = ref({
  studyReminder: false,
  systemMessage: false,
})

watch(
  () => props.notifications,
  (value) => {
    if (!value) return
    notificationSettings.value = {
      studyReminder: Boolean(value.dailyReminder),
      systemMessage: Boolean(value.weeklyReport),
    }
  },
  { immediate: true },
)
</script>

<template>
  <BaseModal v-model="model">
    <div class="grid gap-2">
      <SettingsToggleItem
        v-model="notificationSettings.studyReminder"
        title="学习提醒"
        description="功能暂未开放"
        disabled
      />
      <SettingsToggleItem
        v-model="notificationSettings.systemMessage"
        title="系统消息"
        description="功能暂未开放"
        disabled
      />
    </div>
  </BaseModal>
</template>
