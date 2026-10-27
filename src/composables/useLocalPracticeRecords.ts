import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { useAuthStore } from '@/stores/auth'
import type { PracticeRecord } from '@/types'
import { listPracticeRecords } from '@/utils/practice/record'
import { subscribePracticeRecordChanges } from '@/utils/practice/record-control'

export function useLocalPracticeRecords() {
  const auth = useAuthStore()
  const records = ref<PracticeRecord[]>([])
  let unsubscribe = () => {}

  function refresh() {
    const userId = auth.session?.user.id
    records.value = userId ? listPracticeRecords(userId) : []
  }

  watch(() => auth.session?.user.id, refresh, { immediate: true })
  onMounted(() => {
    unsubscribe = subscribePracticeRecordChanges(refresh)
  })
  onBeforeUnmount(() => unsubscribe())
  return { records, refresh }
}
