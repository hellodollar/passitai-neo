# 客户端维护约定

## 页面与路由

公开 URL 与 Vue 文件名分开管理。文件或内部路由名称调整时，不得顺带改变现有 URL：

| URL | 页面 | 用途 |
| --- | --- | --- |
| `/` | `PracticeHomeView.vue` | 练习首页 |
| `/practice` | 重定向到 `/` | 旧入口深链 |
| `/practice/papers/:paperId` | `PracticePaperView.vue` | 题集作答 |
| `/practice/papers/:paperId/result` | `PracticeResultView.vue` | 交卷结果 |
| `/favorites`、`/wrong-book` | `CollectionOverviewView.vue` | 收藏与错题集合 |
| `/me` | `MeView.vue` | 我的 |

## 数据的唯一来源

- API 路径及请求、响应结构：后端实现是运行时来源；客户端接入说明维护在 [`client-api.md`](client-api.md)，对应的请求封装放在 `src/api/`，共享数据类型放在 `src/types/domain.ts`。
- 领域取值：由后端 `src/constants/` 定义，经后端 `scripts/sync-domain-values.mjs` 同步到 `src/generated/domain-values.ts`。不要手改生成文件；在后端执行 `pnpm check:domain-values` 可检查同步状态。
- 数据库种子：属于后端仓库，不在客户端复制专业、科目或题集的固定数据。修改种子与执行数据库写入必须在后端单独验证，不能由客户端构建触发。
- 客户端只维护 UI 映射，例如 `src/constants/practice.ts` 的入口图标；真实科目、题集目录和题目总数由 API 返回。首页已答进度只从当前账号的本地做题记录读取，不使用接口的 `answeredCount` 或交卷记录回填。
- 本地开发默认代理真实本地后端。已移除未接入且与当前接口不符的旧 mock；需要离线开发时，应从当前 API 契约重新建立可显式启用的测试数据。

## 改动后的最小验证

本地做题记录的版本、迁移及当前接入范围见 [本地做题记录](practice-local-records.md)。

1. 运行类型检查、测试、lint 和生产构建。
2. 验证 `/`、`/practice`、`/me` 及题集深链可以直接打开和刷新。
3. 验证登录、选择科目、答题、退出后恢复本地记录、交卷结果、收藏与错题入口。
4. 改动本地记录结构时必须明确版本迁移或失效策略；不能只改字段名。
