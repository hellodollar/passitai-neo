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

- API 路径及请求、响应结构：后端实现是运行时来源；客户端接入说明维护在 [`client-api.md`](client-api.md)，对应的请求封装放在 `src/api/`，共享数据类型按模块放在 `src/types/`。
- 领域取值：由后端 `src/constants/` 定义，经后端 `scripts/sync-domain-values.mjs` 同步到 `src/generated/domain-values.ts`。不要手改生成文件；在后端执行 `pnpm check:domain-values` 可检查同步状态。
- 数据库种子：属于后端仓库，不在客户端复制专业、科目或题集的固定数据。修改种子与执行数据库写入必须在后端单独验证，不能由客户端构建触发。
- 客户端只维护 UI 映射，例如 `src/constants/practice-icons.ts` 的入口图标；真实科目、题集目录和题目总数由 API 返回。首页已答进度只从当前账号的本地做题记录读取，不使用接口的 `answeredCount` 或交卷记录回填。
- 本地开发默认代理真实本地后端。已移除未接入且与当前接口不符的旧 mock；需要离线开发时，应从当前 API 契约重新建立可显式启用的测试数据。
- 通知设置接口（`GET/PATCH /api/user/settings/notifications`）后端已可用，但客户端设置页目前为禁用占位、尚未接入。

## 改动后的最小验证

本地做题记录的版本、迁移及当前接入范围见 [本地做题记录](practice-local-records.md)。

1. 运行类型检查、测试、lint 和生产构建。
2. 验证 `/`、`/practice`、`/me` 及题集深链可以直接打开和刷新。
3. 验证登录、选择科目、答题、退出后恢复本地记录、交卷结果、收藏与错题入口。
4. 改动本地记录结构时必须明确版本迁移或失效策略；不能只改字段名。

## 组件目录职责

- `src/components/common/`：与业务无关的基础 UI（`BaseModal`、`BaseDialog`、`EmptyState`、`AppToast`、`SettingsToggleItem`），不新增业务归属。
- `src/components/auth/`：登录/注册与账户凭据内容（`AuthField`、`AuthFrame`、`AccountEmailContent`、`AccountPasswordContent`）。
- `src/components/settings/`：设置相关（`PracticeSettingsModal`、`PracticeSettingsSection`、`NotificationSettingsContent`）。
- `src/components/practice/`：作答与题集相关（含跨页复用的 `StudyPlanModal`）。
- 移动组件只调整归属与 import，不改变组件内容、界面和交互。

## 类型与契约对齐

- 客户端 API 类型以服务端 schema 为准；发现类型与文档冲突时，先用只读方式核对后端实现，再决定是否收紧/放宽，不先改协议、请求或持久化含义。
- 已核实（后端 `passitai-api`）：`SubmitPracticePaperBody.startTime` 可选；`UserMe.user.status` 为 `enabled | disabled`；`GET /api/options/majors` 支持 `code` 过滤；收藏/错题聚合支持 `sort`。集合练习 `sections` 恒带 `questionType`。
- `ReviewSource` 定义在领域层 `src/types/entity.ts`，本地存储类型 `PracticeRecordSource` 依赖它，保持“存储依赖领域、领域不依赖存储”的方向。
- 基础题目字段集中在 `src/types/entity.ts` 的 `QuestionContent`，被 `QuestionListItem`（entity）与 `PracticePaperItem`（practice）复用。
- 类型模块职责：`api.ts` 只放通用信封 `ApiEnvelope`；`auth.ts` 放账号与会话相关类型（`UserMe` 直接依赖 `./entity` 与 `./practice`）；`entity.ts` 放共用题目、集合、选项与非练习设置（`NotificationSettings`、`AppPreferences`）；`practice.ts` 放计划、入口、题集、提交、设置与报告等练习类型；`practice-record.ts` 放本地记录类型，内部只依赖 `./entity` 与 `./practice`，版本字段用 `typeof` 引用常量；`index.ts` 显式 `export type` 汇总全部类型（不含运行时常量），业务代码统一 `import type from '@/types'`。
- 运行时值集中在 `src/constants/practice.ts`（`PRACTICE_CATEGORY_LABELS`、`DEFAULT_PRACTICE_SETTINGS`、`PRACTICE_RECORD_VERSION`）；图标映射单独放 `src/constants/practice-icons.ts`，避免基础常量与存储模块引入 UI 图标依赖；`QUESTION_TYPE_LABELS` 放在 `src/constants/entity.ts`。
- 刷题设置缓存与练习运行态统一在 `src/stores/practice.ts`（Pinia id `practice`，`usePracticeStore`）。练习运行态字段为 `practiceActive`，由 `startPractice`/`endPractice` 切换，仅表示当前处于作答/报告等刷题运行态，与账号会话、持久化记录无关。`clearSettings` 通过 generation 作废未完成的旧 GET/PATCH，旧响应不写回新会话，旧请求 `finally` 不影响新请求；并发 `ensureSettings` 去重，失败可重试；登录/退出/会话失效由 auth store 调用 `clearSettings`，不引入 practice→auth 循环。
- 错题业务内部统一用 Mistake 术语：答题后同步封装为 `src/composables/useMistakeSync.ts`（`useMistakeSync`），API 包装函数在 `src/api/wrong-questions.ts`（`fetchMistakeAggregate`/`addMistake`/`removeMistakeByContext`/`clearMistakes`/`fetchMistakePractice`）。文件名与 URL 仍保留端点字面量 `/wrong-questions`（路由 `/wrong-book` 不变），设置键 `recordWrongQuestions` 与线上字段 `wrongQuestionId` 不改；回归用例在 `tests/mistake-sync.test.mjs`。

## 待产品确认（不实现、不删）

- 刷题设置中 `autoSubmitAfterCompletion`、`loopAfterCompletion`、`showExplanationAfterAnswer` 目前只保存未被消费，需产品确认后再决定是否实现。
- API 404（HTTP 404）当前在作答页显示为通用“加载失败”，是否改为“练习已失效”待确认。
- 首页目录/科目加载失败当前静默显示空态，是否改为错误提示待确认。
