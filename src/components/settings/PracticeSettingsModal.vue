<script setup lang="ts">
import { watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import BaseModal from '@/components/common/BaseModal.vue'
import PracticeSettingsSection from '@/components/settings/PracticeSettingsSection.vue'

const model = defineModel<boolean>({ default: false })
defineProps<{ showMistakeSettings?: boolean }>()
const auth = useAuthStore()
watch(
  () => auth.session?.token,
  () => {
    model.value = false
  },
)
</script>

<template>
  <BaseModal v-model="model" title="刷题设置">
    <PracticeSettingsSection :active="model" :show-mistake-settings="showMistakeSettings" />
  </BaseModal>
</template>
