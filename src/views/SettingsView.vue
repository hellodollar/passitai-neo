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
import AccountEmailContent from '@/components/common/AccountEmailContent.vue'
import AccountPasswordContent from '@/components/common/AccountPasswordContent.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import NotificationSettingsContent from '@/components/common/NotificationSettingsContent.vue'
import PracticePlanModal from '@/components/common/PracticePlanModal.vue'
import PracticeSettingsContent from '@/components/common/PracticeSettingsContent.vue'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'
import type { PracticePlan, PracticeSettings, UserMe } from '@/types/domain'

const auth = useAuthStore()
const app = useAppStore()
const router = useRouter()
const signingOut = ref(false)
const accountModalOpen = ref(false)
const passwordModalOpen = ref(false)
const emailModalOpen = ref(false)
const planModalOpen = ref(false)
const practiceSettingsModalOpen = ref(false)
const notificationModalOpen = ref(false)
const me = ref<UserMe | null>(null)

type SettingsAction = 'account' | 'plan' | 'practice' | 'notification'

const displayName = computed(() => {
  const name = auth.user?.email.split('@')[0]
  return name ? name.replace(/[._-]+/g, ' ') : 'PassIt AI'
})

const profileEmail = computed(() => me.value?.user.email ?? auth.user?.email ?? 'you@passitai.ai')

const menuItems = computed(() => {
  const plan = me.value?.preferences.plan
  const practice = me.value?.preferences.practice
  const notifications = me.value?.preferences.notifications

  return [
    {
      title: '账户',
      subtitle: profileEmail.value,
      icon: UserRound,
      iconClasses: 'bg-primary/10 text-primary',
      action: 'account' as const,
    },
    {
      title: '刷题计划',
      subtitle: plan ? `${plan.majorName} · ${plan.subjects.length} 个科目` : '专业和刷题科目',
      icon: GraduationCap,
      iconClasses: 'bg-secondary/10 text-secondary',
      action: 'plan' as const,
    },
    {
      title: '练习设置',
      subtitle: practice
        ? `自动下一题 ${practice.autoNext ? '开' : '关'} · 解析 ${practice.showExplanationAfterAnswer ? '开' : '关'}`
        : '答题方式、错题记录、解析显示',
      icon: Settings2,
      iconClasses: 'bg-accent/15 text-accent',
      action: 'practice' as const,
    },
    {
      title: '通知',
      subtitle: notifications
        ? notifications.dailyReminder
          ? '学习提醒已开启'
          : '学习提醒已关闭'
        : '学习提醒、系统消息',
      icon: Bell,
      iconClasses: 'bg-info/10 text-info',
      action: 'notification' as const,
    },
  ]
})

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

function onPlanUpdated(plan: PracticePlan, selection: { majorId: string; subjectIds: string[] }) {
  if (me.value) {
    me.value.preferences.plan = plan
  }
  app.setSubjectSelection({
    majorId: selection.majorId,
    subjectIds: selection.subjectIds,
  })
}

function onPracticeSettingsSaved(settings: PracticeSettings) {
  if (me.value) {
    me.value.preferences.practice = settings
  }
}

function onEmailUpdated(email: string) {
  if (me.value) {
    me.value.user.email = email
  }
  auth.updateEmail(email)
}

