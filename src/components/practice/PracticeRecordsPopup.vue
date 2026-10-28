<script setup lang="ts">
import { Eraser } from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'

import BasePopup from '@/components/common/BasePopup.vue'
import ClearPracticeRecordsDialog from '@/components/practice/ClearPracticeRecordsDialog.vue'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { PRACTICE_CATEGORY_LABELS } from '@/constants/practice'
import { useAuthStore } from '@/stores/auth'
import type { PracticeRecordClearScope } from '@/types'

const model = defineModel<boolean>({ default: false })
const auth = useAuthStore()
const { records, refresh } = useLocalPracticeRecords()
const clearOpen = ref(false)
const clearScope = ref<PracticeRecordClearScope | null>(null)
const clearLabel = ref('')
let clearToken: string | undefined
const categories = computed(() =>
  Object.entries(PRACTICE_CATEGORY_LABELS).map(([type, label]) => ({
    type: type as keyof typeof PRACTICE_CATEGORY_LABELS,
    label,
    count: records.value.filter(
      (record) => record.source === 'practice' && record.paperType === type,
    ).length,
  })),
)
const collectionCount = computed(
  () => records.value.filter((record) => record.source !== 'practice').length,
)
const totalCount = computed(() => records.value.length)

watch(clearOpen, (open, previous) => {
  if (!open && previous && clearToken === auth.session?.token && auth.isAuthenticated) {
    clearScope.value = null
    clearToken = undefined
    model.value = true
  }
})

async function requestClear(type?: keyof typeof PRACTICE_CATEGORY_LABELS) {
  const userId = auth.session?.user.id
  if (!userId) return
  const token = auth.session?.token
  clearToken = token
  clearScope.value = type ? { kind: 'category', userId, paperType: type } : { kind: 'all', userId }
  clearLabel.value = type
    ? `本机全部科目的${PRACTICE_CATEGORY_LABELS[type]}做题记录`
    : '当前账号在本机保存的全部做题记录'
  model.value = false
  await nextTick()
  if (token !== clearToken || token !== auth.session?.token || !auth.isAuthenticated) return
  clearOpen.value = true
}
watch(
  () => auth.session?.token,
  () => {
    clearToken = undefined
    clearOpen.value = false
    clearScope.value = null
    clearLabel.value = ''
    model.value = false
  },
)
</script>

<template>
  <BasePopup v-model="model" title="刷题记录" compact-footer>
    <p class="mb-2 text-xs leading-5 text-base-content/65">
      当前管理本机保存的作答，不影响交卷报告。
    </p>
    <div class="divide-y divide-base-200">
      <div
        v-for="category in categories"
        :key="category.type"
        class="flex min-h-12 items-center gap-3"
      >
        <span class="flex-1 text-sm">{{ category.label }}</span>
        <span class="text-xs tabular-nums text-base-content/65">{{ category.count }} 个题集</span>
        <button
          class="btn btn-square btn-ghost btn-sm text-base-content/55"
          type="button"
          :disabled="category.count === 0"
          :aria-label="`清除${category.label}记录`"
          @click="requestClear(category.type)"
        >
          <Eraser :size="16" />
        </button>
      </div>
    </div>
    <p v-if="collectionCount" class="mt-3 text-xs text-base-content/65">
      收藏与错题练习：{{ collectionCount }} 份本地作答，清除全部时一并处理。
    </p>
    <p v-if="!totalCount" class="mt-3 text-center text-xs text-base-content/65">暂无刷题记录</p>
    <template #footer>
      <button
        class="btn btn-error h-9 min-h-9 w-full rounded-lg text-sm"
        type="button"
        :disabled="totalCount === 0"
        @click="requestClear()"
      >
        清除全部记录
      </button>
    </template>
  </BasePopup>
  <ClearPracticeRecordsDialog
    v-model="clearOpen"
    :scope="clearScope"
    :label="clearLabel"
    @cleared="refresh"
  />
</template>
