<script setup lang="ts">
import BaseModal from '@/components/common/BaseModal.vue'
import PracticeSettingsSection from '@/components/settings/PracticeSettingsSection.vue'
import type { PracticeSettings } from '@/types/domain'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    /** 外部聚合数据(如 /api/me 的 preferences.practice)。 */
    settings?: PracticeSettings | null
  }>(),
  {
    settings: null,
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
      @saved="emit('saved', $event)"
    />
  </BaseModal>
</template>
