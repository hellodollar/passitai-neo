# H5 构建与维护

适用项目：`passitai-neo`。记录实际构建、发布和排查方式；“待确认”不代表已实现。本次整理未读取 CF 控制台，线上域名、分支和变量以对应部署配置为准。

接口见 [client-api.md](client-api.md)，页面与浏览器状态见 [frontend-contract.md](frontend-contract.md)，实体见 [data-model.md](data-model.md)。

## 构建与环境变量

本项目使用 Vue + Vite，产物为 `dist/`，不使用 Astro、SSR 或原生安装包。依据为 `package.json`、`vite.config.ts`、`wrangler.jsonc`。

| 项目       | 当前约定                                                            |
| ---------- | ------------------------------------------------------------------- |
| 工具版本   | 以 `package.json`、`pnpm-lock.yaml` 为准，使用项目依赖中的 Wrangler |
| 安装       | `pnpm install --frozen-lockfile`                                    |
| 提交前检查 | `pnpm run check`：类型、测试、lint、格式                            |
| CF 构建    | `pnpm run build`：类型检查及 Vite 打包                              |
| CF 部署    | `pnpm run deploy`：只上传同一次构建的 `dist/`，不再次打包           |
| Worker     | `passitai-neo`，通过 Workers Static Assets 发布                     |
| SPA 回退   | `assets.not_found_handling = single-page-application`               |

正式发布由 Cloudflare 在线构建，不上传开发机产物。CF 构建命令不包含完整 `check`，不能将构建成功当作所有检查均通过。

| 变量                    | 本地开发                     | CF 构建                                              |
| ----------------------- | ---------------------------- | ---------------------------------------------------- |
| `VITE_API_BASE_URL`     | `/api`，通过 Vite 代理       | 完整 HTTPS 地址，例如 `https://api.passitai.com/api` |
| `VITE_API_PROXY_TARGET` | 默认 `http://127.0.0.1:8787` | 不提供线上代理                                       |

本地由 `.env.example` 创建 `.env`，开发端口 `5180`。生产构建拒绝缺失、相对路径或非 HTTPS 的 API 地址。

