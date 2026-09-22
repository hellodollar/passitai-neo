<script setup lang="ts">
import { KeyRound, Lock, ShieldCheck } from '@lucide/vue'
import { reactive, ref, watch } from 'vue'

import AuthField from '@/components/auth/AuthField.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import { changePassword } from '@/api/profile'
import { showSuccessToast } from '@/utils/toast'

const model = defineModel<boolean>({ default: false })

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

// 密码规则与注册一致：6-20 位，须同时包含字母和数字
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{6,20}$/

function validateCurrentPassword() {
  errors.currentPassword = form.currentPassword ? '' : '请输入当前密码'
  return !errors.currentPassword
}

function validateNewPassword() {
  if (!form.newPassword) errors.newPassword = '请输入新密码'
  else if (!PASSWORD_PATTERN.test(form.newPassword)) errors.newPassword = '密码需为 6-20 位，且包含字母和数字'
  else errors.newPassword = ''
  return !errors.newPassword
}

function validateConfirmPassword() {
  if (!form.confirmPassword) errors.confirmPassword = '请再次输入新密码'
  else if (form.confirmPassword !== form.newPassword) errors.confirmPassword = '两次输入的密码不一致'
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

watch(model, (open) => {
  if (!open) return
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
  const valid = Object.values(validators).map((validate) => validate()).every(Boolean)
  if (!valid || submitting.value) return

  submitting.value = true
  try {
    await changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    })
    // 接口失败时错误提示由请求层统一弹出，弹框保持打开
    showSuccessToast('密码已修改')
    model.value = false
  } catch {
    return
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <BaseModal v-model="model" title="修改密码" compact-footer>
    <form class="grid gap-2" novalidate @submit.prevent="submit">
      <AuthField
        v-model="form.currentPassword"
        label="当前密码"
        :icon="Lock"
        :error="errors.currentPassword"
        type="password"
        autocomplete="current-password"
        placeholder="输入当前密码"
        @blur="validateCurrentPassword"
      />

      <AuthField
        v-model="form.newPassword"
        label="新密码"
        :icon="KeyRound"
        :error="errors.newPassword"
        type="password"
        autocomplete="new-password"
        placeholder="6-20 位，包含字母和数字"
        @blur="validateNewPassword"
      />

      <AuthField
        v-model="form.confirmPassword"
        label="确认新密码"
        :icon="ShieldCheck"
        :error="errors.confirmPassword"
        type="password"
        autocomplete="new-password"
        placeholder="再次输入新密码"
        @blur="validateConfirmPassword"
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
        保存新密码
      </button>
    </template>
  </BaseModal>
</template>
