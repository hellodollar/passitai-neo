<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import SettingsToggleItem from '@/components/common/SettingsToggleItem.vue'
import { usePracticeSettingsStore } from '@/stores/practiceSettings'
import type { PracticeSettings } from '@/types/domain'

const props = withDefaults(
  defineProps<{
    /** 弹框处于打开状态,首次打开时按需加载设置 */
    active?: boolean
    /** 外部聚合数据(如 /api/me 的 preferences.practice),提供时优先使用 */
    settings?: PracticeSettings | null
    /** 聚合模式下是否显示分组标题 */
    showHeader?: boolean
  }>(),
  {
    active: false,
    settings: null,
    showHeader: false,
  },
)

const emit = defineEmits<{
  /** 单项设置保存成功，携带当前完整设置，供外层同步聚合数据 */
  saved: [settings: PracticeSettings]
}>()

const practiceSettingsStore = usePracticeSettingsStore()

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

function applySettings(settings: PracticeSettings) {
  const next = {
    autoNextOnCorrect: Boolean(settings.autoNext),
    recordWrongQuestions: Boolean(settings.recordWrongQuestions),
    showAnalysis: Boolean(settings.showExplanationAfterAnswer),
    loopPractice: Boolean(settings.loopAfterCompletion),
    autoSubmit: Boolean(settings.autoSubmitAfterCompletion),
  }
  practiceSettings.value = next
  lastValues = { ...next }
}

// 首次打开时才加载:优先用外部传入,缺失时走 store 缓存(无缓存才请求)
async function loadPracticeSettings() {
  if (props.settings) {
    applySettings(props.settings)
    await nextTick()
    loaded.value = true
    return
  }

  const cached = await practiceSettingsStore.ensure()
  if (cached) applySettings(cached)
  await nextTick()
  loaded.value = true
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

    void practiceSettingsStore
      .patch(payload)
      .then(() => {
        const s = practiceSettings.value
        emit('saved', {
          autoNext: s.autoNextOnCorrect,
          recordWrongQuestions: s.recordWrongQuestions,
          showExplanationAfterAnswer: s.showAnalysis,
          loopAfterCompletion: s.loopPractice,
          autoSubmitAfterCompletion: s.autoSubmit,
        })
      })
      .catch(() => {})
  },
  { deep: true },
)

watch(
  () => props.settings,
  (value) => {
    if (value) applySettings(value)
  },
)

watch(
  () => props.active,
  (open) => {
    if (open && !loaded.value) void loadPracticeSettings()
  },
  { immediate: true },
)
</script>

<template>
  <section class="grid gap-2">
    <h4 v-if="showHeader" class="text-[13px] font-semibold text-base-content/60">刷题设置</h4>

    <p class="px-0.5 text-xs text-base-content/45">作答行为</p>
    <SettingsToggleItem
      v-model="practiceSettings.autoNextOnCorrect"
      title="答题正确自动下一题"
      description="答对后自动跳转下一题"
    />
    <SettingsToggleItem
      v-model="practiceSettings.autoSubmit"
      title="自动交卷"
      description="答完全部题目后自动提交"
    />

    <p class="mt-2 px-0.5 text-xs text-base-content/45">练习方式</p>
    <SettingsToggleItem
      v-model="practiceSettings.loopPractice"
      title="循环练习"
      description="答完一遍后自动重新开始"
    />

    <p class="mt-2 px-0.5 text-xs text-base-content/45">反馈与记录</p>
    <SettingsToggleItem
      v-model="practiceSettings.showAnalysis"
      title="答题后显示解析"
      description="提交答案后立即展示题目解析"
    />
    <SettingsToggleItem
      v-model="practiceSettings.recordWrongQuestions"
      title="记录错题"
      description="自动收集答错的题目到错题本"
    />
  </section>
</template>
