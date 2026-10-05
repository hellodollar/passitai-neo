import { createJiti } from 'jiti'
import { fileURLToPath } from 'node:url'

// 使用已有的 TypeScript 加载器，让测试覆盖项目支持的 Node 版本。
const jiti = createJiti(import.meta.url, {
  fsCache: false,
  alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
})

export function loadSource(path) {
  return jiti.import(`../../src/${path}`)
}
