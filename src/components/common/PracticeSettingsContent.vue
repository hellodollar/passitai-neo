<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import { fetchPracticeSettings, updatePracticeSettings } from '@/api/practice'
import type { PracticeSettings } from '@/types/domain'

const model = defineModel<boolean>({ default: false })

const practiceSettings = ref({
  autoNextOnCorrect: false,
  recordWrongQuestions: true,
  showAnalysis: true,
  loopPractice: false,
  autoSubmit: false,
})
const loaded = ref(false)

let lastValues = {
  autoNextOnCorrect: false,
  recordWrongQuestions: true,
  showAnalysis: true,
  loopPractice: false,
  autoSubmit: false,
}

async function loadPracticeSettings() {
  try {
    const settings = await fetchPracticeSettings()
    const next = {
      autoNextOnCorrect: Boolean(settings.autoNext),
      recordWrongQuestions: Boolean(settings.recordWrongQuestions),
      showAnalysis: Boolean(settings.showExplanationAfterAnswer),
      loopPractice: Boolean(settings.loopAfterCompletion),
      autoSubmit: Boolean(settings.autoSubmitAfterCompletion),
    }
    practiceSettings.value = next
    lastValues = { ...next }
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

    const payload: Partial<PracticeSettings> = {}

    if (settings.autoNextOnCorrect !== lastValues.autoNextOnCorrect) {
      payload.autoNext = settings.autoNextOnCorrect
      lastValues.autoNextOnCorrect = settings.autoNextOnCorrect
    }
    if (settings.recordWrongQuestions !== lastValues.recordWrongQuestions) {
      payload.recordWrongQuestions = settings.recordWrongQuestions
      lastValues.recordWrongQuestions = settings.recordWrongQuestions
    }
    if (settings.showAnalysis !== lastValues.showAnalysis) {
      payload.showExplanationAfterAnswer = settings.showAnalysis
      lastValues.showAnalysis = settings.showAnalysis
    }
    if (settings.loopPractice !== lastValues.loopPractice) {
      payload.loopAfterCompletion = settings.loopPractice
      lastValues.loopPractice = settings.loopPractice
    }
    if (settings.autoSubmit !== lastValues.autoSubmit) {
      payload.autoSubmitAfterCompletion = settings.autoSubmit
      lastValues.autoSubmit = settings.autoSubmit
    }

    if (Object.keys(payload).length === 0) return

    void updatePracticeSettings(payload).catch(() => {})
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
