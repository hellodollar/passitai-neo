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

## 账号与登录会话

- 注册页始终展示邮箱、密码、确认密码和选填邀请码，不预读注册策略。空邀请码允许提交且省略该字段；
  非空邀请码去除首尾空格并转大写，校验为六位且同时含字母和数字。是否开放注册、是否要求有效邀请码，
  统一由服务端处理；HTTP 400/403 通过现有请求层展示错误。
- 登录/注册返回统一用户快照和 ISO 字符串 `expiresAt`，有效期由后端控制。用户默认三天，固定绝对到期后重新登录，
  不续期 JWT。仅启动恢复已有有效会话时调用一次 `GET /api/user`；
  到期计时、回到前台和跨标签变化只同步本地会话，不隐式请求用户。网络故障保留有效会话。
- `auth.user` 来自当前 session 的唯一用户快照。请求创建时捕获 Token，设置排队请求还检查会话代际；
  账号变化后尚未发出的旧写请求取消，迟到响应不覆盖新身份或新设置。跨标签页 `storage` 事件同步身份和缓存。
- 退出使用原 Token 撤销；服务端失败仍退出当前设备并提示结果未确认，迟到的退出不能清除新登录。
  登出、会话失效时清理当前账号本地作答/浏览状态的现有策略保持不变。

## 用户 Store 与调用规则

| 文件与导出 | 职责 | 主要方法 |
| --- | --- | --- |
| `stores/auth.ts` / `useAuthStore` | 唯一会话与用户快照、账户操作、到期及跨标签同步 | initialize/login/register/logout/refreshUser/changeEmail/changePassword/clearSession |
| `stores/practice-plan.ts` / `usePracticePlanStore` | 当前刷题计划 | load/save/reset |
| `stores/practice-settings.ts` / `usePracticeSettingsStore` | 四项刷题偏好、保存队列 | load/save/reset |
| `stores/practice-entries.ts` / `usePracticeEntriesStore` | 按科目缓存的题集目录 | load/reset |

计划和设置各自暴露plan或settings，以及isLoaded/isLoading/error；error为空表示没有读取错误。
账户只维护session.user这一份用户数据，页面不保存第二份用户快照。

| 操作 | 用户请求 |
| --- | --- |
| 无会话启动 | 无 |
| 恢复已有有效会话 | initialize只查一次GET /api/user；重复initialize不追加请求 |
| 登录、注册 | 各提交一次POST，直接使用返回的user，不追加GET /api/user |
| 底栏切页、窗口focus、页面恢复可见 | 不请求user；前台事件仅核对本地到期与会话存储 |
| 跨标签登录、换账号、改邮箱、退出 | 同步存储中的会话快照，换Token时清空业务缓存，不追加用户请求 |
| 修改邮箱 | auth.changeEmail提交一次PUT并更新共享用户，不追加GET |
| 修改密码 | auth.changePassword提交一次PUT后清理原会话，不追加GET或logout |
| 退出 | auth.logout用原Token提交一次POST，撤销失败仍清理本地并提示 |
| 显式刷新资料 | auth.refreshUser调用GET，并发调用合并 |

GET /api/user明确使用10秒超时、零自动重试；失败不假装成功、不清除尚有效的本地会话，401仍走统一失效处理。
其他业务接口继续由后端校验账号状态；不通过反复拉用户资料代替接口鉴权。
api/auth与api/user只由auth Store调用；账户弹框调用Store，不直接操作持久化或发起资料补查。
页面和弹框使用明确的practicePlanStore/practiceSettingsStore变量，避免泛化的practice Store承担多个职责。

## 数据的唯一来源

- API 路径及请求、响应结构：后端实现是运行时来源；客户端接入说明维护在 [`client-api.md`](client-api.md)，对应的请求封装放在 `src/api/`，共享数据类型按模块放在 `src/types/`。
- 领域取值：由后端 `src/constants/` 定义，在后端执行 `pnpm sync` 同步到 `src/generated/domain-values.ts`。不要手改生成文件；在后端执行 `pnpm check` 可检查同步状态。
- 数据库种子：属于后端仓库，不在客户端复制专业、科目或题集的固定数据。修改种子与执行数据库写入必须在后端单独验证，不能由客户端构建触发。
- 客户端只维护 UI 映射，例如 `src/constants/practice-icons.ts` 的入口图标；真实科目、题集目录和题目总数由 API 返回。首页已答进度只从当前账号的本地做题记录读取，不使用接口的 `answeredCount` 或交卷记录回填。
- 本地开发默认代理真实本地后端。已移除未接入且与当前接口不符的旧 mock；需要离线开发时，应从当前 API 契约重新建立可显式启用的测试数据。
- “我的”页使用两块无标题的紧凑列表：刷题计划/设置/本地记录，以及账户与安全/通知。保留渐变背景、居中头像和账号信息，列表缩短行高与间距，退出为轻量按钮。账户复用auth.user，刷题计划与设置并行加载，独立显示失败与重试。
  不维护UserMe聚合对象，不调用/api/me。计划和设置弹框直接使用各自Store，保存后所有页面共享最新值。
