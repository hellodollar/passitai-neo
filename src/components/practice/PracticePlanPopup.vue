<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { fetchMajorOptions, fetchSubjectOptions } from '@/api/options'
import BasePopup from '@/components/common/BasePopup.vue'
import OptionSheet from '@/components/common/OptionSheet.vue'
import {
  openedProvinceOptions,
  type DomainValue,
  type ProvinceCode,
} from '@/generated/domain-values'
import { useAuthStore } from '@/stores/auth'
import { usePracticePlanStore } from '@/stores/practice-plan'
import type { OptionItem } from '@/types'
import { showSuccessToast } from '@/utils/toast'

const model = defineModel<boolean>({ default: false })
const auth = useAuthStore()
const practicePlanStore = usePracticePlanStore()
const majorOptions = ref<OptionItem[]>([])
const subjectOptions = ref<OptionItem[]>([])
const draftProvinceCode = ref<ProvinceCode | ''>('')
const draftEducationLevel = ref<DomainValue<'educationLevel'>>('本科')
const draftMajorId = ref('')
const draftSubjectIds = ref(new Set<string>())
const loading = ref(false)
const subjectOptionsLoading = ref(false)
const majorOptionsLoading = ref(false)
const majorOptionsError = ref(false)
const subjectOptionsError = ref(false)
const saving = ref(false)
/** 专业选项缓存键:省份+学历任一变化都重新拉取 */
let loadedMajorScope = ''
let majorSequence = 0
let loadSequence = 0
let subjectSequence = 0
let saveSequence = 0

/** 省份选项静态,OptionSheet 直接消费 */
const PROVINCE_FIELD_OPTIONS = openedProvinceOptions.map((province) => ({
  value: province.code,
  label: province.name,
}))

/** 学历层次固定两档,与 api 的 educationLevel 枚举一致 */
const EDUCATION_LEVELS = ['本科', '专科'] as const satisfies readonly DomainValue<'educationLevel'>[]

const majorFieldOptions = computed(() =>
  majorOptions.value.map((major) => ({ value: major.id, label: major.name })),
)

const canSave = computed(
  () =>
    Boolean(draftProvinceCode.value) &&
    Boolean(draftMajorId.value) &&
    !loading.value &&
    !saving.value &&
    !subjectOptionsLoading.value &&
    !majorOptionsLoading.value &&
    !majorOptionsError.value &&
    !subjectOptionsError.value &&
    !practicePlanStore.error,
)

async function loadMajorOptions(sequence: number, token: string | undefined) {
  const version = ++majorSequence
  const provinceCode = draftProvinceCode.value
  const educationLevel = draftEducationLevel.value
  const scope = `${provinceCode}|${educationLevel}`
  majorOptionsError.value = false
  if (!provinceCode) {
    majorOptions.value = []
    loadedMajorScope = ''
    majorOptionsLoading.value = false
    return
  }
  if (loadedMajorScope === scope) {
    majorOptionsLoading.value = false
    return
  }
  majorOptionsLoading.value = true
  majorOptions.value = []
  loadedMajorScope = ''
  try {
    const options = await fetchMajorOptions({ provinceCode, educationLevel })
    if (
      sequence !== loadSequence ||
      version !== majorSequence ||
      token !== auth.session?.token ||
      !model.value
    )
      return
    majorOptions.value = options
    loadedMajorScope = scope
  } catch {
    if (
      sequence === loadSequence &&
      version === majorSequence &&
      token === auth.session?.token &&
      model.value
    ) {
      majorOptions.value = []
      majorOptionsError.value = true
    }
  } finally {
    if (version === majorSequence) majorOptionsLoading.value = false
  }
}

async function loadSubjectOptions(majorId: string) {
  // 清空选择也必须使上一专业的请求失效。
  const sequence = ++subjectSequence
  const token = auth.session?.token
  const isCurrent = () =>
    sequence === subjectSequence && token === auth.session?.token && model.value
  subjectOptions.value = []
  subjectOptionsError.value = false
  subjectOptionsLoading.value = Boolean(majorId)
  if (!majorId) return
  try {
    const options = await fetchSubjectOptions(majorId, draftProvinceCode.value || undefined)
    if (!isCurrent()) return
    draftSubjectIds.value = new Set(
      options.filter((option) => draftSubjectIds.value.has(option.id)).map((option) => option.id),
    )
    subjectOptions.value = [
      ...options.filter((option) => draftSubjectIds.value.has(option.id)),
      ...options.filter((option) => !draftSubjectIds.value.has(option.id)),
    ]
  } catch {
    if (isCurrent()) subjectOptionsError.value = true
  } finally {
    if (isCurrent()) subjectOptionsLoading.value = false
  }
}

