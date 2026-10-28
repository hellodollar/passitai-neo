<script setup lang="ts">
import { KeyRound, Lock, ShieldCheck } from '@lucide/vue'
import { reactive, ref, useId, watch } from 'vue'
import { useRouter } from 'vue-router'

import FormField from '@/components/common/FormField.vue'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { showSuccessToast } from '@/utils/toast'
import { PASSWORD_PATTERN } from '@/utils/auth/validation'
import { useAuthStore } from '@/stores/auth'

const model = defineModel<boolean>({ default: false })
const auth = useAuthStore()
const router = useRouter()
const formId = useId()

const form = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const errors = reactive({
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const submitting = ref(false)

function validateCurrentPassword() {
  errors.currentPassword = form.currentPassword ? '' : '请输入当前密码'
  return !errors.currentPassword
}

function validateNewPassword() {
  if (!form.newPassword) errors.newPassword = '请输入新密码'
  else if (!PASSWORD_PATTERN.test(form.newPassword))
    errors.newPassword = '密码需为 6-20 位，且包含字母和数字'
  else errors.newPassword = ''
  return !errors.newPassword
}

function validateConfirmPassword() {
  if (!form.confirmPassword) errors.confirmPassword = '请再次输入新密码'
  else if (form.confirmPassword !== form.newPassword)
    errors.confirmPassword = '两次输入的密码不一致'
  else errors.confirmPassword = ''
  return !errors.confirmPassword
}

const validators = {
  currentPassword: validateCurrentPassword,
  newPassword: validateNewPassword,
  confirmPassword: validateConfirmPassword,
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
  form.currentPassword = ''
  form.newPassword = ''
  form.confirmPassword = ''
  errors.currentPassword = ''
  errors.newPassword = ''
  errors.confirmPassword = ''
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
    await auth.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    })
    // 接口失败时错误提示由请求层统一弹出，弹框保持打开
    showSuccessToast('密码已修改，请重新登录')
    model.value = false
    await router.replace({ name: 'login' })
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
    title="修改密码"
    :close-on-backdrop="!submitting"
    :close-on-escape="!submitting"
  >
    <form :id="formId" novalidate @submit.prevent="submit">
      <fieldset class="grid gap-2" :disabled="submitting">
        <FormField
          v-model="form.currentPassword"
          label="当前密码"
          :icon="Lock"
          :error="errors.currentPassword"
          type="password"
          autocomplete="current-password"
          placeholder="输入当前密码"
          @blur="validateCurrentPassword"
        />

        <FormField
          v-model="form.newPassword"
          label="新密码"
          :icon="KeyRound"
          :error="errors.newPassword"
          type="password"
          autocomplete="new-password"
          placeholder="6-20 位，包含字母和数字"
          @blur="validateNewPassword"
        />

        <FormField
          v-model="form.confirmPassword"
          label="确认新密码"
          :icon="ShieldCheck"
          :error="errors.confirmPassword"
          type="password"
          autocomplete="new-password"
          placeholder="再次输入新密码"
          @blur="validateConfirmPassword"
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
