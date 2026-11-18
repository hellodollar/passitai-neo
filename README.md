# PassIt AI 客户端

Vue 3 + Vite 客户端，可部署到不同域名的 Cloudflare Workers。

开发与编码代理约束见 [AGENTS.md](AGENTS.md)，按当前 Vue 3 H5 工程执行。

## 本地开发

```sh
pnpm install
cp .env.example .env
pnpm dev
```

开发地址为 `http://localhost:5180`。浏览器请求 `/api/*`，Vite 将其代理到 `VITE_API_PROXY_TARGET`，默认 `http://127.0.0.1:8787`。
客户端不内置种子数据或本地 mock；开发时需要启动后端并准备其本地数据库。实体关系与数据约束见 [数据模型](docs/data-model.md)。

## Cloudflare Workers

| 配置       | 值                                                       |
| ---------- | -------------------------------------------------------- |
| Worker     | `passitai-neo`（当前部署）                               |
| 自定义域名 | 按部署配置                                               |
| 构建命令   | `pnpm run build`                                         |
| 输出目录   | `dist`                                                   |
| 构建变量   | `VITE_API_BASE_URL`，例如 `https://api.passitai.com/api` |

无需提交 `.env.production`。在每个 Worker 的 **Settings > Build > Build variables and secrets** 中设置 `VITE_API_BASE_URL` 为该部署使用的完整 HTTPS API 地址，然后重新构建。截图中的 **Settings > Variables and Secrets** 是运行时变量，纯静态 Worker 不支持，但构建变量可以使用。Vite 会把此值编入静态资源；同一份代码部署到其他域名时，在对应构建中设置其 API 地址即可。生产构建如果缺少此变量或填成 `/api` 等相对路径，会直接失败，不会再静默请求前端域名。`VITE_API_PROXY_TARGET` 只用于本地开发。

首页为 `/`，收藏为 `/favorites`，错题为 `/mistakes`，我的为 `/me`，练习为 `/practice/:paperId`。已确认的路由、页面职责和状态约定见 [H5 前端契约](docs/frontend-contract.md)。

前端使用 Vue Router history 模式。Wrangler 将 `dist` 作为 Worker 静态资源上传，`single-page-application` 模式使 `/practice/:paperId/result/:submissionId` 等深层链接回退到 `index.html`。生产请求由浏览器直接发送到配置的 API 地址；后端需允许实际前端域名的跨域请求。

Workers Builds 的构建命令为 `pnpm run build`，部署命令为 `npx wrangler deploy`（也可用 `pnpm run deploy`）。
`deploy` 只发布 CF 构建阶段生成的 `dist`，避免部署阶段重复执行类型检查和打包。
自定义域名需在 Worker 的 Domains & Routes 中绑定。

### CF 线上构建加速

- pnpm 保持 `12.16.1`，Wrangler 固定为锁文件中已有的 `4.156.0`，本次不升级工具或业务依赖。
  CF 的 `npx wrangler deploy` 直接使用项目已安装的 Wrangler。
- pnpm 12 的 `preferOffline`、`updateNotifier` 设置集中在 `pnpm-workspace.yaml`，
  优先复用缓存、关闭更新提示；缓存缺少的依赖正常联网下载。
  保留原有依赖构建白名单、版本约束和默认 store 路径。
- 在 CF 的 Settings > Build 中保持构建缓存开启。首次成功构建填充缓存后，
  后续构建对比依赖安装日志的 `reused` / `downloaded` 与安装、构建、部署三个阶段的耗时。
- 类型检查、HTTPS API 构建变量检查和 SPA 深层路由继续生效。构建产物始终由 CF 在线生成，
  部署阶段只上传同一次构建的产物；保留现有推送触发规则。

提速结果以 CF 成功构建的历史日志对比为准，不使用开发机耗时推算。

## 检查

接口契约见 [client-api.md](docs/client-api.md)，构建发布见 [H5 构建与维护](docs/client-maintenance.md)，实体关系见 [数据模型](docs/data-model.md)，页面与状态见 [H5 前端契约](docs/frontend-contract.md)。

提交前运行统一检查：

```sh
pnpm run check
```

`check` 依次运行类型检查、测试、lint 检查和格式检查，不重复生产构建。

需要单独执行或自动修复时：

```sh
pnpm type-check
pnpm test
pnpm lint           # 只检查，不修改
pnpm lint:fix       # 自动修复 lint 问题
pnpm format         # 写入格式
pnpm format --check # 只检查格式
```

格式检查覆盖源代码、测试、配置和文档，排除 `src/generated/`、`pnpm-lock.yaml`、`dist/` 以及作为后端逐字节镜像的 `docs/client-api.md`。格式排除规则统一维护在 `.oxfmtrc.json`，构建与检查直接串行执行，不使用额外的脚本编排工具。

使用明确的占位 HTTPS API 地址做本地生产构建（构建会校验 `VITE_API_BASE_URL`）：

```sh
VITE_API_BASE_URL=https://your-api.example/api pnpm run build
```