async function loadDraft() {
  const sequence = ++loadSequence
  const token = auth.session?.token
  const isCurrent = () => sequence === loadSequence && token === auth.session?.token && model.value
  ++subjectSequence
  loading.value = true
  majorOptionsError.value = false
  subjectOptionsError.value = false
  subjectOptionsLoading.value = false
  draftProvinceCode.value = ''
  draftEducationLevel.value = '本科'
  draftMajorId.value = ''
  draftSubjectIds.value = new Set()
  subjectOptions.value = []
  try {
    await practicePlanStore.load()
    if (!isCurrent() || practicePlanStore.error || majorOptionsError.value) return
    const plan = practicePlanStore.plan
    draftProvinceCode.value = plan?.provinceCode ?? ''
    draftEducationLevel.value = plan?.educationLevel ?? '本科'
    await loadMajorOptions(sequence, token)
    if (!isCurrent() || majorOptionsError.value) return
    draftMajorId.value = majorOptions.value.some((option) => option.id === plan?.majorId)
      ? plan!.majorId
      : ''
    draftSubjectIds.value = new Set(plan?.subjects.map((subject) => subject.id) ?? [])
    await loadSubjectOptions(draftMajorId.value)
  } finally {
    if (isCurrent()) loading.value = false
  }
}

async function selectProvince(code: string) {
  if (loading.value || saving.value) return
  draftProvinceCode.value = (code || '') as ProvinceCode | ''
  draftMajorId.value = ''
  draftSubjectIds.value = new Set()
  majorOptions.value = []
  loadedMajorScope = ''
  majorOptionsError.value = false
  await Promise.all([loadSubjectOptions(''), loadMajorOptions(loadSequence, auth.session?.token)])
}

/** 切换学历会更换专业候选,等价于换省:清空已选专业与科目后重拉 */
async function selectEducationLevel(level: DomainValue<'educationLevel'>) {
  if (loading.value || saving.value || draftEducationLevel.value === level) return
  draftEducationLevel.value = level
  draftMajorId.value = ''
  draftSubjectIds.value = new Set()
  majorOptions.value = []
  loadedMajorScope = ''
  majorOptionsError.value = false
  await Promise.all([loadSubjectOptions(''), loadMajorOptions(loadSequence, auth.session?.token)])
}

async function selectMajor(majorId: string) {
  if (loading.value || saving.value) return
  draftMajorId.value = majorId
  draftSubjectIds.value = new Set()
  await loadSubjectOptions(draftMajorId.value)
}

function toggleSubject(id: string) {
  const selected = new Set(draftSubjectIds.value)
  if (selected.has(id)) selected.delete(id)
  else selected.add(id)
  draftSubjectIds.value = selected
}

async function savePlan() {
  if (!canSave.value || !draftProvinceCode.value) return
  const sequence = ++saveSequence
  const opening = loadSequence
  const token = auth.session?.token
  const isCurrent = () =>
    sequence === saveSequence &&
    opening === loadSequence &&
    token === auth.session?.token &&
    model.value
  saving.value = true
  try {
    await practicePlanStore.save({
      provinceCode: draftProvinceCode.value,
      educationLevel: draftEducationLevel.value,
      majorId: draftMajorId.value,
      subjectIds: [...draftSubjectIds.value],
    })
    if (!isCurrent()) return
    showSuccessToast('刷题计划已更新')
    model.value = false
  } catch {
    // 请求层提示失败，保留草稿以便重试。
  } finally {
    if (sequence === saveSequence && token === auth.session?.token) saving.value = false
  }
}

function invalidateRequests() {
  ++majorSequence
  ++loadSequence
  ++subjectSequence
  ++saveSequence
  loading.value = false
  subjectOptionsLoading.value = false
  majorOptionsLoading.value = false
  saving.value = false
}

