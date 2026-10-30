import { computed, ref } from 'vue'

import { STORAGE_KEYS } from '@/constants/app'

/**
 * 外观偏好(跟随系统 / 浅色 / 深色):设备本地属性,存 localStorage,
 * 通过切换 html 的 data-theme 在 neo / neo-dark 间解析。
 * index.html 的内联脚本在首屏渲染前做同样一次解析以防闪,键值需与此保持同步。
 */

export type AppearancePreference = 'system' | 'light' | 'dark'

const THEMES = { light: 'neo', dark: 'neo-dark' } as const
const THEME_COLOR = { neo: '#ffffff', 'neo-dark': '#1b1c20' } as const
const APPEARANCES: readonly AppearancePreference[] = ['system', 'light', 'dark']

export const APPEARANCE_LABELS: Record<AppearancePreference, string> = {
  system: '跟随系统',
  light: '浅色',
  dark: '深色',
}

/** 非法或历史值一律归一为跟随系统 */
export function normalizeAppearance(value: unknown): AppearancePreference {
  return APPEARANCES.includes(value as AppearancePreference)
    ? (value as AppearancePreference)
    : 'system'
}

export function resolveThemeName(preference: AppearancePreference, systemDark: boolean) {
  if (preference === 'light') return THEMES.light
  if (preference === 'dark') return THEMES.dark
  return systemDark ? THEMES.dark : THEMES.light
}

const preference = ref<AppearancePreference>('system')
const systemDark = ref(false)
let initialized = false

function readStoredPreference(): AppearancePreference {
  try {
    return normalizeAppearance(window.localStorage.getItem(STORAGE_KEYS.appearance))
  } catch {
    return 'system'
  }
}

function applyTheme() {
  if (typeof document === 'undefined') return
  const theme = resolveThemeName(preference.value, systemDark.value)
  document.documentElement.setAttribute('data-theme', theme)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLOR[theme])
}

/** main.ts 启动时调用:读取偏好、应用主题并监听系统深浅变化(幂等) */
export function initializeAppearance() {
  if (initialized) return
  initialized = true
  preference.value = readStoredPreference()
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    systemDark.value = query.matches
    // 偏好为跟随系统时由解析逻辑自动响应,监听常挂即可
    query.addEventListener?.('change', (event) => {
      systemDark.value = event.matches
      if (preference.value === 'system') applyTheme()
    })
  }
  applyTheme()
}

/** 切换偏好:即时生效并持久化到本设备 */
function setAppearance(next: AppearancePreference) {
  const value = normalizeAppearance(next)
  preference.value = value
  try {
    window.localStorage.setItem(STORAGE_KEYS.appearance, value)
  } catch {
    // 存储不可用时仍保留本次会话内的切换
  }
  applyTheme()
}

export function useAppearance() {
  return {
    appearance: computed(() => preference.value),
    appearanceLabel: computed(() => APPEARANCE_LABELS[preference.value]),
    setAppearance,
  }
}
