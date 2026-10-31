<script setup lang="ts">
import {
  Bell,
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
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppearancePopup from '@/components/me/AppearancePopup.vue'
import ChangeEmailDialog from '@/components/me/ChangeEmailDialog.vue'
import ChangePasswordDialog from '@/components/me/ChangePasswordDialog.vue'
import BasePopup from '@/components/common/BasePopup.vue'
import PracticePlanPopup from '@/components/practice/PracticePlanPopup.vue'
import PracticeSettingsPopup from '@/components/practice/PracticeSettingsPopup.vue'
import PracticeRecordsPopup from '@/components/practice/PracticeRecordsPopup.vue'
import { useAppearance } from '@/composables/useAppearance'
import { useAuthStore } from '@/stores/auth'
import { usePracticePlanStore } from '@/stores/practice-plan'
import { usePracticeSettingsStore } from '@/stores/practice-settings'

const auth = useAuthStore()
const practicePlanStore = usePracticePlanStore()
const practiceSettingsStore = usePracticeSettingsStore()
const { appearanceLabel } = useAppearance()
const router = useRouter()
const signingOut = ref(false)
const accountPopupOpen = ref(false)
const passwordDialogOpen = ref(false)
const emailDialogOpen = ref(false)
const planPopupOpen = ref(false)
const practiceSettingsPopupOpen = ref(false)
const notificationPopupOpen = ref(false)
const recordsPopupOpen = ref(false)
const appearancePopupOpen = ref(false)

type SettingsAction =
  | 'account'
  | 'plan'
  | 'practice'
  | 'notification'
  | 'records'
  | 'appearance'
const displayName = computed(() => {
  const name = auth.user?.email.split('@')[0]
  return name ? name.replace(/[._-]+/g, ' ') : 'PassIt AI'
})
const profileEmail = computed(() => auth.user?.email ?? '')
const menuGroups = computed(() => [
  {
    title: '刷题',
    items: [
      {
        title: '刷题计划',
        icon: GraduationCap,
        action: 'plan' as const,
        subtitle: practicePlanStore.isLoading
          ? '加载中…'
          : practicePlanStore.error
            ? '加载失败，点击重试'
            : practicePlanStore.plan
              ? `${practicePlanStore.plan.majorName} · ${practicePlanStore.plan.subjects.length} 个科目`
              : '选择专业和刷题科目',
      },
      {
        title: '刷题设置',
        icon: Settings2,
        action: 'practice' as const,
        subtitle: practiceSettingsStore.isLoading
          ? '加载中…'
          : practiceSettingsStore.error
            ? '加载失败，点击重试'
            : practiceSettingsStore.settings
              ? `自动下一题 ${practiceSettingsStore.settings.autoNext ? '开' : '关'} · 自动交卷 ${practiceSettingsStore.settings.autoSubmitAfterCompletion ? '开' : '关'}`
              : '答题方式与错题设置',
      },
      {
        title: '刷题记录',
        subtitle: '查看与管理作答记录',
        icon: Eraser,
        action: 'records' as const,
      },
    ],
  },
  {
    title: '账户与偏好',
    items: [
      { title: '账户与安全', subtitle: '密码与邮箱', icon: UserRound, action: 'account' as const },
      { title: '外观', subtitle: appearanceLabel.value, icon: SunMoon, action: 'appearance' as const },
      { title: '通知', subtitle: '暂未开放', icon: Bell, action: 'notification' as const },
    ],
  },
])

function openMenuItem(action: SettingsAction) {
  if (action === 'records') recordsPopupOpen.value = true
  else if (action === 'account') accountPopupOpen.value = true
  else if (action === 'appearance') appearancePopupOpen.value = true
  else if (action === 'plan') {
    if (practicePlanStore.error) void practicePlanStore.load()
    planPopupOpen.value = true
  } else if (action === 'practice') {
    if (practiceSettingsStore.error) void practiceSettingsStore.load()
    practiceSettingsPopupOpen.value = true
  } else notificationPopupOpen.value = true
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
      planPopupOpen.value = false
      practiceSettingsPopupOpen.value = false
      notificationPopupOpen.value = false
      recordsPopupOpen.value = false
    }
    if (token) void Promise.allSettled([practicePlanStore.load(), practiceSettingsStore.load()])
  },
  { immediate: true },
)
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
          class="flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-base-100 bg-primary/10 text-primary"
          aria-hidden="true"
        >
          <UserRound :size="34" stroke-width="1.8" />
        </span>
        <h1 class="mt-3 max-w-full truncate text-[22px] font-semibold capitalize leading-tight">
          {{ displayName }}
        </h1>
        <p class="mt-1.5 max-w-full truncate text-sm font-medium text-base-content/65">
          {{ profileEmail }}
        </p>
      </section>
    </header>

    <div class="relative px-5">
      <div class="space-y-3">
        <section v-for="group in menuGroups" :key="group.title" :aria-label="group.title">
          <div
            class="divide-y divide-base-200 overflow-hidden rounded-2xl border border-base-200 bg-base-100"
          >
            <button
              v-for="item in group.items"
              :key="item.title"
              class="flex min-h-13 w-full min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors active:bg-base-200/60"
              type="button"
              @click="openMenuItem(item.action)"
            >
              <component
                :is="item.icon"
                :size="18"
                stroke-width="1.8"
                class="shrink-0 text-base-content/55"
                aria-hidden="true"
              />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium leading-5">{{ item.title }}</span>
                <span class="block truncate text-xs leading-4 text-base-content/50">{{
                  item.subtitle
                }}</span>
              </span>
              <ChevronRight :size="15" class="shrink-0 text-base-content/30" aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>

      <button
        class="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-base-200 bg-base-100 text-sm font-medium text-base-content/65 transition-colors active:bg-base-200/60 disabled:opacity-50"
        type="button"
        :disabled="signingOut"
        @click="logout"
      >
        <span v-if="signingOut" class="loading loading-spinner loading-xs"></span>
        <LogOut v-else :size="16" aria-hidden="true" />
        退出登录
      </button>
    </div>

    <BasePopup v-model="accountPopupOpen" title="账户">
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
            <span class="mt-0.5 block truncate text-xs text-base-content/65"
              >定期更新密码更安全</span
            >
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
            <span class="mt-0.5 block truncate text-xs text-base-content/65">{{
              profileEmail
            }}</span>
          </span>
          <ChevronRight :size="16" class="justify-self-end text-base-content/30" />
        </button>
      </div>
    </BasePopup>

    <ChangePasswordDialog v-model="passwordDialogOpen" />

    <ChangeEmailDialog v-model="emailDialogOpen" />

    <PracticePlanPopup v-model="planPopupOpen" />
    <PracticeSettingsPopup v-model="practiceSettingsPopupOpen" show-mistake-settings />
    <BasePopup v-model="notificationPopupOpen" title="通知">
      <p class="py-4 text-center text-sm text-base-content/60">通知功能暂未开放</p>
    </BasePopup>
    <AppearancePopup v-model="appearancePopupOpen" />
    <PracticeRecordsPopup v-model="recordsPopupOpen" />
  </section>
</template>
