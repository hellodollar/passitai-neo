<script setup lang="ts">
import { LockKeyhole, Mail } from '@lucide/vue'
import { reactive } from 'vue'
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

async function submit() {
  await auth.signIn(form)
  router.push((route.query.redirect as string) || '/')
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
        autocomplete="current-password"
        placeholder="6-20 位字符"
      />

      <div v-if="auth.error" class="alert alert-error rounded-2xl py-2.5 text-sm">{{ auth.error }}</div>

      <button class="btn btn-primary mt-2 h-12 w-full rounded-full text-sm font-semibold" :disabled="auth.loading">
        <span v-if="auth.loading" class="loading loading-spinner loading-sm"></span>
        登录
      </button>
    </form>

    <p class="mt-5 text-center text-sm text-base-content/60">
      还没有账号？
      <RouterLink class="font-semibold text-primary hover:underline" to="/register">创建账号</RouterLink>
    </p>
  </AuthFrame>
</template>
