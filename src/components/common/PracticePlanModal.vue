<script setup lang="ts">
import { Check } from '@lucide/vue'
import { ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import { fetchMajorOptions, fetchSubjectOptions } from '@/api/catalog'
import { updatePracticePlan } from '@/api/practice'
import type { OptionItem, PracticePlan } from '@/types/domain'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    plan?: PracticePlan | null
  }>(),
  {
    plan: null,
  },
)

const emit = defineEmits<{
  updated: [plan: PracticePlan, selection: { majorId: string; subjectIds: string[] }]
}>()

const majorOptions = ref<OptionItem[]>([])
const subjectOptions = ref<OptionItem[]>([])
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
    return
  }
  subjectOptionsLoading.value = true
  try {
    subjectOptions.value = await fetchSubjectOptions({ majorId })
  } catch {
    subjectOptions.value = []
  } finally {
    subjectOptionsLoading.value = false
  }
}

async function syncDraft() {
  draftMajorId.value = ''
  draftSubjectIds.value = new Set()
  subjectOptions.value = []

  await loadMajorOptions()

  const matchedMajor = majorOptions.value.find(
    (major) => major.code === props.plan?.majorCode,
  )
  draftMajorId.value = matchedMajor?.id ?? ''

  if (!draftMajorId.value) return

  await loadSubjectOptions(draftMajorId.value)

  const planCodes = new Set(props.plan?.subjects.map((subject) => subject.code) ?? [])
  draftSubjectIds.value = new Set(
    subjectOptions.value
      .filter((option) => planCodes.has(option.code))
      .map((option) => option.id),
  )
}

function onMajorSelect(event: Event) {
  draftMajorId.value = (event.target as HTMLSelectElement).value
  draftSubjectIds.value = new Set()
  void loadSubjectOptions(draftMajorId.value)
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
    const major = majorOptions.value.find((item) => item.id === draftMajorId.value)
    const updated = await updatePracticePlan({
      majorId: draftMajorId.value,
      majorCode: major?.code,
      subjectIds: [...draftSubjectIds.value],
    })
    emit('updated', updated, {
      majorId: draftMajorId.value,
      subjectIds: [...draftSubjectIds.value],
    })
    model.value = false
  } catch {
    // keep modal open on failure
  } finally {
    saving.value = false
  }
}

watch(model, (open) => {
  if (open) void syncDraft()
})
</script>

<template>
  <BaseModal v-model="model">
    <div>
      <p class="mb-1.5 text-xs font-medium text-base-content/50">专业</p>
      <select
        class="select select-bordered h-10 w-full rounded-2xl text-sm"
        :value="draftMajorId"
        @change="onMajorSelect"
      >
        <option value="">请选择专业</option>
        <option v-for="major in majorOptions" :key="major.id" :value="major.id">
          {{ major.name }}
        </option>
      </select>
    </div>

    <div class="mt-4">
      <p class="mb-1.5 text-xs font-medium text-base-content/50">刷题科目</p>
      <div class="max-h-72 overflow-y-auto rounded-2xl bg-base-200/70">
        <div v-if="subjectOptionsLoading" class="flex items-center justify-center p-6">
          <span class="loading loading-spinner loading-sm"></span>
        </div>
        <template v-else>
          <label
            v-for="subject in subjectOptions"
            :key="subject.id"
            class="flex cursor-pointer items-center gap-3 border-b border-base-200 p-3 last:border-b-0 hover:bg-base-200"
            :class="{ 'bg-primary/5': draftSubjectIds.has(subject.id) }"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-sm checkbox-primary"
              :checked="draftSubjectIds.has(subject.id)"
              @change="toggleSubject(subject.id)"
            />
            <span class="flex-1 text-sm">{{ subject.name }}</span>
            <span class="text-xs text-base-content/40">{{ subject.code }}</span>
            <Check v-if="draftSubjectIds.has(subject.id)" :size="16" class="text-primary" />
          </label>
          <div v-if="!draftMajorId" class="p-4 text-center text-sm text-base-content/50">
            请先选择专业
          </div>
          <div
            v-else-if="subjectOptions.length === 0"
            class="p-4 text-center text-sm text-base-content/50"
          >
            该专业暂无科目
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <button
        class="btn btn-ghost btn-sm flex-1 rounded-full"
        type="button"
        @click="model = false"
      >
        取消
      </button>
      <button
        class="btn btn-primary btn-sm flex-1 rounded-full"
        type="button"
        :disabled="saving || !draftMajorId"
        @click="save"
      >
        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
        保存
      </button>
    </template>
  </BaseModal>
</template>
