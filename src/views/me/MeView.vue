<script setup lang="ts">
import {
  Bell,
  BellRing,
  ChevronRight,
  Eraser,
  GraduationCap,
  KeyRound,
  LogOut,
  Mail,
  Settings2,
  SunMoon,
} from '@lucide/vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BasePopup from '@/components/common/BasePopup.vue'
import PageContainer from '@/components/common/PageContainer.vue'
import ExamPlanPopup from '@/components/exam-plan/ExamPlanPopup.vue'
import AppearancePopup from '@/components/me/AppearancePopup.vue'
import ChangeEmailDialog from '@/components/me/ChangeEmailDialog.vue'
import ChangePasswordDialog from '@/components/me/ChangePasswordDialog.vue'
import DataCleanupPopup from '@/components/me/DataCleanupPopup.vue'
import NotificationSettingsPopup from '@/components/me/NotificationSettingsPopup.vue'
import PracticeSettingsPopup from '@/components/practice/PracticeSettingsPopup.vue'
import { useAppearance } from '@/composables/useAppearance'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { useAuthStore } from '@/stores/auth'
import { useExamPlanStore } from '@/stores/exam-plan'
import { useNotificationSettingsStore } from '@/stores/notification-settings'
import { useNotificationsStore } from '@/stores/notifications'
import { usePracticeSettingsStore } from '@/stores/practice-settings'

const notifications = useNotificationsStore()
const notificationSettingsStore = useNotificationSettingsStore()
const auth = useAuthStore()
const examPlanStore = useExamPlanStore()
const practiceSettingsStore = usePracticeSettingsStore()
const { records: localPracticeRecords } = useLocalPracticeRecords()
const { appearanceLabel } = useAppearance()
const router = useRouter()
const signingOut = ref(false)
const accountPopupOpen = ref(false)
const passwordDialogOpen = ref(false)
const emailDialogOpen = ref(false)
const examPlanPopupOpen = ref(false)
const practiceSettingsPopupOpen = ref(false)
const notificationSettingsOpen = ref(false)
const cleanupPopupOpen = ref(false)
const appearancePopupOpen = ref(false)

type RowAction = 'scope' | 'practice' | 'notification' | 'appearance' | 'cleanup'

const displayName = computed(() => {
  const name = auth.user?.email.split('@')[0]
  return name ? name.replace(/[._-]+/g, ' ') : 'PassIt AI'
})
const avatarLetter = computed(() => displayName.value.slice(0, 1).toUpperCase() || 'P')
const profileEmail = computed(() => auth.user?.email ?? '')

const enabledPracticeCount = computed(
  () => Object.values(practiceSettingsStore.settings).filter(Boolean).length,
)

const settingsRows = computed(() => [
  {
    action: 'scope' as RowAction,
    title: '考试计划',
    icon: GraduationCap,
    iconClass: 'bg-secondary/12 text-secondary',
    value: examPlanStore.isLoading
      ? '加载中…'
      : examPlanStore.error
        ? '加载失败'
        : examPlanStore.plan
          ? `${examPlanStore.plan.major.name} · ${examPlanStore.plan.subjects.length}科`
          : '未设置',
  },
  {
    action: 'practice' as RowAction,
    title: '刷题设置',
    icon: Settings2,
    iconClass: 'bg-accent/12 text-accent',
    value: `已开 ${enabledPracticeCount.value} 项`,
  },
  {
    action: 'notification' as RowAction,
    title: '通知',
    icon: BellRing,
    iconClass: 'bg-info/12 text-info',
    value: notificationSettingsStore.isLoading
      ? '加载中'
      : notificationSettingsStore.settings
        ? notificationSettingsStore.settings.inAppBanner
          ? '横幅已开启'
          : '横幅已关闭'
        : '',
  },
  {
    action: 'appearance' as RowAction,
    title: '外观',
    icon: SunMoon,
    iconClass: 'bg-base-content/[0.06] text-base-content/60',
    value: appearanceLabel.value,
  },
  {
    action: 'cleanup' as RowAction,
    title: '数据清理',
    icon: Eraser,
    iconClass: 'bg-base-content/[0.06] text-base-content/60',
    value:
      localPracticeRecords.value.length > 0 ? `${localPracticeRecords.value.length} 份作答` : '',
  },
])

function openRowAction(action: RowAction) {
  if (action === 'notification') {
    notificationSettingsOpen.value = true
  } else if (action === 'cleanup') {
    cleanupPopupOpen.value = true
  } else if (action === 'appearance') {
    appearancePopupOpen.value = true
  } else if (action === 'scope') {
    if (examPlanStore.error) void examPlanStore.load()
    examPlanPopupOpen.value = true
  } else if (action === 'practice') {
    practiceSettingsPopupOpen.value = true
  }
}

async function openAccountAction(action: 'password' | 'email') {
  const token = auth.session?.token
  accountPopupOpen.value = false
  await nextTick()
  if (!auth.isAuthenticated || token !== auth.session?.token) return
  if (action === 'password') passwordDialogOpen.value = true
  else emailDialogOpen.value = true
}

async function logout() {
  if (signingOut.value) return
  signingOut.value = true
  const exited = await auth.logout()
  signingOut.value = false
  if (exited) await router.replace({ name: 'login' })
}

