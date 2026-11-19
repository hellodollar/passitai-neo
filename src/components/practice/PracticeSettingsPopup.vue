<script setup lang="ts">
import { computed, watch } from 'vue'

import BasePopup from '@/components/common/BasePopup.vue'
import SettingsToggleItem from '@/components/common/SettingsToggleItem.vue'
import { useAuthStore } from '@/stores/auth'
import { usePracticeSettingsStore } from '@/stores/practice-settings'
import type { PracticeSettings } from '@/types'

const model = defineModel<boolean>({ default: false })
defineProps<{ showMistakeSettings?: boolean }>()
const auth = useAuthStore()
const practiceSettingsStore = usePracticeSettingsStore()
const settings = computed(() => practiceSettingsStore.settings)

function saveSetting(key: keyof PracticeSettings, value: boolean) {
  practiceSettingsStore.save({ [key]: value }, auth.session?.user.id)
}

watch(
  () => auth.session?.token,
  () => {
    model.value = false
  },
)
watch(
  [model, () => auth.session?.user.id],
  ([active, userId]) => {
    if (active) practiceSettingsStore.load(userId ?? '')
  },
  { immediate: true },
)
</script>

<template>
  <BasePopup v-model="model" title="刷题设置">
    <section class="grid gap-2">
      <SettingsToggleItem
        :model-value="settings.autoNext"
        title="答对自动下一题"
        description="答对后自动跳转下一题"
        @update:model-value="saveSetting('autoNext', $event)"
      />
      <SettingsToggleItem
        :model-value="settings.shuffleQuestions"
        title="乱序出题"
        description="下次进入练习时打乱题目顺序"
        @update:model-value="saveSetting('shuffleQuestions', $event)"
      />
      <SettingsToggleItem
        :model-value="settings.autoSubmitAfterCompletion"
        title="自动交卷"
        description="答完全部题目后自动提交"
        @update:model-value="saveSetting('autoSubmitAfterCompletion', $event)"
      />
      <SettingsToggleItem
        :model-value="settings.recordWrongQuestions"
        title="记录错题"
        description="自动收集答错的题目到错题本"
        @update:model-value="saveSetting('recordWrongQuestions', $event)"
      />
      <template v-if="showMistakeSettings">
        <h4 class="mt-2 px-0.5 text-xs font-medium text-base-content/55">错题设置</h4>
        <SettingsToggleItem
          :model-value="settings.removeMistakeOnCorrect"
          title="答对自动移除错题"
          description="再次答对已收录的错题时自动移出错题本"
          @update:model-value="saveSetting('removeMistakeOnCorrect', $event)"
        />
      </template>
    </section>
  </BasePopup>
</template>
