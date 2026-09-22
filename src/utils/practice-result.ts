import type { PracticeSubmissionResult } from '@/types/domain'

function resultStorageKey(paperId: string) {
  return `passitai:practice-result:${paperId}`
}

export function readPracticeResultSnapshot(paperId: string) {
  try {
    const raw = window.sessionStorage.getItem(resultStorageKey(paperId))
    return raw ? (JSON.parse(raw) as PracticeSubmissionResult) : null
  } catch {
    return null
  }
}

export function writePracticeResultSnapshot(result: PracticeSubmissionResult) {
  try {
    window.sessionStorage.setItem(resultStorageKey(result.paperId), JSON.stringify(result))
  } catch {
    // Result snapshots are only a development fallback until the result API is finalized.
  }
}