CF 的 API 地址设在 **Settings → Build → Build variables and secrets**，打包时编入 JS，修改后需要重新构建；不是部署后读取的运行时配置。`VITE_` 变量对浏览器可见，不承载 Token、JWT 密钥或部署凭据。参考 [Vite 环境变量](https://vite.dev/guide/env-and-mode)。

## 发布、环境与回滚

当前链路：GitHub 推送 → CF Workers Builds 安装依赖 → 构建 → Wrangler 上传静态资源。分支和触发条件在 CF 配置。本仓库没有 `.github/workflows/`，未接入 GitHub Actions 发布流水线。

1. 提交前运行 `pnpm run check`，推送至已配置的构建分支。
2. 查看 CF 初始化、克隆、安装、构建、部署各阶段状态；保留依赖缓存，参数见 `pnpm-workspace.yaml`。初始化慢不能直接归因于 Vite 或依赖安装。
3. 发布后验证登录回跳、考试计划、收藏/错题入口、作答深链直开及刷新，核对浏览器请求的 API 域名。
4. 保留提交 SHA、CF 构建记录、Worker 版本、构建 API 地址及目标域名，供排障和回滚定位。`package.json` 版本不是已接通的自动发布编号。

预发布 Worker、测试 API、分支/域名映射及自动发布门禁**待确认**；仓库未定义 staging 配置，预览链接不自动代表独立测试后端。后续接入 GitHub Actions 时先确定它负责检查还是发布，避免与 CF 重复构建和部署。

回滚时，在 CF 选定上一已知可用版本并确认重新部署；若旧版本不可用，则恢复对应提交与构建变量后重新触发 CF 构建。回滚后重验深链、API 地址与列表返回流程。前端回滚不会回退后端、数据库或本地作答；已打开页面还可能请求与回滚版本不一致的动态模块。参考 [Workers 回滚](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)。

## 静态资源与缓存

| 层级            | 当前状态与处理                                                |
| --------------- | ------------------------------------------------------------- |
| JS/CSS          | Vite 生成带内容 hash 的资源名，更新通过重新构建发布           |
| `public/` 资源  | 按原文件名复制，不自动获得内容 hash；同名更新需检查缓存       |
| HTML / SPA 页面 | 仓库没有自定义 `_headers`，采用平台默认策略，线上以响应头为准 |
| CDN             | 使用 Workers Static Assets 分发，未在仓库定义额外页面缓存规则 |
| 业务数据        | Store、浏览记忆、作答记录按前端契约管理，不属于 CDN 缓存      |
| 离线缓存        | 未接入 Service Worker / PWA 缓存                              |

Cloudflare 文档的默认静态响应包含 `ETag`，常规请求使用 `Cache-Control: public, max-age=0, must-revalidate`；带 hash 不代表已启用一年强缓存。若以后为 hash 资源增加长期缓存，需要另行配置，HTML 仍应可重新验证。参考 [Static Assets 响应头](https://developers.cloudflare.com/workers/static-assets/headers/)。

显示旧版本时，先核对部署版本、HTML 引用的资源 hash、资源 URL 和响应头，再在测试浏览器禁用 HTTP 缓存并刷新。发布不完整则重新发布整份产物；涉及额外 CDN 配置时只处理已定位的缓存层。发布和回滚还需验证旧标签页的动态模块请求，见 [版本与静态资源差异](https://developers.cloudflare.com/workers/versions-and-deployments/version-skew/)。

CF 构建缓存清理只影响构建；浏览器刷新不等于清理站点存储。排查发布不能默认执行 `localStorage.clear()`，也不能让用户清空作答来“更新版本”。

## 异常监控与上报

已具备：请求层统一接口/网络错误，页面错误态及按需 Toast；`wrangler.jsonc` 开启 `observability`。Worker 侧观测不等于已采集浏览器 JS 异常。

待确认：浏览器异常平台、`error` / `unhandledrejection` 上报、业务埋点、告警、Source Map 上传和前端发布版本关联。当前不宣称这些能力已经接入。

现阶段报障记录提交/部署版本、时间、脱敏 URL、系统和浏览器版本、复现步骤、控制台错误及失败请求状态。不附带 Authorization、密码、完整会话或用户答案。上报字段和事件方案后续确认后再实施。

## 移动端与浏览器验证

移动 Safari、Android 浏览器、微信内置浏览器是验证目标，当前没有已完成的最低版本兼容性矩阵。发布时关注：

- SPA 深链、刷新、浏览器后退和 `returnTo`。
- 软键盘、底部安全区、原生 `dialog`、横滑切题与纵向滚动。
- 切后台返回、弱网、存储受限、多标签切换账号。
- 微信与系统浏览器分别验证，不假定共享登录、存储或刷新行为。

下拉刷新、滚动和离页请求的边界见 [前端契约](frontend-contract.md)。构建通过不代替真机验证。

## 域名、跨域与鉴权

- 自定义域名在 Worker 的 Domains & Routes 绑定；本仓库未固定正式 H5 域名或子路径部署配置。
- 线上浏览器直接请求 `VITE_API_BASE_URL`；本地代理不随 `dist/` 上线。换域名需核对 DNS、TLS、API 地址和后端 CORS。
- 当前使用 `Authorization: Bearer <JWT>`，不依赖跨站 Cookie，也未配置跨域 `credentials: include`。跨域时检查 `OPTIONS` 和允许的请求头；CORS 响应由 API/网关处理，H5 不能自行补响应头解决。
- 若改为 Cookie 登录，需要另行确认 SameSite、Secure、凭据跨域和 CSRF；当前不作为已实现方案。
- 会话属于当前 origin，换域名、协议或端口会产生另一份存储；同站点后缀不意味着 H5 子域共享登录。本地有效期仅用于交互，JWT 与账户权限由后端验证。