watch(
  () => auth.session?.token,
  (token, previous) => {
    if (previous && token !== previous) {
      accountPopupOpen.value = false
      passwordDialogOpen.value = false
      emailDialogOpen.value = false
      examPlanPopupOpen.value = false
      practiceSettingsPopupOpen.value = false
      cleanupPopupOpen.value = false
      notificationSettingsOpen.value = false
      appearancePopupOpen.value = false
    }
    if (token) {
      practiceSettingsStore.load(auth.session?.user.id ?? '')
      void examPlanStore.load()
    }
  },
  { immediate: true },
)
</script>

<template>
  <PageContainer>
    <section class="flex flex-col gap-3.5 overflow-x-hidden">
      <h1 class="sr-only">我的</h1>

      <button
        class="flex w-full items-center gap-4 rounded-2xl bg-gradient-to-br from-primary/[0.12] via-primary/[0.06] to-primary/[0.02] px-4 py-4 text-left active:from-primary/[0.18] active:via-primary/[0.10] active:to-primary/[0.04]"
        type="button"
        @click="accountPopupOpen = true"
      >
        <span
          class="flex size-14 shrink-0 items-center justify-center rounded-full bg-base-100 text-lg font-bold text-primary"
          aria-hidden="true"
        >
          {{ avatarLetter }}
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-lg font-semibold capitalize leading-snug">
            {{ displayName }}
          </span>
          <span class="mt-1 block truncate text-xs leading-snug text-base-content/55">
            {{ profileEmail }}
          </span>
        </span>
        <span class="shrink-0 text-xs text-primary/60">账户安全</span>
        <ChevronRight :size="16" class="-ml-1.5 shrink-0 text-primary/45" aria-hidden="true" />
      </button>

      <div class="overflow-hidden rounded-2xl bg-base-200/85 dark:bg-base-200/65">
        <button
          class="flex min-h-12 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors active:bg-base-300/60 dark:active:bg-base-300/40"
          type="button"
          @click="router.push({ name: 'notifications' })"
        >
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden="true"
          >
            <Bell :size="15" stroke-width="2" />
          </span>
          <span class="shrink-0 text-sm font-medium leading-snug text-base-content">消息中心</span>
          <span class="flex min-w-0 flex-1 items-center justify-end gap-1.5 pl-2">
            <span
              v-if="notifications.unreadCount > 0"
              class="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold tabular-nums text-error-content"
            >
              {{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}
            </span>
            <span v-else class="truncate text-xs text-base-content/45">暂无未读</span>
            <ChevronRight :size="15" class="shrink-0 text-base-content/30" aria-hidden="true" />
          </span>
        </button>

        <button
          v-for="row in settingsRows"
          :key="row.action"
          class="relative flex min-h-12 w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition-colors active:bg-base-300/60 dark:active:bg-base-300/40"
          type="button"
          @click="openRowAction(row.action)"
        >
          <span
            aria-hidden="true"
            class="pointer-events-none absolute left-14 right-0 top-0 h-px bg-base-content/[0.05]"
          ></span>
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-lg"
            :class="row.iconClass"
            aria-hidden="true"
          >
            <component :is="row.icon" :size="15" stroke-width="2" />
          </span>
          <span class="shrink-0 text-sm font-medium leading-snug text-base-content">
            {{ row.title }}
          </span>
          <span class="flex min-w-0 flex-1 items-center justify-end gap-1.5 pl-2">
            <span v-if="row.value" class="truncate text-xs text-base-content/45">
              {{ row.value }}
            </span>
            <ChevronRight :size="15" class="shrink-0 text-base-content/30" aria-hidden="true" />
          </span>
        </button>
      </div>

      <button
        class="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-error/[0.07] text-sm font-semibold text-error transition-colors active:bg-error/[0.14] disabled:opacity-50 dark:bg-error/[0.12] dark:active:bg-error/[0.2]"
        type="button"
        :disabled="signingOut"
        @click="logout"
      >
        <span v-if="signingOut" class="loading loading-spinner loading-xs"></span>
        <LogOut v-else :size="15" aria-hidden="true" />
        退出登录
      </button>

      <BasePopup v-model="accountPopupOpen" title="账户安全">
        <div class="grid gap-2">
          <button
            class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_1.125rem] items-center gap-2.5 rounded-2xl bg-base-200/70 p-3 text-left transition-colors active:bg-base-300/70"
            type="button"
            @click="openAccountAction('password')"
          >
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <KeyRound :size="16" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium">修改密码</span>
              <span class="mt-0.5 block truncate text-xs text-base-content/60"
                >定期更新密码更安全</span
              >
            </span>
            <ChevronRight :size="15" class="justify-self-end text-base-content/30" />
          </button>

          <button
            class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_1.125rem] items-center gap-2.5 rounded-2xl bg-base-200/70 p-3 text-left transition-colors active:bg-base-300/70"
            type="button"
            @click="openAccountAction('email')"
          >
            <span
              class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <Mail :size="16" />
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-medium">更换邮箱</span>
              <span class="mt-0.5 block truncate text-xs text-base-content/60">{{
                profileEmail
              }}</span>
            </span>
            <ChevronRight :size="15" class="justify-self-end text-base-content/30" />
          </button>
        </div>
      </BasePopup>

      <ChangePasswordDialog v-model="passwordDialogOpen" />

      <ChangeEmailDialog v-model="emailDialogOpen" />

      <ExamPlanPopup v-model="examPlanPopupOpen" />
      <PracticeSettingsPopup v-model="practiceSettingsPopupOpen" show-mistake-settings />
      <NotificationSettingsPopup v-model="notificationSettingsOpen" />
      <AppearancePopup v-model="appearancePopupOpen" />
      <DataCleanupPopup v-model="cleanupPopupOpen" />
    </section>
  </PageContainer>
</template>
