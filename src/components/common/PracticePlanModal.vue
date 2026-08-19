<script setup lang="ts">
import { Check } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import type { Major, Subject, SubjectSelection } from '@/types/domain'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    majorId?: string
    subjectIds?: string[]
    majors?: Major[]
    subjects?: Subject[]
    title?: string
  }>(),
  {
    majorId: '',
    subjectIds: () => [],
    majors: () => [],
    subjects: () => [],
    title: '刷题计划设置',
  },
)

const emit = defineEmits<{
  apply: [selection: SubjectSelection]
}>()

const tempMajorId = ref('')
const tempSubjectIds = ref<Set<string>>(new Set())

const subjectsOfMajor = computed(() =>
  props.subjects.filter((subject) => subject.majorId === tempMajorId.value),
)

function syncDraft() {
  tempMajorId.value = props.majorId
  tempSubjectIds.value = new Set(props.subjectIds)
}

function selectMajor(majorId: string) {
  tempMajorId.value = majorId
  tempSubjectIds.value = new Set()
}

function toggleSubject(subjectId: string) {
  const nextIds = new Set(tempSubjectIds.value)
  if (nextIds.has(subjectId)) {
    nextIds.delete(subjectId)
  } else {
    nextIds.add(subjectId)
  }
  tempSubjectIds.value = nextIds
}

function applySelection() {
  emit('apply', {
    majorId: tempMajorId.value,
    subjectIds: [...tempSubjectIds.value],
  })
  model.value = false
}

watch(model, (open) => {
  if (open) syncDraft()
})
</script>

<template>
  <BaseModal v-model="model" :title="title">
    <div>
      <p class="mb-1.5 text-xs font-medium text-base-content/50">专业</p>
      <select
        class="select select-bordered h-10 w-full rounded-2xl text-sm"
        :value="tempMajorId"
        @change="selectMajor(($event.target as HTMLSelectElement).value)"
      >
        <option value="">请选择专业</option>
        <option v-for="major in props.majors" :key="major.id" :value="major.id">
          {{ major.name }}
        </option>
      </select>
    </div>

    <div class="mt-4">
      <p class="mb-1.5 text-xs font-medium text-base-content/50">刷题科目</p>
      <div class="max-h-72 overflow-y-auto rounded-2xl bg-base-200/70">
        <label
          v-for="subject in subjectsOfMajor"
          :key="subject.id"
          class="flex cursor-pointer items-center gap-3 border-b border-base-200 p-3 last:border-b-0 hover:bg-base-200"
          :class="{ 'bg-primary/5': tempSubjectIds.has(subject.id) }"
        >
          <input
            type="checkbox"
            class="checkbox checkbox-sm checkbox-primary"
            :checked="tempSubjectIds.has(subject.id)"
            @change="toggleSubject(subject.id)"
          />
          <span class="flex-1 text-sm">{{ subject.name }}</span>
          <Check v-if="tempSubjectIds.has(subject.id)" :size="16" class="text-primary" />
        </label>
        <div v-if="tempMajorId === ''" class="p-4 text-center text-sm text-base-content/50">
          请先选择专业
        </div>
        <div v-else-if="subjectsOfMajor.length === 0" class="p-4 text-center text-sm text-base-content/50">
          该专业暂无科目
        </div>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-primary btn-sm flex-1 rounded-full" type="button" @click="applySelection">
        确定
      </button>
    </template>
  </BaseModal>
</template>
