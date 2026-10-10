<script setup lang="ts">
import BaseDialog from '@/components/common/BaseDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { PracticeRecordClearScope } from '@/types'
import { clearPracticeRecords } from '@/utils/practice-record'
import { showErrorToast, showSuccessToast } from '@/utils/toast'

const model = defineModel<boolean>({ default: false })
const props = defineProps<{ scope: PracticeRecordClearScope | null; label: string }>()
const emit = defineEmits<{ cleared: [] }>()
const auth = useAuthStore()

function confirmClear() {
  const scope = props.scope
  if (!scope) return
  const userId = scope.kind === 'paper' ? scope.identity.userId : scope.userId
  if (auth.session?.user.id !== userId) {
    model.value = false
    return
  }
  if (!clearPracticeRecords(scope)) {
    showErrorToast('本地记录清除失败，请检查浏览器存储后重试。')
    return
  }
  model.value = false
  showSuccessToast('做题记录已清除')
  emit('cleared')
}
</script>

<template>
  <BaseDialog v-model="model" title="清除做题记录">
    <p class="text-sm leading-6 text-base-content/70">
      将清除{{ label }}，操作不可恢复。不影响收藏、错题和交卷报告。
    </p>
    <template #footer>
      <button
        class="btn h-10 min-h-10 flex-1 rounded-xl border-base-200 bg-base-100 text-sm"
        type="button"
        @click="model = false"
      >
        取消
      </button>
      <button
        class="btn btn-error h-10 min-h-10 flex-1 rounded-xl text-sm"
        type="button"
        @click="confirmClear"
      >
        清除
      </button>
    </template>
  </BaseDialog>
</template>
