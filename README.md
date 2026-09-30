# PassIt AI 客户端

Vue 3 + Vite 客户端，可部署到不同域名的 Cloudflare Workers。

## 本地开发

```sh
pnpm install
cp .env.example .env
pnpm dev
```

开发地址为 `http://localhost:5180`。浏览器请求 `/api/*`，Vite 将其代理到 `VITE_API_PROXY_TARGET`，默认 `http://127.0.0.1:8787`。

## Cloudflare Workers

| 配置 | 值 |
| --- | --- |
| Worker | `passitai-neo`（当前部署） |
| 自定义域名 | 按部署配置 |
| 构建命令 | `pnpm run build` |
| 输出目录 | `dist` |
| 构建变量 | `VITE_API_BASE_URL`，例如 `https://api.passitai.com/api` |

无需提交 `.env.production`。在每个 Worker 的 **Settings > Build > Build variables and secrets** 中设置 `VITE_API_BASE_URL` 为该部署使用的完整 HTTPS API 地址，然后重新构建。截图中的 **Settings > Variables and Secrets** 是运行时变量，纯静态 Worker 不支持，但构建变量可以使用。Vite 会把此值编入静态资源；同一份代码部署到其他域名时，在对应构建中设置其 API 地址即可。生产构建如果缺少此变量或填成 `/api` 等相对路径，会直接失败，不会再静默请求前端域名。`VITE_API_PROXY_TARGET` 只用于本地开发。

前端使用 Vue Router history 模式。Wrangler 将 `dist` 作为 Worker 静态资源上传，`single-page-application` 模式使 `/practice/papers/:paperId` 等深层链接回退到 `index.html`。旧的 `/practice/session/:paperId` 链接会跳转到新地址。生产请求由浏览器直接发送到配置的 API 地址；后端需允许实际前端域名的跨域请求。

Workers Builds 的构建命令为 `pnpm run build`，部署命令为 `npx wrangler deploy`。如使用 Wrangler 手动发布，执行 `pnpm deploy`。自定义域名需在 Worker 的 Domains & Routes 中绑定。

## 检查

```sh
VITE_API_BASE_URL=https://your-api.example/api pnpm run build
```
