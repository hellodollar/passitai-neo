import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'
import type { PracticeRecord } from '@/types'
import { countLegacyPracticeRecords, listPracticeRecords } from '@/utils/practice-record'
import { subscribePracticeRecordChanges } from '@/utils/practice-record-control'

export function useLocalPracticeRecords() {
  const auth = useAuthStore()
  const records = ref<PracticeRecord[]>([])
  const legacyCount = ref(0)
  let unsubscribe = () => {}

  function refresh() {
    const userId = auth.session?.user.id
    records.value = userId ? listPracticeRecords(userId) : []
    legacyCount.value = userId ? countLegacyPracticeRecords(userId) : 0
  }

  watch(() => auth.session?.user.id, refresh, { immediate: true })
  onMounted(() => {
    unsubscribe = subscribePracticeRecordChanges(refresh)
  })
  onBeforeUnmount(() => unsubscribe())
  return { records, legacyCount, refresh }
}
