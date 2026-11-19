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
  UserRound,
} from '@lucide/vue'
import type { LucideIcon } from '@lucide/vue'
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

type RowAction =
  | 'messages'
  | 'scope'
  | 'practice'
  | 'notification'
  | 'appearance'
  | 'cleanup'
  | 'account'

interface SettingsRow {
  action: RowAction
  title: string
  icon: LucideIcon
  iconClass: string
  desc: string
  badge?: boolean
}

const displayName = computed(() => {
  const name = auth.user?.email.split('@')[0]
  return name ? name.replace(/[._-]+/g, ' ') : 'PassIt AI'
})
const profileEmail = computed(() => auth.user?.email ?? '')

const enabledPracticeCount = computed(
  () => Object.values(practiceSettingsStore.settings).filter(Boolean).length,
)

const settingsRows = computed<SettingsRow[]>(() => [
  {
    action: 'messages',
    title: '消息中心',
    icon: Bell,
    iconClass: 'bg-primary/10 text-primary',
    desc: '学习消息、系统公告',
    badge: true,
  },
  {
    action: 'appearance',
    title: '外观',
    icon: SunMoon,
    iconClass: 'bg-base-200/75 text-base-content/65 dark:bg-base-300/50',
    desc: appearanceLabel.value,
  },
  {
    action: 'account',
    title: '账户与安全',
    icon: UserRound,
    iconClass: 'bg-primary/10 text-primary',
    desc: '密码与邮箱',
  },
  {
    action: 'notification',
    title: '通知',
    icon: BellRing,
    iconClass: 'bg-info/10 text-info',
    desc: notificationSettingsStore.isLoading
      ? '加载中'
      : notificationSettingsStore.settings
        ? notificationSettingsStore.settings.inAppBanner
          ? '应用内横幅已开启'
          : '应用内横幅已关闭'
        : '',
  },
  {
    action: 'scope',
    title: '考试计划',
    icon: GraduationCap,
    iconClass: 'bg-secondary/10 text-secondary',
    desc: examPlanStore.isLoading
      ? '加载中…'
      : examPlanStore.error
        ? '加载失败'
        : examPlanStore.plan
          ? `${examPlanStore.plan.major.name} · ${examPlanStore.plan.subjects.length}科`
          : '未设置',
  },
  {
    action: 'practice',
    title: '练习设置',
    icon: Settings2,
    iconClass: 'bg-accent/10 text-accent',
    desc: `已开 ${enabledPracticeCount.value} 项`,
  },
  {
    action: 'cleanup',
    title: '数据管理',
    icon: Eraser,
    iconClass: 'bg-base-200/75 text-base-content/65 dark:bg-base-300/50',
    desc:
      localPracticeRecords.value.length > 0
        ? `${localPracticeRecords.value.length} 份本地作答`
        : '清空本地作答记录',
  },
])

function openRowAction(action: RowAction) {
  if (action === 'messages') {
    void router.push({ name: 'notifications' })
  } else if (action === 'notification') {
    notificationSettingsOpen.value = true
  } else if (action === 'cleanup') {
    cleanupPopupOpen.value = true
  } else if (action === 'appearance') {
    appearancePopupOpen.value = true
  } else if (action === 'account') {
    accountPopupOpen.value = true
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
  <div class="min-h-dvh overflow-x-hidden bg-base-200/80 dark:bg-base-100">
    <PageContainer>
      <section class="flex flex-col gap-3">
        <h1 class="sr-only">我的</h1>

        <!-- 头部资料 -->
        <div
          class="flex flex-col items-center rounded-2xl bg-base-100 px-4 py-4.5 text-center dark:bg-base-200"
        >
          <span
            class="flex size-13 items-center justify-center rounded-full bg-primary text-primary-content"
            aria-hidden="true"
          >
            <UserRound :size="24" />
          </span>
          <span
            class="mt-2.5 max-w-full truncate text-base font-semibold capitalize leading-snug tracking-tight text-base-content"
          >
            {{ displayName }}
          </span>
          <span class="mt-0.5 max-w-full truncate text-xs leading-snug text-base-content/55">
            {{ profileEmail }}
          </span>
        </div>

        <!-- 设置列表：纯白一体化卡片，行相连，弱分隔线 -->
        <div class="overflow-hidden rounded-2xl bg-base-100 py-0.5 dark:bg-base-200">
          <button
            v-for="(row, rowIndex) in settingsRows"
            :key="row.action"
            class="relative flex w-full min-w-0 items-center gap-3 px-3.5 py-2.5 text-left transition-colors active:bg-base-200/60 dark:active:bg-base-300/50"
            type="button"
            @click="openRowAction(row.action)"
          >
            <span
              v-if="rowIndex > 0"
              aria-hidden="true"
              class="pointer-events-none absolute left-[3.875rem] right-3.5 top-0 h-px bg-base-content/[0.06] dark:bg-base-content/[0.08]"
            ></span>
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-xl"
              :class="row.iconClass"
              aria-hidden="true"
            >
              <component :is="row.icon" :size="16" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium leading-snug text-base-content">
                {{ row.title }}
              </span>
              <span
                v-if="row.desc"
                class="mt-0.5 block truncate text-xs leading-snug text-base-content/55"
              >
                {{ row.desc }}
              </span>
            </span>
            <span v-if="row.badge" class="flex shrink-0 items-center gap-1.5">
              <span
                v-if="notifications.unreadCount > 0"
                class="flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold tabular-nums text-error-content"
              >
                {{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}
              </span>
              <ChevronRight :size="15" class="text-base-content/30" aria-hidden="true" />
            </span>
            <ChevronRight
              v-else
              :size="15"
              class="shrink-0 text-base-content/30"
              aria-hidden="true"
            />
          </button>
        </div>

        <button
          class="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-base-100 text-sm font-medium text-error transition-colors active:bg-error/10 disabled:opacity-50 dark:bg-base-200 dark:active:bg-error/15"
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
              class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_1.125rem] items-center gap-3 rounded-2xl bg-base-200/65 px-3.5 py-3 text-left transition-colors active:bg-base-200 dark:bg-base-300/45 dark:active:bg-base-300/70"
              type="button"
              @click="openAccountAction('password')"
            >
              <span
                class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
              >
                <KeyRound :size="16" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium leading-snug text-base-content"
                  >修改密码</span
                >
                <span class="mt-0.5 block truncate text-xs leading-snug text-base-content/55"
                  >定期更新密码更安全</span
                >
              </span>
              <ChevronRight :size="15" class="justify-self-end text-base-content/30" />
            </button>

            <button
              class="grid w-full grid-cols-[2.25rem_minmax(0,1fr)_1.125rem] items-center gap-3 rounded-2xl bg-base-200/65 px-3.5 py-3 text-left transition-colors active:bg-base-200 dark:bg-base-300/45 dark:active:bg-base-300/70"
              type="button"
              @click="openAccountAction('email')"
            >
              <span
                class="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"
              >
                <Mail :size="16" />
              </span>
              <span class="min-w-0">
                <span class="block text-sm font-medium leading-snug text-base-content"
                  >更换邮箱</span
                >
                <span class="mt-0.5 block truncate text-xs leading-snug text-base-content/55">{{
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
  </div>
</template>
