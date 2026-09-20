<script setup lang="ts">
import {
  Bell,
  ChevronRight,
  GraduationCap,
  KeyRound,
  LogOut,
  Mail,
  Settings2,
  UserRound,
} from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { fetchUserMe } from '@/api/me'
import BaseModal from '@/components/common/BaseModal.vue'
import PracticePlanModal from '@/components/common/PracticePlanModal.vue'
import PracticeSettingsContent from '@/components/common/PracticeSettingsContent.vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import type { PracticePlan, UserMe } from '@/types/domain'

const auth = useAuthStore()
const app = useAppStore()
const router = useRouter()
const signingOut = ref(false)
const accountModalOpen = ref(false)
const planModalOpen = ref(false)
const practiceSettingsModalOpen = ref(false)
const notificationModalOpen = ref(false)
const me = ref<UserMe | null>(null)

type SettingsAction = 'account' | 'plan' | 'practice' | 'notification'

const displayName = computed(() => {
  if (me.value?.profile.displayName) return me.value.profile.displayName
  const name = auth.user?.email.split('@')[0]
  return name ? name.replace(/[._-]+/g, ' ') : 'PassIt AI'
})

const profileEmail = computed(() => me.value?.profile.email ?? auth.user?.email ?? 'you@passitai.ai')

const menuItems = [
  {
    title: '账户',
    subtitle: '修改密码、更换邮箱',
    icon: KeyRound,
    action: 'account',
  },
  {
    title: '刷题计划',
    subtitle: '专业和刷题科目',
    icon: GraduationCap,
    action: 'plan',
  },
  {
    title: '练习设置',
    subtitle: '答题方式、错题记录、解析显示',
    icon: Settings2,
    action: 'practice',
  },
  {
    title: '通知',
    subtitle: '学习提醒、系统消息',
    icon: Bell,
    action: 'notification',
  },
] as const

function openMenuItem(action: SettingsAction) {
  if (action === 'account') {
    accountModalOpen.value = true
    return
  }

  if (action === 'plan') {
    planModalOpen.value = true
    return
  }

  if (action === 'practice') {
    practiceSettingsModalOpen.value = true
    return
  }

  notificationModalOpen.value = true
}

async function loadMe() {
  try {
    me.value = await fetchUserMe()
  } catch {
    me.value = null
  }
}

function onPlanUpdated(_plan: PracticePlan, selection: { majorId: string; subjectIds: string[] }) {
  app.setSubjectSelection({
    majorId: selection.majorId,
    subjectIds: selection.subjectIds,
  })
}

async function signOut() {
  if (signingOut.value) return

  signingOut.value = true
  await auth.signOut()
  signingOut.value = false
  router.push('/login')
}

onMounted(() => {
  loadMe()
})
</script>

