<script setup lang="ts">
import { LockKeyhole, Mail } from '@lucide/vue'
import { reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import AuthField from '@/components/auth/AuthField.vue'
import AuthFrame from '@/components/auth/AuthFrame.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({
  email: '',
  password: '',
})

async function submit() {
  await auth.signUp(form)
  router.push('/')
}
</script>

<template>
  <AuthFrame>
    <form class="grid gap-4" @submit.prevent="submit">
      <AuthField
        v-model="form.email"
        label="邮箱"
        :icon="Mail"
        inputmode="email"
        autocomplete="email"
        placeholder="you@example.com"
      />

      <AuthField
        v-model="form.password"
        label="密码"
        :icon="LockKeyhole"
        type="password"
        autocomplete="new-password"
        placeholder="6-20 位字符"
      />

      <div v-if="auth.error" class="alert alert-error rounded-2xl py-2.5 text-sm">{{ auth.error }}</div>

      <button class="btn btn-primary mt-2 h-12 w-full rounded-full text-sm font-semibold" :disabled="auth.loading">
        <span v-if="auth.loading" class="loading loading-spinner loading-sm"></span>
        创建账号
      </button>
    </form>

    <p class="mt-5 text-center text-sm text-base-content/60">
      已经有账号？
      <RouterLink class="font-semibold text-primary hover:underline" to="/login">去登录</RouterLink>
    </p>
  </AuthFrame>
</template>
