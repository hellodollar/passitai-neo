<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import PracticeSettingsSection from '@/components/settings/PracticeSettingsSection.vue'
import type { PracticeSettings } from '@/types'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    /** 外部聚合数据(如 /api/me 的 preferences.practice)。 */
    settings?: PracticeSettings | null
    /** 是否显示错题设置分组，仅"我的-刷题设置"弹框开启 */
    showMistakeSettings?: boolean
  }>(),
  {
    settings: null,
    showMistakeSettings: false,
  },
)

const emit = defineEmits<{
  saved: [settings: PracticeSettings]
}>()
</script>

<template>
  <BaseModal v-model="model" title="刷题设置">
    <PracticeSettingsSection
      :active="model"
      :settings="props.settings"
      :show-mistake-settings="props.showMistakeSettings"
      @saved="emit('saved', $event)"
    />
  </BaseModal>
</template>
