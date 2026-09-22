<script setup lang="ts">
import { Mail, ShieldCheck } from '@lucide/vue'
import { reactive, ref, watch } from 'vue'

import AuthField from '@/components/auth/AuthField.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { changeEmail } from '@/api/profile'
import { showSuccessToast } from '@/utils/toast'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    currentEmail?: string
  }>(),
  {
    currentEmail: '',
  },
)

const emit = defineEmits<{
  updated: [email: string]
}>()

const form = reactive({
  password: '',
  newEmail: '',
})

const errors = reactive({
  password: '',
  newEmail: '',
})

const submitting = ref(false)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validatePassword() {
  errors.password = form.password ? '' : '请输入当前密码'
  return !errors.password
}

function validateNewEmail() {
  const value = form.newEmail.trim()
  if (!value) errors.newEmail = '请输入新邮箱'
  else if (!EMAIL_PATTERN.test(value)) errors.newEmail = '邮箱格式不正确，请检查后重试'
  else if (value === props.currentEmail) errors.newEmail = '新邮箱与当前邮箱相同'
  else errors.newEmail = ''
  return !errors.newEmail
}

const validators = {
  password: validatePassword,
  newEmail: validateNewEmail,
} as const

// 首次提交前只做失焦校验；提交失败后进入实时校验，改对了错误立即消失
let submitted = false

watch(
  () => ({ ...form }),
  () => {
    if (!submitted) return
    for (const key of Object.keys(errors) as Array<keyof typeof errors>) {
      if (errors[key]) validators[key]()
    }
  },
)

watch(model, (open) => {
  if (!open) return
  form.password = ''
  form.newEmail = ''
  errors.password = ''
  errors.newEmail = ''
  submitted = false
})

async function submit() {
  submitted = true
  const valid = Object.values(validators).map((validate) => validate()).every(Boolean)
  if (!valid || submitting.value) return

  submitting.value = true
  try {
    const result = await changeEmail({
      password: form.password,
      newEmail: form.newEmail.trim(),
    })
    // 接口失败时错误提示由请求层统一弹出，弹框保持打开
    showSuccessToast('邮箱已更新')
    emit('updated', result.email)
    model.value = false
  } catch {
    return
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal v-model="model" title="更换邮箱" compact-footer>
    <form class="grid gap-2" novalidate @submit.prevent="submit">
      <div class="flex items-center gap-2.5 rounded-2xl bg-base-200/70 px-4 py-3">
        <Mail :size="17" class="shrink-0 text-base-content/35" />
        <span class="min-w-0">
          <span class="block text-xs text-base-content/50">当前邮箱</span>
          <span class="mt-0.5 block truncate text-sm font-medium">{{ currentEmail || '—' }}</span>
        </span>
      </div>

      <AuthField
        v-model="form.password"
        label="当前密码"
        :icon="ShieldCheck"
        :error="errors.password"
        type="password"
        autocomplete="current-password"
        placeholder="验证身份"
        @blur="validatePassword"
      />

      <AuthField
        v-model="form.newEmail"
        label="新邮箱"
        :icon="Mail"
        :error="errors.newEmail"
        inputmode="email"
        autocomplete="email"
        placeholder="new@example.com"
        @blur="validateNewEmail"
      />
    </form>

    <template #footer>
      <button
        class="btn btn-primary h-8 min-h-8 flex-1 rounded-lg text-sm"
        type="button"
        :disabled="submitting"
        @click="submit"
      >
        <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
        保存新邮箱
      </button>
    </template>
  </BaseModal>
</template>