watch(
  model,
  (open) => {
    if (open) void loadDraft()
    else invalidateRequests()
  },
  { immediate: true },
)
watch(
  () => auth.session?.token,
  () => {
    model.value = false
    invalidateRequests()
    loadedMajorScope = ''
    majorOptions.value = []
    subjectOptions.value = []
    draftProvinceCode.value = ''
    draftEducationLevel.value = '本科'
    draftMajorId.value = ''
    draftSubjectIds.value = new Set()
  },
)
onBeforeUnmount(invalidateRequests)
</script>

<template>
  <BasePopup
    v-model="model"
    title="刷题计划"
    compact-footer
    :close-on-backdrop="!saving"
    :close-on-escape="!saving"
  >
    <div>
      <div
        v-if="practicePlanStore.error || majorOptionsError"
        class="mb-4 text-center text-sm text-error"
      >
        <p>{{ majorOptionsError ? '专业加载失败' : '刷题计划加载失败' }}</p>
        <button type="button" class="btn btn-ghost btn-sm mt-1" @click="loadDraft">重试</button>
      </div>
      <fieldset :disabled="loading || saving">
        <section class="px-0.5">
          <p class="text-sm font-medium">报考省份</p>
          <OptionSheet
            v-model="draftProvinceCode"
            class="mt-2"
            title="选择报考省份"
            :placeholder="loading ? '正在加载…' : '请选择报考省份'"
            :options="PROVINCE_FIELD_OPTIONS"
            @update:model-value="selectProvince"
          />
        </section>

        <section class="px-0.5 pt-3">
          <p class="text-sm font-medium">报考学历</p>
          <div class="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="报考学历">
            <button
              v-for="level in EDUCATION_LEVELS"
              :key="level"
              class="h-10 rounded-xl border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :class="
                draftEducationLevel === level
                  ? 'border-primary/50 bg-primary/5 text-primary'
                  : 'border-base-300 text-base-content/65 active:bg-base-200/60'
              "
              type="button"
              :aria-pressed="draftEducationLevel === level"
              @click="selectEducationLevel(level)"
            >
              {{ level }}
            </button>
          </div>
        </section>

        <section class="px-0.5 pt-3">
          <p class="text-sm font-medium">报考专业</p>
          <OptionSheet
            v-model="draftMajorId"
            class="mt-2"
            title="选择报考专业"
            :placeholder="
              loading || majorOptionsLoading
                ? '正在加载…'
                : majorOptionsError
                  ? '专业加载失败'
                  : !draftProvinceCode
                    ? '请先选择报考省份'
                    : '请选择报考专业'
            "
            :disabled="majorOptionsLoading || majorOptionsError || !draftProvinceCode"
            :options="majorFieldOptions"
            @update:model-value="selectMajor"
          />
        </section>

        <section class="px-0.5 pt-3">
          <p class="text-sm font-medium">刷题科目</p>
          <div class="mt-2 min-h-36 overflow-hidden rounded-xl border border-base-200">
            <div
              v-if="loading || subjectOptionsLoading"
              class="flex min-h-36 items-center justify-center"
              role="status"
              aria-label="正在加载科目"
            >
              <span class="loading loading-spinner loading-sm"></span>
            </div>
            <div v-else-if="subjectOptionsError" class="px-5 py-8 text-center text-sm text-error">
              <p>科目加载失败</p>
              <button
                type="button"
                class="btn btn-ghost btn-sm mt-1"
                @click="loadSubjectOptions(draftMajorId)"
              >
                重试
              </button>
            </div>
            <div v-else-if="subjectOptions.length" class="divide-y divide-base-200">
              <label
                v-for="subject in subjectOptions"
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
                <span class="text-xs text-base-content/65">{{ subject.code }}</span>
              </label>
            </div>
            <div
              v-else
              class="flex min-h-36 items-center justify-center px-5 text-center text-sm text-base-content/65"
            >
              {{ draftMajorId ? '该专业暂无科目' : '请先选择报考专业' }}
            </div>
          </div>
        </section>
      </fieldset>
    </div>
    <template #footer>
      <button
        class="btn btn-ghost h-8 min-h-8 rounded-lg px-3 text-sm"
        type="button"
        :disabled="saving"
        @click="model = false"
      >
        取消
      </button>
      <button
        class="btn btn-primary h-8 min-h-8 rounded-lg px-4 text-sm"
        type="button"
        :disabled="!canSave"
        @click="savePlan"
      >
        <span v-if="saving" class="loading loading-spinner loading-xs"></span>
        {{ saving ? '保存中' : '保存' }}
      </button>
    </template>
  </BasePopup>
</template>