<template>
  <section class="min-h-[calc(100vh-7rem)]">
    <header class="me-hero -mx-5 -mt-5 h-52 overflow-hidden" aria-hidden="true"></header>

    <section class="relative -mx-5 -mt-14 rounded-t-3xl bg-base-100 px-5 pb-6 pt-14">
      <button
        class="absolute left-1/2 top-0 flex size-[5.5rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-base-100"
        type="button"
        aria-label="查看头像"
      >
        <span class="flex size-20 items-center justify-center rounded-full bg-base-200" aria-hidden="true">
          <UserRound :size="48" stroke-width="1.7" class="text-base-content/35" />
        </span>
      </button>

      <div class="text-center">
        <h2 class="mx-auto max-w-full truncate text-2xl font-semibold capitalize leading-tight text-base-content">
          {{ displayName }}
        </h2>
        <p class="mx-auto mt-1.5 max-w-full truncate text-sm font-medium text-base-content/50">{{ profileEmail }}</p>
      </div>
    </section>

    <section class="space-y-1 pb-3 pt-3">
      <button
        v-for="item in menuItems"
        :key="item.title"
        class="grid w-full grid-cols-[3rem_minmax(0,1fr)_1.25rem] items-center gap-2 rounded-2xl py-3.5 text-left transition-colors hover:bg-base-200/50 active:bg-base-200"
        type="button"
        @click="openMenuItem(item.action)"
      >
        <span class="flex size-10 shrink-0 items-center justify-center text-base-content/55">
          <component :is="item.icon" :size="22" stroke-width="2.1" />
        </span>

        <span class="min-w-0">
          <span class="block truncate text-base font-medium leading-tight text-base-content">{{ item.title }}</span>
          <span class="mt-1 block truncate text-sm font-medium leading-tight text-base-content/50">{{ item.subtitle }}</span>
        </span>

        <ChevronRight :size="20" class="justify-self-end text-base-content/25" />
      </button>
    </section>

    <button
      class="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-base-200/70 px-5 text-sm font-medium text-base-content/45 transition-colors hover:bg-base-200 active:bg-base-300"
      type="button"
      :disabled="signingOut"
      @click="signOut"
    >
      <span v-if="signingOut" class="loading loading-spinner loading-xs"></span>
      <LogOut v-else :size="18" />
      退出登录
    </button>

    <BaseModal v-model="accountModalOpen" title="账户">
      <div class="grid gap-2">
        <button class="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2 rounded-2xl bg-base-200/70 p-3 text-left" type="button">
          <span class="flex size-10 items-center justify-center text-base-content/55">
            <KeyRound :size="20" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium">修改密码</span>
            <span class="mt-0.5 block truncate text-xs text-base-content/50">功能占位</span>
          </span>
        </button>

        <button class="grid w-full grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2 rounded-2xl bg-base-200/70 p-3 text-left" type="button">
          <span class="flex size-10 items-center justify-center text-base-content/55">
            <Mail :size="20" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium">更换邮箱</span>
            <span class="mt-0.5 block truncate text-xs text-base-content/50">{{ profileEmail }}</span>
          </span>
        </button>
      </div>
    </BaseModal>

    <PracticePlanModal v-model="planModalOpen" @updated="onPlanUpdated" />

    <PracticeSettingsContent v-model="practiceSettingsModalOpen" />

    <BaseModal v-model="notificationModalOpen" title="通知设置">
      <div class="grid gap-2">
        <label class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3">
          <span>
            <span class="block text-sm font-medium">学习提醒</span>
            <span class="text-xs text-base-content/50">功能占位</span>
          </span>
          <input type="checkbox" class="toggle toggle-primary toggle-sm" disabled />
        </label>
        <label class="flex items-center justify-between gap-4 rounded-2xl bg-base-200/70 p-3">
          <span>
            <span class="block text-sm font-medium">系统消息</span>
            <span class="text-xs text-base-content/50">功能占位</span>
          </span>
          <input type="checkbox" class="toggle toggle-primary toggle-sm" disabled />
        </label>
      </div>
    </BaseModal>
  </section>
</template>

<style scoped>
.me-hero {
  background-color: #fbf6ef;
  background-image:
    linear-gradient(180deg, rgb(255 255 255 / 0.1), rgb(255 255 255 / 0.5)),
    url("data:image/svg+xml,%3Csvg width='168' height='168' viewBox='0 0 168 168' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ddd1c3' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='.58'%3E%3Cpath d='M18 21c12-10 28 4 18 17s-28 0-18-17Z'/%3E%3Ccircle cx='118' cy='29' r='12'/%3E%3Cpath d='M128 27h14M135 20v14'/%3E%3Cpath d='M48 83c8-13 29-8 28 8-1 12-18 20-29 10-6-5-5-12 1-18Z'/%3E%3Cpath d='M95 90l20 8-18 10 8-18Z'/%3E%3Cpath d='M24 133c18-3 29 5 34 18M134 126c-13 2-22 13-20 26'/%3E%3Cpath d='M68 36l8 4 8-4-4 8 4 8-8-4-8 4 4-8-4-8Z'/%3E%3Cpath d='M147 65c-8 0-8 12 0 12s8-12 0-12Z'/%3E%3Cpath d='M13 73h22M24 62v22'/%3E%3Cpath d='M81 134h20M91 124v20'/%3E%3C/g%3E%3C/svg%3E");
  background-size:
    100% 100%,
    168px 168px;
}
</style>
