# PassIt AI 客户端

Vue 3 + Vite 客户端，部署在 Cloudflare Pages 的 `neo.passitai.com`。

## 本地开发

```sh
pnpm install
cp .env.example .env
pnpm dev
```

开发地址为 `http://localhost:5180`。浏览器请求 `/api/*`，Vite 将其代理到 `VITE_API_PROXY_TARGET`，默认 `http://127.0.0.1:8787`。

## Cloudflare Pages

| 配置 | 值 |
| --- | --- |
| Pages 项目 | `neo` |
| 自定义域名 | `neo.passitai.com` |
| 构建命令 | `pnpm run build` |
| 输出目录 | `dist` |
| 生产 API 地址 | `https://api.passitai.com/api` |

生产构建从 `.env.production` 读取 `VITE_API_BASE_URL=https://api.passitai.com/api`。在 Pages 控制台配置同名构建变量时，应保持这个值一致；`VITE_API_PROXY_TARGET` 只用于本地开发服务器，无需在 Pages 中设置。

前端使用 Vue Router history 模式。Pages 在输出目录没有顶层 `404.html` 时，会将页面路径交给 SPA 处理，因此 `/practice/session/...` 等深层链接可直接访问。不要为前端域名添加 `/api` 重写规则；生产请求由浏览器直接发送到 `api.passitai.com`，后端需要允许 `https://neo.passitai.com` 的跨域请求。

如使用 Wrangler 手动发布，执行 `pnpm deploy`。此命令构建后上传 `dist` 到 Pages 项目 `neo`，不会执行 Workers 的 `wrangler deploy`。自定义域名需在 Pages 项目的 Custom domains 中绑定。

## 检查

```sh
pnpm run build
```
