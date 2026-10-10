import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  if (command === 'build') {
    const configuredApiBase = env.VITE_API_BASE_URL?.trim()
    let apiUrl: URL | undefined

    try {
      apiUrl = configuredApiBase ? new URL(configuredApiBase) : undefined
    } catch {
      // Keep the actionable error below for missing and malformed values.
    }

    if (apiUrl?.protocol !== 'https:') {
      throw new Error('生产构建需要配置 VITE_API_BASE_URL，值必须是完整的 HTTPS API 地址。请在 Cloudflare Workers 的 Settings > Build 中设置构建变量。')
    }
  }

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5180,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
      },
    },
  }
})
