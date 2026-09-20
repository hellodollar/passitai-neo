<script setup lang="ts">
import { ref } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import SettingsToggleItem from '@/components/common/SettingsToggleItem.vue'

const model = defineModel<boolean>({ default: false })

const notificationSettings = ref({
  studyReminder: false,
  systemMessage: false,
})
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
