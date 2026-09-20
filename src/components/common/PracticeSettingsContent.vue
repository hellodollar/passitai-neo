<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import { fetchUserSettings, updatePracticeSettings } from '@/api/settings'

const model = defineModel<boolean>({ default: false })

const practiceSettings = ref({
  autoNextOnCorrect: true,
  recordWrongQuestions: true,
  showAnalysis: false,
  loopPractice: false,
  autoSubmit: false,
})
const loaded = ref(false)

async function loadPracticeSettings() {
  try {
    const settings = await fetchUserSettings()
    practiceSettings.value = {
      autoNextOnCorrect: Boolean(
        settings.practice?.autoNext ?? settings.practice?.autoNextOnCorrect ?? true,
      ),
      recordWrongQuestions: Boolean(settings.practice?.recordWrongQuestions ?? true),
      showAnalysis: Boolean(settings.practice?.showAnswerAfterSubmit ?? false),
      loopPractice: false,
      autoSubmit: false,
    }
  } catch {
    // Keep local defaults while the backend settings endpoint is still placeholder-only.
  } finally {
    await nextTick()
    loaded.value = true
  }
}

watch(
  practiceSettings,
  (settings) => {
    if (!loaded.value) return

    void updatePracticeSettings({
      autoNext: settings.autoNextOnCorrect,
      autoNextOnCorrect: settings.autoNextOnCorrect,
      recordWrongQuestions: settings.recordWrongQuestions,
      showAnswerAfterSubmit: settings.showAnalysis,
    }).catch(() => {})
  },
  { deep: true },
)

onMounted(() => {
  loadPracticeSettings()
})

defineExpose({ practiceSettings })
</script>

<template>
  <BaseModal v-model="model">
    <div class="grid gap-2">
      <label class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3">
        <span>
          <span class="block text-sm font-medium">答题正确自动下一题</span>
          <span class="text-xs text-base-content/50">答对后自动跳转下一题</span>
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          v-model="practiceSettings.autoNextOnCorrect"
        />
      </label>

      <label class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3">
        <span>
          <span class="block text-sm font-medium">记录错题</span>
          <span class="text-xs text-base-content/50">自动收集答错的题目到错题本</span>
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          v-model="practiceSettings.recordWrongQuestions"
        />
      </label>

      <label class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3">
        <span>
          <span class="block text-sm font-medium">答题后显示解析</span>
          <span class="text-xs text-base-content/50">提交答案后立即展示题目解析</span>
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          v-model="practiceSettings.showAnalysis"
        />
      </label>

      <label class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3">
        <span>
          <span class="block text-sm font-medium">循环练习</span>
          <span class="text-xs text-base-content/50">答完一遍后自动重新开始</span>
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          v-model="practiceSettings.loopPractice"
        />
      </label>

      <label class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3">
        <span>
          <span class="block text-sm font-medium">自动交卷</span>
          <span class="text-xs text-base-content/50">答完全部题目后自动提交</span>
        </span>
        <input
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          v-model="practiceSettings.autoSubmit"
        />
      </label>
    </div>
  </BaseModal>
</template>
