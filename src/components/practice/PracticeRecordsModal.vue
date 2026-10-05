<script setup lang="ts">
import { Eraser } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import ClearPracticeRecordsDialog from '@/components/practice/ClearPracticeRecordsDialog.vue'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { PRACTICE_CATEGORY_LABELS } from '@/constants/practice'
import { useAuthStore } from '@/stores/auth'
import type { PracticeRecordClearScope } from '@/types/practice-record'

const model = defineModel<boolean>({ default: false })
const auth = useAuthStore()
const { records, legacyCount, refresh } = useLocalPracticeRecords()
const clearOpen = ref(false)
const clearScope = ref<PracticeRecordClearScope | null>(null)
const clearLabel = ref('')
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
const totalCount = computed(() => records.value.length + legacyCount.value)

watch(clearOpen, (open, previous) => {
  if (!open && previous) model.value = true
})

function requestClear(type?: keyof typeof PRACTICE_CATEGORY_LABELS) {
  const userId = auth.session?.user.id
  if (!userId) return
  clearScope.value = type ? { kind: 'category', userId, paperType: type } : { kind: 'all', userId }
  clearLabel.value = type
    ? `清除全部科目的${PRACTICE_CATEGORY_LABELS[type]}做题记录？`
    : '清除当前账号全部本地做题记录？'
  model.value = false
  clearOpen.value = true
}
</script>

<template>
  <BaseModal v-model="model" title="刷题记录" compact-footer>
    <div class="divide-y divide-base-200">
      <div
        v-for="category in categories"
        :key="category.type"
        class="flex min-h-12 items-center gap-3"
      >
        <span class="flex-1 text-sm">{{ category.label }}</span>
        <span class="text-xs tabular-nums text-base-content/45">{{ category.count }} 个题集</span>
        <button
          class="btn btn-square btn-ghost btn-sm text-base-content/55"
          type="button"
          :disabled="category.count === 0 && legacyCount === 0"
          :aria-label="`清除${category.label}记录`"
          @click="requestClear(category.type)"
        >
          <Eraser :size="16" />
        </button>
      </div>
    </div>
    <p v-if="collectionCount" class="mt-3 text-xs text-base-content/45">
      收藏与错题练习：{{ collectionCount }} 份本地作答，清除全部时一并处理。
    </p>
    <p v-if="legacyCount" class="mt-3 text-xs text-base-content/45">
      另有 {{ legacyCount }} 份旧记录，清除全部时一并处理。
    </p>
    <p v-if="!totalCount" class="mt-3 text-center text-xs text-base-content/45">暂无刷题记录</p>
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
  </BaseModal>
  <ClearPracticeRecordsDialog
    v-model="clearOpen"
    :scope="clearScope"
    :label="clearLabel"
    @cleared="refresh"
  />
</template>
