<script setup lang="ts">
import { Lock, LockKeyhole, Mail, TicketPercent } from '@lucide/vue'
import { reactive, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AuthField from '@/components/auth/AuthField.vue'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  inviteCode: '',
})

const errors = reactive({
  email: '',
  password: '',
  confirmPassword: '',
  inviteCode: '',
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 简单密码规则：6-20 位，须同时包含字母和数字
const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{6,20}$/
// 邀请码非必填：不填写可直接提交（由服务端判定），填写了则校验长度
const INVITE_CODE_MIN = 6
const INVITE_CODE_MAX = 8

function validateEmail() {
  const value = form.email.trim()
  if (!value) errors.email = '请输入邮箱'
  else if (!EMAIL_PATTERN.test(value)) errors.email = '邮箱格式不正确，请检查后重试'
  else errors.email = ''
  return !errors.email
}

function validatePassword() {
  if (!form.password) errors.password = '请输入密码'
  else if (!PASSWORD_PATTERN.test(form.password)) errors.password = '密码需为 6-20 位，且包含字母和数字'
  else errors.password = ''
  return !errors.password
}

function validateConfirmPassword() {
  if (!form.confirmPassword) errors.confirmPassword = '请再次输入密码'
  else if (form.confirmPassword !== form.password) errors.confirmPassword = '两次输入的密码不一致'
  else errors.confirmPassword = ''
  return !errors.confirmPassword
}

function validateInviteCode() {
  const value = form.inviteCode.trim()
  if (!value) errors.inviteCode = ''
  else if (value.length < INVITE_CODE_MIN || value.length > INVITE_CODE_MAX)
    errors.inviteCode = `邀请码长度需在 ${INVITE_CODE_MIN}-${INVITE_CODE_MAX} 位之间`
  else errors.inviteCode = ''
  return !errors.inviteCode
}

const validators = {
  email: validateEmail,
  password: validatePassword,
  confirmPassword: validateConfirmPassword,
  inviteCode: validateInviteCode,
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

async function submit() {
  submitted = true
  const valid = Object.values(validators).map((validate) => validate()).every(Boolean)
  if (!valid) return

  // 接口失败时错误提示由请求层统一弹出，成功才进入首页
  const success = await auth.signUp({
    email: form.email.trim(),
    password: form.password,
    inviteCode: form.inviteCode.trim() || undefined,
  })
  if (success) router.push('/')
}
</script>

<template>
  <AuthFrame>
    <form class="grid gap-1" novalidate @submit.prevent="submit">
      <AuthField
        v-model="form.email"
        label="邮箱"
        :icon="Mail"
        :error="errors.email"
        inputmode="email"
        autocomplete="email"
        placeholder="you@example.com"
        @blur="validateEmail"
      />

      <AuthField
        v-model="form.password"
        label="密码"
        :icon="LockKeyhole"
        :error="errors.password"
        type="password"
        autocomplete="new-password"
        placeholder="6-20 位，包含字母和数字"
        @blur="validatePassword"
      />

      <AuthField
        v-model="form.confirmPassword"
        label="确认密码"
        :icon="Lock"
        :error="errors.confirmPassword"
        type="password"
        autocomplete="new-password"
        placeholder="请再次输入密码"
        @blur="validateConfirmPassword"
      />

      <AuthField
        v-model="form.inviteCode"
        label="邀请码"
        :icon="TicketPercent"
        :error="errors.inviteCode"
        autocomplete="off"
        placeholder="选填，6-8 位"
        @blur="validateInviteCode"
      />

      <button class="btn btn-primary h-12 w-full rounded-full text-sm font-semibold" :disabled="auth.loading">
        <span v-if="auth.loading" class="loading loading-spinner loading-sm"></span>
        创建账号
      </button>
    </form>

    <p class="mt-3 text-center text-sm text-base-content/60">
      已经有账号？
      <RouterLink class="font-semibold text-primary hover:underline" to="/login">去登录</RouterLink>
    </p>
  </AuthFrame>
</template>
