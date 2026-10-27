<script setup lang="ts">
import { ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import { fetchMajorOptions, fetchSubjectOptions } from '@/api/options'
import { usePracticePlanStore } from '@/stores/practice-plan'
import { useAuthStore } from '@/stores/auth'
import { showSuccessToast } from '@/utils/toast'
import type { OptionItem } from '@/types'

const model = defineModel<boolean>({ default: false })

const practicePlanStore = usePracticePlanStore()
const auth = useAuthStore()
let loadSequence = 0
let subjectSequence = 0

const majorOptions = ref<OptionItem[]>([])
const subjectOptions = ref<OptionItem[]>([])
const displaySubjects = ref<OptionItem[]>([])
const draftMajorId = ref('')
const draftSubjectIds = ref<Set<string>>(new Set())
const subjectOptionsLoading = ref(false)
const saving = ref(false)

let majorOptionsLoaded = false

async function loadMajorOptions() {
  if (majorOptionsLoaded) return
  try {
    majorOptions.value = await fetchMajorOptions()
    majorOptionsLoaded = true
  } catch {
    majorOptions.value = []
  }
}

async function loadSubjectOptions(majorId: string) {
  if (!majorId) {
    subjectOptions.value = []
    displaySubjects.value = []
    return
  }
  const sequence = ++subjectSequence
  const token = auth.session?.token
  subjectOptionsLoading.value = true
  try {
    const next = await fetchSubjectOptions(majorId)
    if (sequence === subjectSequence && token === auth.session?.token) subjectOptions.value = next
  } catch {
    if (sequence === subjectSequence && token === auth.session?.token) subjectOptions.value = []
  } finally {
    if (sequence === subjectSequence && token === auth.session?.token)
      subjectOptionsLoading.value = false
  }
}

function applySelectedFirst() {
  displaySubjects.value = [
    ...subjectOptions.value.filter((subject) => draftSubjectIds.value.has(subject.id)),
    ...subjectOptions.value.filter((subject) => !draftSubjectIds.value.has(subject.id)),
  ]
}

async function syncDraft() {
  const sequence = ++loadSequence
  const token = auth.session?.token
  draftMajorId.value = ''
  draftSubjectIds.value = new Set()
  subjectOptions.value = []
  displaySubjects.value = []

  await Promise.all([loadMajorOptions(), practicePlanStore.load()])
  if (sequence !== loadSequence || token !== auth.session?.token || !model.value) return
  if (practicePlanStore.error) return
  draftMajorId.value = practicePlanStore.plan?.majorId ?? ''

  if (!draftMajorId.value) return

  await loadSubjectOptions(draftMajorId.value)
  if (sequence !== loadSequence || token !== auth.session?.token || !model.value) return

  const subjectIds = new Set(practicePlanStore.plan?.subjects.map((subject) => subject.id) ?? [])
  draftSubjectIds.value = new Set(
    subjectOptions.value.filter((option) => subjectIds.has(option.id)).map((option) => option.id),
  )
  applySelectedFirst()
}

async function onMajorSelect(event: Event) {
  draftMajorId.value = (event.target as HTMLSelectElement).value
  draftSubjectIds.value = new Set()
  await loadSubjectOptions(draftMajorId.value)
  applySelectedFirst()
}

function toggleSubject(id: string) {
  const next = new Set(draftSubjectIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  draftSubjectIds.value = next
}

async function save() {
  if (!draftMajorId.value || saving.value) return
  saving.value = true
  try {
    await practicePlanStore.save({
      majorId: draftMajorId.value,
      subjectIds: [...draftSubjectIds.value],
    })
    // 接口失败时错误提示由请求层统一弹出，弹框保持打开
    showSuccessToast('刷题计划已更新')
    model.value = false
  } catch {
    // keep modal open on failure
  } finally {
    saving.value = false
  }
}

watch(model, (open) => {
  if (open) void syncDraft()
  else {
    loadSequence++
    subjectSequence++
  }
})
watch(
  () => auth.session?.token,
  () => {
    model.value = false
    loadSequence++
    subjectSequence++
    draftMajorId.value = ''
    draftSubjectIds.value = new Set()
    subjectOptions.value = []
    displaySubjects.value = []
    subjectOptionsLoading.value = false
  },
)
</script>

<template>
  <BaseModal v-model="model" title="刷题计划" compact-footer>
    <div>
      <div v-if="practicePlanStore.error" class="mb-4 text-center text-sm text-error">
        <p>刷题计划加载失败</p>
        <button type="button" class="btn btn-ghost btn-sm mt-1" @click="syncDraft">重试</button>
      </div>
      <section class="border-b border-base-200 px-0.5 pb-4">
        <div>
          <p class="text-sm font-medium">报考专业</p>
          <p class="mt-0.5 text-xs text-base-content/50">选择后可配置对应的刷题科目</p>
        </div>

        <select
          class="select mt-3 h-10 min-h-10 w-full rounded-xl border border-base-300 bg-base-100 text-sm focus:border-primary focus:outline-none"
          :value="draftMajorId"
          @change="onMajorSelect"
        >
          <option value="">请选择报考专业</option>
          <option v-for="major in majorOptions" :key="major.id" :value="major.id">
            {{ major.name }}
          </option>
        </select>
      </section>

      <section class="px-0.5 pt-4">
        <div>
          <p class="text-sm font-medium">刷题科目</p>
          <p class="mt-0.5 text-xs text-base-content/50">选择刷题页需要展示的科目</p>
        </div>

        <div class="mt-3 min-h-36 overflow-hidden rounded-xl border border-base-200">
          <div v-if="subjectOptionsLoading" class="flex min-h-36 items-center justify-center">
            <span class="loading loading-spinner loading-sm"></span>
          </div>
          <template v-else>
            <div v-if="displaySubjects.length > 0" class="divide-y divide-base-200">
              <label
                v-for="subject in displaySubjects"
                :key="subject.id"
                class="flex min-h-11 cursor-pointer items-center gap-2.5 px-3 py-2.5 transition-colors active:bg-base-200"
              >
                <input
                  type="checkbox"
                  class="checkbox checkbox-xs checkbox-primary"
                  :checked="draftSubjectIds.has(subject.id)"
                  @change="toggleSubject(subject.id)"
                />
                <span class="flex-1 text-sm">{{ subject.name }}</span>
                <span class="text-xs text-base-content/40">{{ subject.code }}</span>
              </label>
            </div>
            <div
              v-if="!draftMajorId"
              class="flex min-h-36 items-center justify-center px-5 text-center text-sm text-base-content/50"
            >
              请先选择报考专业
            </div>
            <div
              v-else-if="subjectOptions.length === 0"
              class="flex min-h-36 items-center justify-center px-5 text-center text-sm text-base-content/50"
            >
              该专业暂无科目
            </div>
          </template>
        </div>
      </section>
    </div>

    <template #footer>
      <button
        class="btn btn-ghost h-8 min-h-8 rounded-lg px-3 text-sm"
        type="button"
        @click="model = false"
      >
        取消
      </button>
      <button
        class="btn btn-primary h-8 min-h-8 rounded-lg px-4 text-sm"
        type="button"
        :disabled="
          saving ||
          !draftMajorId ||
          Boolean(practicePlanStore.error) ||
          practicePlanStore.isLoading ||
          subjectOptionsLoading
        "
        @click="save"
      >
        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
        保存
      </button>
    </template>
  </BaseModal>
</template>
