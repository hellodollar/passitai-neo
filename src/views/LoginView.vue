<script setup lang="ts">
import { LockKeyhole, Mail } from '@lucide/vue'
import { reactive, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import AuthField from '@/components/auth/AuthField.vue'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({
  email: '',
  password: '',
})

const errors = reactive({
  email: '',
  password: '',
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateEmail() {
  const value = form.email.trim()
  if (!value) errors.email = '请输入邮箱'
  else if (!EMAIL_PATTERN.test(value)) errors.email = '邮箱格式不正确，请检查后重试'
  else errors.email = ''
  return !errors.email
}

function validatePassword() {
  if (!form.password) errors.password = '请输入密码'
  else errors.password = ''
  return !errors.password
}

const validators = {
  email: validateEmail,
  password: validatePassword,
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

  // 接口失败时错误提示由请求层统一弹出，成功才跳转
  const success = await auth.signIn({
    email: form.email.trim(),
    password: form.password,
  })
  if (success) router.push((route.query.redirect as string) || '/')
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
        autocomplete="current-password"
        placeholder="6-20 位字符"
        @blur="validatePassword"
      />

      <button class="btn btn-primary h-12 w-full rounded-full text-sm font-semibold" :disabled="auth.loading">
        <span v-if="auth.loading" class="loading loading-spinner loading-sm"></span>
        登录
      </button>
    </form>

    <p class="mt-3 text-center text-sm text-base-content/60">
      还没有账号？
      <RouterLink class="font-semibold text-primary hover:underline" to="/register">创建账号</RouterLink>
    </p>
  </AuthFrame>
</template>
