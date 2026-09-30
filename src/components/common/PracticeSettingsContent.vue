<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import SettingsToggleItem from '@/components/common/SettingsToggleItem.vue'
import { usePracticeSettingsStore } from '@/stores/practiceSettings'
import type { PracticeSettings } from '@/types/domain'

const model = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  /** 单项设置保存成功，携带当前完整设置，供外层同步聚合数据 */
  saved: [settings: PracticeSettings]
}>()

const props = withDefaults(
  defineProps<{
    settings?: PracticeSettings | null
    external?: boolean
  }>(),
  {
    settings: null,
    external: false,
  },
)

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
  if (props.external && props.settings) {
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

// 打开弹框时按需加载一次,之后复用 store 缓存
watch(model, (open) => {
  if (open && !loaded.value) void loadPracticeSettings()
})

defineExpose({ practiceSettings })
</script>

<template>
  <BaseModal v-model="model" title="练习设置">
    <div class="grid gap-2">
      <SettingsToggleItem
        v-model="practiceSettings.autoNextOnCorrect"
        title="答题正确自动下一题"
        description="答对后自动跳转下一题"
      />
      <SettingsToggleItem
        v-model="practiceSettings.recordWrongQuestions"
        title="记录错题"
        description="自动收集答错的题目到错题本"
      />
      <SettingsToggleItem
        v-model="practiceSettings.showAnalysis"
        title="答题后显示解析"
        description="提交答案后立即展示题目解析"
      />
      <SettingsToggleItem
        v-model="practiceSettings.loopPractice"
        title="循环练习"
        description="答完一遍后自动重新开始"
      />
      <SettingsToggleItem
        v-model="practiceSettings.autoSubmit"
        title="自动交卷"
        description="答完全部题目后自动提交"
      />
    </div>
  </BaseModal>
</template>
