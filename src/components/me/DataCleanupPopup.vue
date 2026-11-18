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
    <div class="space-y-3 pb-[env(safe-area-inset-bottom)]">
      <section aria-label="作答记录">
        <h4 class="mb-1 px-3 text-xs font-medium text-base-content/55">作答记录</h4>
        <div class="rounded-lg bg-base-200/40">
          <div class="flex h-11 items-center justify-between gap-3 px-3">
            <span class="text-sm">本地作答记录</span>
            <button
              class="flex h-11 items-center rounded-md px-2 text-xs font-normal text-base-content/60 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary active:bg-base-300/40 disabled:opacity-35"
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
        <h4 class="mb-1 px-3 text-xs font-medium text-base-content/55">收藏与错题</h4>
        <div class="rounded-lg bg-base-200/40">
          <div
            v-for="collection in collections"
            :key="collection.source"
            class="flex h-11 items-center justify-between gap-3 px-3"
          >
            <span class="text-sm">{{ collection.label }}</span>
            <button
              class="flex h-11 items-center rounded-md px-2 text-xs font-normal text-error transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary active:bg-error/5 disabled:opacity-35"
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
