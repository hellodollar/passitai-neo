<script setup lang="ts">
import { LockKeyhole, Mail } from '@lucide/vue'
import { reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

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
  <AuthFrame title="创建账号" subtitle="几秒钟建立练习空间，之后再慢慢完善专业和科目。">
    <form @submit.prevent="submit">
      <div class="grid gap-3">
        <label class="form-control">
          <span class="label-text mb-1.5 block text-sm font-medium text-base-content/70">邮箱</span>
          <span class="input input-bordered flex h-12 w-full items-center gap-2 rounded-2xl border-base-200 bg-base-100 focus-within:border-primary">
            <Mail :size="17" class="text-base-content/40" />
            <input
              v-model="form.email"
              type="text"
              class="grow text-sm"
              inputmode="email"
              autocomplete="email"
              placeholder="you@example.com"
            />
          </span>
        </label>

        <label class="form-control">
          <span class="label-text mb-1.5 block text-sm font-medium text-base-content/70">密码</span>
          <span class="input input-bordered flex h-12 w-full items-center gap-2 rounded-2xl border-base-200 bg-base-100 focus-within:border-primary">
            <LockKeyhole :size="17" class="text-base-content/40" />
            <input
              v-model="form.password"
              type="password"
              class="grow text-sm"
              autocomplete="new-password"
              placeholder="6-20 位字符"
            />
          </span>
        </label>
      </div>

      <div v-if="auth.error" class="alert alert-error mt-4 rounded-2xl py-2.5 text-sm">{{ auth.error }}</div>

      <button class="btn btn-primary mt-6 h-12 w-full rounded-full text-sm font-semibold" :disabled="auth.loading">
        <span v-if="auth.loading" class="loading loading-spinner loading-sm"></span>
        创建账号
      </button>

      <p class="mt-5 text-center text-sm text-base-content/60">
        已经有账号？
        <RouterLink class="font-semibold text-primary" to="/login">去登录</RouterLink>
      </p>
    </form>
  </AuthFrame>
</template>
