<script setup lang="ts">
import { Mail, ShieldCheck } from '@lucide/vue'
import { reactive, ref, useId, watch } from 'vue'

import FormField from '@/components/common/FormField.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { showSuccessToast } from '@/utils/toast'
import { EMAIL_PATTERN } from '@/utils/auth/validation'

const model = defineModel<boolean>({ default: false })

const auth = useAuthStore()
const formId = useId()

const form = reactive({
  password: '',
  newEmail: '',
})

const errors = reactive({
  password: '',
  newEmail: '',
})

const submitting = ref(false)

function validatePassword() {
  errors.password = form.password ? '' : '请输入当前密码'
  return !errors.password
}

function validateNewEmail() {
  const value = form.newEmail.trim()
  if (!value) errors.newEmail = '请输入新邮箱'
  else if (!EMAIL_PATTERN.test(value)) errors.newEmail = '邮箱格式不正确，请检查后重试'
  else if (value === (auth.user?.email ?? '')) errors.newEmail = '新邮箱与当前邮箱相同'
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

watch(model, () => {
  form.password = ''
  form.newEmail = ''
  errors.password = ''
  errors.newEmail = ''
  submitted = false
})

async function submit() {
  submitted = true
  const valid = Object.values(validators)
    .map((validate) => validate())
    .every(Boolean)
  if (!valid || submitting.value) return

  submitting.value = true
  try {
    await auth.changeEmail({
      password: form.password,
      newEmail: form.newEmail.trim(),
    })
    // 接口失败时错误提示由请求层统一弹出，弹框保持打开
    showSuccessToast('邮箱已更新')
    model.value = false
  } catch {
    return
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseDialog
    v-model="model"
    title="更换邮箱"
    :close-on-backdrop="!submitting"
    :close-on-escape="!submitting"
  >
    <form :id="formId" class="grid gap-2" novalidate @submit.prevent="submit">
      <div class="flex items-center gap-2.5 rounded-2xl bg-base-200/70 px-4 py-3">
        <Mail :size="17" class="shrink-0 text-base-content/35" />
        <span class="min-w-0">
          <span class="block text-xs text-base-content/50">当前邮箱</span>
          <span class="mt-0.5 block truncate text-sm font-medium">{{
            auth.user?.email || '—'
          }}</span>
        </span>
      </div>

      <fieldset class="grid gap-2" :disabled="submitting">
        <FormField
          v-model="form.password"
          label="当前密码"
          :icon="ShieldCheck"
          :error="errors.password"
          type="password"
          autocomplete="current-password"
          placeholder="验证身份"
          @blur="validatePassword"
        />

        <FormField
          v-model="form.newEmail"
          label="新邮箱"
          :icon="Mail"
          :error="errors.newEmail"
          inputmode="email"
          autocomplete="email"
          placeholder="new@example.com"
          @blur="validateNewEmail"
        />
      </fieldset>
    </form>

    <template #footer>
      <button
        class="btn h-10 min-h-10 flex-1 rounded-xl border-base-200 bg-base-100 text-sm"
        type="button"
        :disabled="submitting"
        @click="model = false"
      >
        取消
      </button>
      <button
        class="btn btn-primary h-10 min-h-10 flex-1 rounded-xl text-sm"
        type="submit"
        :form="formId"
        :disabled="submitting"
      >
        <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
        {{ submitting ? '保存中' : '保存' }}
      </button>
    </template>
  </BaseDialog>
</template>
