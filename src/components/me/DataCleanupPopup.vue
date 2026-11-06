<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import ClearCollectionDialog from '@/components/collection/ClearCollectionDialog.vue'
import BasePopup from '@/components/common/BasePopup.vue'
import ClearPracticeRecordsDialog from '@/components/practice/ClearPracticeRecordsDialog.vue'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { PRACTICE_CATEGORY_LABELS } from '@/constants/practice'
import { useAuthStore } from '@/stores/auth'
import type { CollectionSource, PracticeRecordClearScope } from '@/types'

type ClearTarget =
  | { kind: 'practice'; scope: PracticeRecordClearScope; label: string }
  | { kind: 'collection'; source: CollectionSource }

const model = defineModel<boolean>({ default: false })
const auth = useAuthStore()
const { records, refresh } = useLocalPracticeRecords()
const confirmOpen = ref(false)
const clearTarget = ref<ClearTarget | null>(null)
const categories = computed(() =>
  Object.entries(PRACTICE_CATEGORY_LABELS).map(([type, label]) => ({
    type: type as keyof typeof PRACTICE_CATEGORY_LABELS,
    label,
    hasRecords: records.value.some(
      (record) => record.source === 'practice' && record.paperType === type,
    ),
  })),
)
const collections: Array<{ source: CollectionSource; label: string }> = [
  { source: 'favorites', label: '收藏' },
  { source: 'mistakes', label: '错题' },
]

function requestPracticeClear(type?: keyof typeof PRACTICE_CATEGORY_LABELS) {
  const userId = auth.session?.user.id
  if (!model.value || confirmOpen.value || !auth.isAuthenticated || !userId) return
  clearTarget.value = {
    kind: 'practice',
    scope: type ? { kind: 'category', userId, paperType: type } : { kind: 'all', userId },
    label: type
      ? `当前账号在本机保存的全部${PRACTICE_CATEGORY_LABELS[type]}作答记录`
      : '当前账号在本机保存的全部作答记录（含收藏与错题练习）',
  }
  confirmOpen.value = true
}

function requestCollectionClear(source: CollectionSource) {
  if (!model.value || confirmOpen.value || !auth.isAuthenticated) return
  clearTarget.value = { kind: 'collection', source }
  confirmOpen.value = true
}

watch(
  () => auth.session?.token,
  () => {
    confirmOpen.value = false
    clearTarget.value = null
    model.value = false
  },
)
</script>

<template>
  <BasePopup v-model="model" title="数据清理">
    <div class="pb-[env(safe-area-inset-bottom)]">
      <section aria-label="作答记录">
        <div class="flex items-center justify-between gap-3">
          <h4 class="text-xs font-medium text-base-content/55">作答记录</h4>
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            :disabled="records.length === 0"
            aria-label="清除全部作答记录"
            @click="requestPracticeClear()"
          >
            全部清除
          </button>
        </div>
        <div class="divide-y divide-base-200">
          <div
            v-for="category in categories"
            :key="category.type"
            class="flex min-h-12 items-center justify-between gap-3"
          >
            <span class="text-sm">{{ category.label }}</span>
            <button
              class="btn btn-ghost btn-sm"
              type="button"
              :disabled="!category.hasRecords"
              :aria-label="`清除${category.label}作答记录`"
              @click="requestPracticeClear(category.type)"
            >
              清除
            </button>
          </div>
        </div>
      </section>
      <div class="mt-3 divide-y divide-base-200 border-t border-base-200 pt-3">
        <div
          v-for="collection in collections"
          :key="collection.source"
          class="flex min-h-12 items-center justify-between gap-3"
        >
          <span class="text-sm">{{ collection.label }}</span>
          <button
            class="btn btn-ghost btn-sm"
            type="button"
            :aria-label="`清空全部${collection.label}`"
            @click="requestCollectionClear(collection.source)"
          >
            清空
          </button>
        </div>
      </div>
    </div>
  </BasePopup>
  <ClearPracticeRecordsDialog
    v-if="clearTarget?.kind === 'practice'"
    v-model="confirmOpen"
    :scope="clearTarget.scope"
    :label="clearTarget.label"
    @cleared="refresh"
  />
  <ClearCollectionDialog
    v-else-if="clearTarget?.kind === 'collection'"
    :key="clearTarget.source"
    v-model="confirmOpen"
    :source="clearTarget.source"
  />
</template>