- 当前刷题计划使用PracticePlan、PracticePlanModal和usePracticePlanStore（stores/practice-plan.ts），
  GET/PUT /api/practice/plan直接返回专业和科目ID；移除code反查ID缓存。服务端users.practicePlan与preferences分开保存。
- 刷题设置只提供已生效的四项开关：自动下一题、自动交卷、记录错题、答对移除错题。
  设置加载失败不能使用默认值冒充成功；乐观修改失败恢复服务端状态，账号切换清理草稿。
- 通知尚未开放，仅显示说明，不读取或保存通知占位配置。旧通知设置接口已移除。
- 本地刷题记录与服务端交卷报告明确区分；本地清理不删除报告、收藏或错题。

## 改动后的最小验证

本地做题记录的版本、迁移及当前接入范围见 [本地做题记录](practice-local-records.md)。

1. 运行类型检查、测试、lint 和生产构建。
2. 验证 `/`、`/practice`、`/me` 及题集深链可以直接打开和刷新。
3. 验证登录、选择科目、答题、退出练习后恢复本地记录、交卷结果、收藏与错题入口。
4. 改动本地记录结构时必须明确版本迁移或失效策略；不能只改字段名。

## 组件目录职责

- `src/components/common/`：与业务无关的基础 UI（`BaseModal`、`BaseDialog`、`EmptyState`、`AppToast`、`SettingsToggleItem`），不新增业务归属。
- `src/components/auth/`：登录/注册与账户凭据内容（`AuthField`、`AuthFrame`、`AccountEmailContent`、`AccountPasswordContent`）。
- `src/components/settings/`：设置相关（`PracticeSettingsModal`、`PracticeSettingsSection`）。
- `src/components/practice/`：作答与题集相关（含跨页复用的 `PracticePlanModal`）。
- 移动组件只调整归属与 import，不改变组件内容、界面和交互。

## 类型与契约对齐

- 客户端 API 类型以服务端 schema 为准；发现类型与文档冲突时，先用只读方式核对后端实现，再决定是否收紧/放宽，不先改协议、请求或持久化含义。
- 已核实（后端 `passitai-api`）：`SubmitPracticePaperBody.startTime` 可选；`User.status` 为 `enabled | disabled`；`GET /api/options/majors` 支持 `code` 过滤；收藏/错题聚合支持 `sort`。集合练习 `sections` 恒带 `questionType`。
- `ReviewSource` 定义在领域层 `src/types/entity.ts`，本地存储类型 `PracticeRecordSource` 依赖它，保持“存储依赖领域、领域不依赖存储”的方向。
- 基础题目字段集中在 `src/types/entity.ts` 的 `QuestionContent`，被 `QuestionListItem`（entity）与 `PracticePaperItem`（practice）复用。
- 类型模块职责：`api.ts` 只放通用信封 `ApiEnvelope`；`auth.ts` 放账号与会话相关类型；`entity.ts` 放共用题目、集合、选项与非练习设置（`AppPreferences`）；`practice.ts` 放计划、入口、题集、提交、设置与报告等练习类型；`practice-record.ts` 放本地记录类型，内部只依赖 `./entity` 与 `./practice`，版本字段用 `typeof` 引用常量；`index.ts` 显式 `export type` 汇总全部类型（不含运行时常量），业务代码统一 `import type from '@/types'`。
- 运行时值集中在 `src/constants/practice.ts`（`PRACTICE_CATEGORY_LABELS`、`PRACTICE_RECORD_VERSION`）；图标映射单独放 `src/constants/practice-icons.ts`，避免基础常量与存储模块引入 UI 图标依赖；`QUESTION_TYPE_LABELS` 放在 `src/constants/entity.ts`。
- Store按职责命名，文件使用kebab-case、导出使用useXxxStore；布尔状态使用is前缀。
  刷题计划和设置统一使用load/save/reset：load命中缓存或合并在途请求，save使用服务端响应更新共享状态，
  reset清理当前会话并作废旧请求。读取失败保留error，允许重试；保存失败不覆盖已有数据。
- 错题业务内部统一用 Mistake 术语：答题后同步封装为 `src/composables/useMistakeSync.ts`（`useMistakeSync`），API 包装函数在 `src/api/wrong-questions.ts`（`fetchMistakeAggregate`/`addMistake`/`removeMistakeByContext`/`clearMistakes`/`fetchMistakePractice`）。文件名与 URL 仍保留端点字面量 `/wrong-questions`（路由 `/wrong-book` 不变），设置键 `recordWrongQuestions` 与线上字段 `wrongQuestionId` 不改；回归用例在 `tests/mistake-sync.test.mjs`。

## 待产品确认（不实现、不删）

- API 404（HTTP 404）当前在作答页显示为通用“加载失败”，是否改为“练习已失效”待确认。
- 首页目录/科目加载失败当前静默显示空态，是否改为错误提示待确认。
