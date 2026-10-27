<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsToggleItem from '@/components/common/SettingsToggleItem.vue'
import { useAuthStore } from '@/stores/auth'
import { usePracticeSettingsStore } from '@/stores/practice-settings'
import type { PracticeSettings } from '@/types'

const props = defineProps<{ active?: boolean; showMistakeSettings?: boolean }>()
const auth = useAuthStore()
const practiceSettingsStore = usePracticeSettingsStore()
const pending = ref<Partial<Record<keyof PracticeSettings, { value: boolean; sequence: number }>>>(
  {},
)
let sequence = 0
const settings = computed(() => {
  if (!practiceSettingsStore.settings) return null
  const next = { ...practiceSettingsStore.settings }
  for (const key of Object.keys(pending.value) as Array<keyof PracticeSettings>) {
    const edit = pending.value[key]
    if (edit) next[key] = edit.value
  }
  return next
})

async function saveSetting(key: keyof PracticeSettings, value: boolean) {
  const edit = ++sequence
  const token = auth.session?.token
  pending.value = { ...pending.value, [key]: { value, sequence: edit } }
  try {
    await practiceSettingsStore.save({ [key]: value })
  } catch {
    // 请求层显示错误；移除本次乐观值后恢复到共享状态中的服务端值。
  } finally {
    if (token === auth.session?.token && pending.value[key]?.sequence === edit) {
      const next = { ...pending.value }
      delete next[key]
      pending.value = next
    }
  }
}

watch(
  () => auth.session?.token,
  () => {
    pending.value = {}
  },
)
watch(
  [() => props.active, () => auth.session?.token],
  ([active]) => {
    if (active) void practiceSettingsStore.load()
  },
  { immediate: true },
)
</script>

<template>
  <section class="grid gap-2">
    <template v-if="settings">
      <SettingsToggleItem
        :model-value="settings.autoNext"
        title="答题正确自动下一题"
        description="答对后自动跳转下一题"
        @update:model-value="saveSetting('autoNext', $event)"
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
        <h4 class="mt-2 text-[13px] font-semibold text-base-content/60">错题设置</h4>
        <SettingsToggleItem
          :model-value="settings.removeMistakeOnCorrect"
          title="答对自动移除错题"
          description="再次答对已收录的错题时自动移出错题本"
          @update:model-value="saveSetting('removeMistakeOnCorrect', $event)"
        />
      </template>
    </template>
    <div v-else class="py-6 text-center text-sm text-base-content/60">
      <template v-if="practiceSettingsStore.isLoading">正在加载刷题设置…</template>
      <template v-else>
        <p>刷题设置加载失败</p>
        <button
          class="btn btn-ghost btn-sm mt-2"
          type="button"
          @click="practiceSettingsStore.load()"
        >
          重试
        </button>
      </template>
    </div>
  </section>
</template>