function openAccountAction(action: 'password' | 'email') {
  accountModalOpen.value = false
  if (action === 'password') passwordModalOpen.value = true
  else emailModalOpen.value = true
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
  <section
    class="relative -mx-5 -mb-24 -mt-5 flex min-h-dvh flex-col overflow-x-hidden bg-base-200/35 pb-24"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-72 overflow-hidden bg-gradient-to-br from-primary/20 via-info/10 to-transparent [mask-image:linear-gradient(to_bottom,black_0%,black_62%,transparent_100%)]"
      aria-hidden="true"
    ></div>

    <header class="relative shrink-0 px-5 pb-5 pt-10">
      <section class="relative flex flex-col items-center px-4 text-center">
        <span
          class="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-base-100 bg-base-100 text-primary"
          aria-hidden="true"
        >
          <span
            class="flex size-full items-center justify-center rounded-full bg-gradient-to-br from-primary/15 to-info/10"
          >
            <UserRound :size="34" stroke-width="1.8" />
          </span>
        </span>

        <h1
          class="mt-3 max-w-full truncate text-[22px] font-semibold capitalize leading-tight text-base-content"
        >
          {{ displayName }}
        </h1>
        <p class="mt-1.5 max-w-full truncate text-sm font-medium text-base-content/50">
          {{ profileEmail }}
        </p>
      </section>
    </header>

    <div class="relative flex flex-1 flex-col px-5 pb-4">
      <section
        class="w-full min-w-0 overflow-hidden rounded-2xl border border-base-200 bg-base-100 divide-y divide-base-200"
      >
        <button
          v-for="item in menuItems"
          :key="item.title"
          class="grid w-full min-w-0 grid-cols-[2.25rem_minmax(0,1fr)_1.125rem] items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-base-200/60"
          type="button"
          @click="openMenuItem(item.action)"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-xl"
            :class="item.iconClasses"
          >
            <component :is="item.icon" :size="17" stroke-width="2" />
          </span>

          <span class="min-w-0">
            <span class="block truncate text-base font-semibold leading-tight text-base-content">
              {{ item.title }}
            </span>
            <span class="mt-1 block truncate text-xs leading-tight text-base-content/45">
              {{ item.subtitle }}
            </span>
          </span>

          <ChevronRight :size="18" class="justify-self-end text-base-content/30" />
        </button>
      </section>

      <button
        class="mt-4 flex w-full items-center gap-3 rounded-2xl border border-base-200 bg-base-100 px-4 py-3.5 text-left text-error transition-colors active:bg-error/5 disabled:opacity-50"
        type="button"
        :disabled="signingOut"
        @click="signOut"
      >
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error"
        >
          <span v-if="signingOut" class="loading loading-spinner loading-xs"></span>
          <LogOut v-else :size="17" />
        </span>
        <span class="text-sm font-semibold">退出登录</span>
      </button>
    </div>

    <BaseModal v-model="accountModalOpen" title="账户">
      <div class="grid gap-2">
        <button
          class="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_1.125rem] items-center gap-2 rounded-2xl bg-base-200/70 p-3 text-left transition-colors active:bg-base-300/70"
          type="button"
          @click="openAccountAction('password')"
        >
          <span class="flex size-10 items-center justify-center text-base-content/55">
            <KeyRound :size="20" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium">修改密码</span>
            <span class="mt-0.5 block truncate text-xs text-base-content/50">定期更新密码更安全</span>
          </span>
          <ChevronRight :size="16" class="justify-self-end text-base-content/30" />
        </button>

        <button
          class="grid w-full grid-cols-[2.5rem_minmax(0,1fr)_1.125rem] items-center gap-2 rounded-2xl bg-base-200/70 p-3 text-left transition-colors active:bg-base-300/70"
          type="button"
          @click="openAccountAction('email')"
        >
          <span class="flex size-10 items-center justify-center text-base-content/55">
            <Mail :size="20" />
          </span>
          <span class="min-w-0">
            <span class="block text-sm font-medium">更换邮箱</span>
            <span class="mt-0.5 block truncate text-xs text-base-content/50">{{
              profileEmail
            }}</span>
          </span>
          <ChevronRight :size="16" class="justify-self-end text-base-content/30" />
        </button>
      </div>
    </BaseModal>

    <AccountPasswordContent v-model="passwordModalOpen" />

    <AccountEmailContent v-model="emailModalOpen" :current-email="profileEmail" @updated="onEmailUpdated" />

    <PracticePlanModal
      v-model="planModalOpen"
      :plan="me?.preferences.plan"
      @updated="onPlanUpdated"
    />

    <PracticeSettingsContent
      v-model="practiceSettingsModalOpen"
      external
      :settings="me?.preferences.practice"
      @saved="onPracticeSettingsSaved"
    />

    <NotificationSettingsContent
      v-model="notificationModalOpen"
      :notifications="me?.preferences.notifications"
    />
  </section>
</template>
