<script setup lang="ts">
import { ref, watch } from 'vue'

import ClearCollectionDialog from '@/components/collection/ClearCollectionDialog.vue'
import BasePopup from '@/components/common/BasePopup.vue'
import ClearPracticeRecordsDialog from '@/components/practice/ClearPracticeRecordsDialog.vue'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
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
const collections: Array<{ source: CollectionSource; label: string }> = [
  { source: 'favorites', label: '收藏' },
  { source: 'mistakes', label: '错题' },
]

function requestPracticeClear() {
  const userId = auth.session?.user.id
  if (!model.value || confirmOpen.value || !auth.isAuthenticated || !userId) return
  clearTarget.value = {
    kind: 'practice',
    scope: { kind: 'all', userId },
    label: '当前账号在本机保存的全部作答记录（含收藏与错题练习）',
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
    <div class="space-y-3.5">
      <section aria-label="作答记录">
        <h4 class="mb-2 px-0.5 text-xs font-medium text-base-content/55">作答记录</h4>
        <div class="grid gap-2">
          <div
            class="flex items-center justify-between gap-3 rounded-2xl bg-base-200/65 px-3.5 py-2.5 dark:bg-base-300/45"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium leading-snug text-base-content"
                >本地作答记录</span
              >
              <span class="mt-0.5 block text-xs leading-snug text-base-content/55">
                {{ records.length > 0 ? `当前共 ${records.length} 份` : '暂无本地作答记录' }}
              </span>
            </span>
            <button
              class="flex h-8 shrink-0 items-center rounded-xl bg-base-100 px-3 text-xs font-medium text-base-content/70 transition-colors active:bg-base-200/60 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-40 dark:bg-base-200 dark:active:bg-base-300/60"
              type="button"
              :disabled="records.length === 0"
              aria-label="清除全部作答记录"
              @click="requestPracticeClear()"
            >
              清除
            </button>
          </div>
        </div>
      </section>
      <section aria-label="收藏与错题">
        <h4 class="mb-2 px-0.5 text-xs font-medium text-base-content/55">收藏与错题</h4>
        <div class="grid gap-2">
          <div
            v-for="collection in collections"
            :key="collection.source"
            class="flex items-center justify-between gap-3 rounded-2xl bg-base-200/65 px-3.5 py-2.5 dark:bg-base-300/45"
          >
            <span class="text-sm font-medium leading-snug text-base-content">{{
              collection.label
            }}</span>
            <button
              class="flex h-8 shrink-0 items-center rounded-xl bg-error/10 px-3 text-xs font-medium text-error transition-colors active:bg-error/15 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary disabled:opacity-40"
              type="button"
              :aria-label="`清空全部${collection.label}`"
              @click="requestCollectionClear(collection.source)"
            >
              清空
            </button>
          </div>
        </div>
      </section>
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
