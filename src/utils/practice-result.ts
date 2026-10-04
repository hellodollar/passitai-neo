import type { PracticePaperLite } from '@/types/domain'

/** 收藏/错题练习的本地结果快照（不落服务端记录），会话级存储 */
export interface LocalPracticeResult {
  paper: PracticePaperLite
  userAnswers: Record<string, string | string[]>
  submittedAt: string
}

const RESULT_KEY = 'passitai.local-practice-result'

export function writeLocalPracticeResult(result: LocalPracticeResult) {
  try {
    sessionStorage.setItem(RESULT_KEY, JSON.stringify(result))
  } catch {
    // 存储不可用时静默降级：结果页将显示加载失败
  }
}

export function readLocalPracticeResult(): LocalPracticeResult | null {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY)
    return raw ? (JSON.parse(raw) as LocalPracticeResult) : null
  } catch {
    return null
  }
}

export function clearLocalPracticeResult() {
  try {
    sessionStorage.removeItem(RESULT_KEY)
  } catch {
    // ignore
  }
}
