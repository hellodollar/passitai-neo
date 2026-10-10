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

### 入口状态与练习返回

- 首页使用 `subjectCode`、`entry` 查询参数；收藏/错题使用 `groupBy`、`sort`、`order`。URL 优先于页面记忆，缺省时读取当前账号、当前页面的上次选择；参数必须通过 `src/utils/browse-state.ts` 校验。
- 页面选择、滚动位置以及首页科目顺序/显示状态保存到 `sessionStorage`，键为 `passitai:browse:<userId>:<page>`。三页相互隔离，刷新仍保留，登出/登录失效清除当前账号状态。这不是作答记录，不保存接口列表或题目内容。
- 进入练习时携带站内 `returnTo`，交卷后继续传递给报告。退出练习或报告时，上一条历史与来源一致则真正后退，否则替换到来源页；旧链接按收藏/错题来源兜底，普通题集兜底首页。外链及练习页循环不能作为返回目标。
- 返回入口后重新请求目录/集合数据，不用页面缓存冻结收藏变化。`useBrowseScroll` 等异步内容加载完成后恢复纵向位置，首页同时让选中科目在横向列表中可见；失效科目回退到当前有效科目。
- 验收时覆盖三页进入/退出、交卷报告返回、刷新、浏览器后退、分组/排序切换失败、计划科目失效和账号切换。工具层回归用例在 `tests/browse-state.test.mjs`。

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
