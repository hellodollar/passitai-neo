import { currentSessionToken } from '@/utils/auth/session'

/**
 * 会话请求守卫:统一收拢各 store 重复的「请求纪元 + 会话令牌」失效判断。
 * - captureRead:响应只允许写入未被重置、且期间没有本地写入的缓存(读取守卫);
 * - captureWrite:响应只受会话重置/切换影响,不被自身写入作废(写入守卫);
 * - noteWrite:本地写入作废在途读取;reset:会话切换时作废一切在途请求。
 * 迟到响应落在过期纪元时,调用方丢弃结果即可,不影响返回值语义。
 */
export function createSessionGuard() {
  let resetCount = 0
  let writeCount = 0

  function reset() {
    resetCount++
    writeCount++
  }

  function noteWrite() {
    writeCount++
  }

  function captureRead() {
    const capturedReset = resetCount
    const capturedWrite = writeCount
    const token = currentSessionToken()
    return () =>
      capturedReset === resetCount &&
      capturedWrite === writeCount &&
      token === currentSessionToken()
  }

  function captureWrite() {
    const capturedReset = resetCount
    const token = currentSessionToken()
    return () => capturedReset === resetCount && token === currentSessionToken()
  }

  return { captureRead, captureWrite, noteWrite, reset }
}
