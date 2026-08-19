<script setup lang="ts">
import { Check, ChevronDown, GraduationCap } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import { fetchMajors, fetchSubjects } from '@/api/catalog'
import { useAppStore } from '@/stores/app'
import type { Major, Subject } from '@/types/domain'

const props = withDefaults(
  defineProps<{
    variant?: 'default' | 'inverse' | 'sync'
  }>(),
  {
    variant: 'default',
  },
)

const app = useAppStore()

const majors = ref<Major[]>([])
const subjects = ref<Subject[]>([])
const subjectsByMajor = ref<Subject[]>([])
const selectedSubjectIds = ref<Set<string>>(new Set(app.subjectSelection.subjectIds))
const selectedMajorId = ref(app.subjectSelection.majorId)
const modalOpen = ref(false)
const loading = ref(false)

const triggerClasses = computed(() => {
  if (props.variant === 'sync') {
    return 'box-border h-11 min-h-11 w-full max-w-full justify-center overflow-hidden border-0 bg-primary px-4 text-sm font-semibold text-primary-content shadow-none hover:bg-primary/90'
  }

  if (props.variant === 'inverse') {
    return 'h-10 min-h-10 border-0 bg-primary-content px-4 text-primary hover:bg-primary-content/90'
  }

  return app.hasSubjectSelection ? 'btn-primary' : 'bg-base-100'
})

async function loadCatalog() {
  loading.value = true
  try {
    majors.value = await fetchMajors()
    subjects.value = await fetchSubjects()
    syncSubjectsByMajor()
  } catch {
    // fallback to empty
  } finally {
    loading.value = false
  }
}

function syncSubjectsByMajor() {
  if (selectedMajorId.value) {
    subjectsByMajor.value = subjects.value.filter((s) => s.majorId === selectedMajorId.value)
  } else {
    subjectsByMajor.value = subjects.value
  }
}

function selectMajor(majorId: string) {
  selectedMajorId.value = majorId
  selectedSubjectIds.value = new Set()
  syncSubjectsByMajor()
}

function toggleSubject(subjectId: string) {
  if (selectedSubjectIds.value.has(subjectId)) {
    selectedSubjectIds.value.delete(subjectId)
  } else {
    selectedSubjectIds.value.add(subjectId)
  }
}

function openModal() {
  selectedSubjectIds.value = new Set(app.subjectSelection.subjectIds)
  selectedMajorId.value = app.subjectSelection.majorId
  syncSubjectsByMajor()
  modalOpen.value = true
}

function applySelection() {
  app.setSubjectSelection({
    majorId: selectedMajorId.value,
    subjectIds: [...selectedSubjectIds.value],
  })
  modalOpen.value = false
}

function clearSelection() {
  selectedSubjectIds.value = new Set()
  selectedMajorId.value = ''
  subjectsByMajor.value = subjects.value
  app.setSubjectSelection({ majorId: '', subjectIds: [] })
  modalOpen.value = false
}

onMounted(() => {
  loadCatalog()
})
</script>

<template>
  <!-- Trigger -->
  <button
    class="btn btn-sm min-w-0 gap-2 rounded-full"
    :class="triggerClasses"
    type="button"
    aria-haspopup="dialog"
    @click="openModal"
  >
    <GraduationCap :size="16" />
    <span class="min-w-0 max-w-36 truncate sm:max-w-40">
      {{
        app.hasSubjectSelection
          ? `${app.subjectSelection.subjectIds.length} 个科目`
          : '选择专业科目'
      }}
    </span>
    <ChevronDown :size="14" />
  </button>

  <!-- Modal -->
  <BaseModal v-model="modalOpen" title="专业 & 科目">
    <div v-if="loading" class="py-12 text-center">
      <span class="loading loading-spinner loading-sm"></span>
    </div>

    <template v-else>
      <div>
        <p class="mb-1.5 text-xs font-medium text-base-content/50">专业</p>
        <select
          class="select select-bordered h-10 w-full rounded-2xl text-sm"
          :value="selectedMajorId"
          @change="selectMajor(($event.target as HTMLSelectElement).value)"
        >
          <option value="">全部专业</option>
          <option v-for="major in majors" :key="major.id" :value="major.id">
            {{ major.name }}
          </option>
        </select>
      </div>

      <div class="mt-4">
        <p class="mb-1.5 text-xs font-medium text-base-content/50">科目（可多选）</p>
        <div class="max-h-72 overflow-y-auto rounded-2xl bg-base-200/70">
          <label
            v-for="subject in subjectsByMajor"
            :key="subject.id"
            class="flex cursor-pointer items-center gap-3 border-b border-base-200 p-3 last:border-b-0 hover:bg-base-200"
            :class="{ 'bg-primary/5': selectedSubjectIds.has(subject.id) }"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-sm checkbox-primary"
              :checked="selectedSubjectIds.has(subject.id)"
              @change="toggleSubject(subject.id)"
            />
            <span class="flex-1 text-sm">{{ subject.name }}</span>
            <Check v-if="selectedSubjectIds.has(subject.id)" :size="16" class="text-primary" />
          </label>
          <div
            v-if="subjectsByMajor.length === 0"
            class="p-4 text-center text-sm text-base-content/50"
          >
            暂无科目
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <button class="btn btn-ghost btn-sm flex-1 rounded-full" @click="clearSelection">清空</button>
      <button class="btn btn-primary btn-sm flex-1 rounded-full" @click="applySelection">确定</button>
    </template>
  </BaseModal>
</template>
