# H5 前端契约

记录已确认的登录注册、考试计划、收藏、错题和共用作答入口，以及必要的浏览器状态与导航规则。其他页面不扩写业务约定；后续明确确认后再补充。

HTTP 见 [client-api.md](client-api.md)，数据语义见 [data-model.md](data-model.md)，发布、CDN 和兼容性排查见 [client-maintenance.md](client-maintenance.md)。

## 文档维护

根目录的 `README.md` 负责快速开始，`AGENTS.md` 负责项目修改规则。现行实现、维护步骤和接口分别更新对应的已有文档。HTTP 契约从 API 仓库同步，实体关系以 API 的数据模型为准。

| 目录           | 有内容时放什么                                           |
| -------------- | -------------------------------------------------------- |
| `docs/design/` | 产品设计、已交付能力与产品愿景，集中维护并明确当前状态。 |
| `docs/todo/`   | 已确认要实施的工作。                                     |
| `docs/issues/` | 已发现的缺陷及待核对的差异，记录证据、状态和验收条件。   |

三个目录在 `docs/` 下平级，有对应内容时再创建。阶段报告和已结案复盘通过 Git 历史查阅。移动文档时更新引用，验收后更新对应的现行说明。

### 任务优先级约定

`docs/todo/` 与 `docs/issues/` 统一采用全系 4 级优先级，用于跨端对齐与排期判断：

| 等级   | 定位                | 适用范围                                                                                                         | 执行与排期规则                                                                       |
| ------ | ------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **P0** | 阻断 / 立即对齐     | 后端接口、路由、字段或生成常量变更下沉的对齐 TODO；安全/权限缺陷；登录、刷题、交卷等核心主流程不可用或数据错乱。 | 最高优先级；进入本仓库工作时**先于新需求**核对处理，验收后立即删除，不得带 P0 上线。 |
| **P1** | 高优先级 / 核心业务 | 当前迭代已确认的核心业务能力、显著影响高频学习操作的缺陷或关键交互阻断。                                         | 当前迭代内按序优先安排完成。                                                         |
| **P2** | 中优先级 / 常规改进 | 非阻断的体验完善、次要字段展示增强、常规组件整理或结构优化。                                                     | 常规排期，可在触碰相关模块时顺手合并处理。                                           |
| **P3** | 低优先级 / 锦上添花 | 非核心视觉/交互打磨、低频操作收纳、文案微调、无紧迫性的探索性优化。                                              | 暂不主动排期，闲时或迭代对应页面时按需处理。                                         |

**文件命名与生命周期**：

- `docs/todo/` 与 `docs/issues/` 新增文件统一命名为 `p<0-3>-<kebab-case>.md`（如 `p0-client-api-sync.md`、`p3-ui-polish.md`），文档须明确写出**优先级、现状问题、拟议方案与验收标准**。
- 验收完成后同步更新现行文档并直接删除对应文件；目录清空后不保留占位文件。

## SPA 路由与页面职责

Vue Router 使用 `createWebHistory(import.meta.env.BASE_URL)`，CF 为深链提供 `index.html` 回退；页面地址不是独立 HTML 文件。

| 页面     | 路由 / name                                                    | 页面与职责                                             |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------ |
| 登录     | `/login` / `login`                                             | `views/auth/LoginView.vue`，登录并返回有效目标         |
| 注册     | `/register` / `register`                                       | `views/auth/RegisterView.vue`，注册并返回有效目标      |
| 首页     | `/` / `home`                                                   | `views/home/HomeView.vue`，计划、当前科目及模板入口    |
| 收藏列表 | `/favorites` / `favorites`                                     | `views/favorites/FavoritesView.vue`，独立维护收藏列表  |
| 错题列表 | `/mistakes` / `mistakes`                                       | `views/mistakes/MistakesView.vue`，独立维护错题列表    |
| 普通题集 | `/practice/:paperId` / `practice`                              | `PracticeView`，props 为 `source: practice`、`paperId` |
| 收藏练习 | `/favorites/practice/:groupBy/:groupId` / `favorites-practice` | `PracticeView`，props 为来源、分组和资源 ID            |
| 错题练习 | `/mistakes/practice/:groupBy/:groupId` / `mistakes-practice`   | 同一 `PracticeView`，来源为 `mistakes`                 |

完整路由以 `src/router/index.ts` 为准。`groupBy` 只允许 `subject`、`paper`；静态链接直接写路径，带参数跳转使用路由 name，不另建路径映射层。

已废弃 `LibraryView + module`。收藏和错题各自维护列表请求、筛选、排序、空态及浏览记忆，后续允许独立调整。首页题集、收藏分组、错题分组全部进入 `views/practice/PracticeView.vue`；移除独立 `PaperView` 和 `/papers/:paperId` 预览路由，不保留兼容别名。

## 登录、回跳与历史

- 登录、注册互相切换保留 query 中的 `redirect`。成功后用 `resolveLoginRedirect` 返回有效站内路由；拒绝外链、登录注册循环和未匹配地址，无效时回首页。
- 登录、注册、未找到页公开，其他路由需登录。会话失效先清身份，再跳登录并保存完整目标；已登录访问登录注册页回首页。
- 练习入口写入 `returnTo`，保留入口 query；退出用 `resolvePracticeReturn`。普通练习可返回首页、收藏或错题，集合练习只能返回对应列表，无效值回到来源默认页。
- `returnToPracticeList` 仅在 `history.state.back` 与目标完整匹配时后退；直开或历史不匹配时 replace，避免退到站外、登录或再次作答。
- 来源和分组来自路由 props，不从 query 的 `source` 或 ID 前缀猜测。`subjectName` 仅作展示。

## 考试计划与 Store

报考省份用 API 生成的选项，专业从 `GET /api/options/majors` 按省份和学历读取。范围见 [Client API](client-api.md#当前报考范围)。

统一使用 `exam-plan`，替代 `practice-scope`。接口、类型、Store 分别为 `api/exam-plan.ts`、`types/exam-plan.ts`、`stores/exam-plan.ts`。

- `useExamPlanStore.plan` 保存计划；`load()` 复用已加载结果及进行中的请求，失败可重试；`save()` 成功更新共享状态；`reset()` 清理会话并使旧请求失效。
- `components/exam-plan/ExamPlanPopup.vue` 管理选择和草稿，`ExamPlanCard.vue` 展示摘要，`ExamPlanSubjectsPopup.vue` 发出科目选择、显隐及移动事件，首页管理浏览状态。
- 计划使用 `provinceCode`、`majorCode`、`subjectCodes`。省份或学历变化清空专业及科目，专业变化重新选择科目；仅 `examType === 'written'` 的笔试科目可勾选，非笔试科目在列表中禁用展示；保存失败保留草稿。弹层关闭或换账号后，旧选项与保存响应不能更新当前界面。实践考核科目（`examType === 'practical'`）仅作科目展示，不开放线上练习与 PassIt 画像评估，首页 `HomePracticeResources` 直接展示实践课提示。
- 科目显隐和顺序属于首页浏览记忆，不冒充服务端计划。科目业务码使用完整大写省份前缀。
- `useAuthStore` 管理登录身份，退出或换账号重置考试计划及相关会话 Store。收藏、错题列表不另建 Store，临时状态留在各自页面。

## 首页练习资源与个人科目画像

`HomePracticeResources` 从 `GET /api/practice/resources?subjectCode=<科目码>` 读取当前科目的编排题集。资源类型枚举由 `src/generated/practice-resource-values.ts`（`PracticeResourceType`）生成，前端固定按下表映射 Lucide 图标与主题语义色，不随接口顺序或文案变动：

| 资源类型 (`type`) | 业务含义 | 固定图标 (`@lucide/vue`) | 主题语义色 |
| ----------------- | -------- | ------------------------ | ---------- |
| `baseline`        | 基准能力 | `Target`                 | `primary`  |
| `mockExams`       | 模拟考试 | `Timer`                  | `accent`   |
| `pastExams`       | 历年真题 | `History`                | `info`     |
| `aiEnhance`       | AI 增强  | `Sparkles`               | `ai`       |

- `SubjectProfileCard` 随当前选中笔试科目加载 `GET /api/subjects/:code/profile`，并并行读取 `GET /api/practice/records?subjectCode=` 按上海时区汇总今日、近 7 日与近 30 天练习题量；卡片保持精简块状展示：**`PassIt <分数> 分`**（按 `masteryLevel` 四档采用柔和渐进语义色，不以警告红/黄刺激：`weak` 柔灰 / `aware` 清蓝 / `familiar` 鸢尾主色 / `mastered` 清绿）、`查看详情 ›` 与 2×2 统计块（`题集`、`题量`、`今日练习`、`月累计`）。具体评估明细与手动触发评估统一收敛在 `SubjectEvaluationPopup` 内；`HomePracticeResources` 四类入口不再展示「X 套 / 暂无」数字，单卷掌握度徽章仅在有服务端真实作答后展示。
- `SubjectEvaluationPopup` 承接 Quick Score 学习诊断（`POST /api/subjects/:code/evaluate`）与评估记录分页（`GET /api/subjects/:code/evaluations`，收敛在顶栏左上角「历史」入口，不占正文双 Tab）：正文采用白卡浅底画布自上而下直出展示（不折叠）：① 核心评分卡（`PassIt <分数> 分` + 评估时间 + 2×2 核心量块：`近 7 日刷题`、`近 7 日错题`（暂以 `—` 占位）、`待清错题`、`正确率`，不展示 `readinessLevel` 阶段标签与后端拼接的 `diagnosis.summary` 公式文案；低保鲜度或主观题偏少时仅以柔和单行提示）；② 显眼的「科目训练能力」卡（直出五项水平：基准水平 / 真题水平 / 模拟考试水平 / 查漏补缺水平 / 题型结构水平，只展示柔和四档掌握度标签，`薄弱` 默认柔灰，不显示数值与进度条）；③ 下方「诊断症状」卡（合并展示 `diagnosis.gaps` 差距清单与 `weaknessProfile` 丢分题型、薄弱考点、久未复习考点及反复/易混淆错题数，结合 `profile.pointStats` / `questionTypeStats` 补充历史累计错次）；④ 「提分建议」（`paper` 带 `returnTo` 直跳对应 `paperId` 刷题，`mistakes` 跳转错题本，`aiGenerate` 携带 `enhanceType`、薄弱 `pointKeys` 与 `questionTypes` 调用 `POST /api/subjects/:code/ai-enhance/generate` 生成补强卷后刷新资源与画像并进入练习）；⑤ 「已掌握」优势列表。
- `aiEnhance` 分类提供手动生成（5 类 `aiEnhanceTypes`）与删除私有补强卷（`DELETE /api/subjects/:code/ai-enhance/papers/:paperId`，需二次确认弹窗），操作成功后同步刷新资源列表与科目画像。
- 题集形式字段统一使用 `paperMode: 'bank' | 'exam'`（对应 `src/generated/paper-catalog-values.ts` 的 `PaperMode`）；`mockExams` 与 `pastExams` 列表展示直接透传服务端 `name`，不按 `type` 过滤。

## 收藏、错题与共用内容读取

收藏与错题保持独立路由页面（`FavoritesView` / `MistakesView`），不合回共享列表视图；两页共用的筛选、排序、竞态保护与浏览状态同步收敛在 `composables/useCollectionGroups.ts`，请求仍分别通过 `fetchFavoriteGroups` / `fetchMistakeGroups` 传入，共享排序选项在 `constants/collection.ts`。

- 列表 query 为 `groupBy`、`sort`、`order`，默认按科目、最近收录倒序；query 优先于浏览记忆。失败保留上次成功列表及对应筛选，不能用新分组解释旧列表。
- `openPractice` 按已展示分组取 `subjectId` 或 `paperId`，传入 `groupId` 和 `returnTo`。
- `api/practice-content.ts` 按来源读取内容。集合协议仍用 `subjectId`；普通题集返回 `subjectCode`，适配时查询真实科目 ID，不将业务码塞入 ID 参数。
- 集合每题保留实际科目和来源题集，本地聚合标识不能代替真实 `paperId` 发起收藏/错题操作。`favId` 和 `mistakeId` 按接口各自使用，不混用。

普通练习题集下发 `correctAnswer`、`explanation`，适配层原样保留，供选择题确认后的对错、正确选项及解析展示使用；单选和判断选择即确认，多选点击“确认答案”后反馈。答对自动下一题及错题同步沿用现有设置。普通题集已开启交卷闭环（`canSubmit: true`）：交卷请求 `POST /api/practice/papers/:paperId/submissions` 携带幂等 `submissionId`（`rec` + 12 位十六进制）、`userAnswers` 与耗时 `durationSeconds`（0–86400 秒）；当题集分组存在选答题（`sections[].answerCount < items.length`）时，作答面板与答题卡明示选答规则、交卷确认按各组 `answerCount` 统计必答未答题数，主观自评预计分值按分组最高 `answerCount` 题汇总封顶。报告页读取 `GET /api/practice/papers/:paperId` 与 `GET /api/practice/papers/:paperId/submissions/:submissionId` 展示客观/主观/综合得分与作答明细，存在已作答主观题时支持三档自评（`PUT .../subjective-self-grade`，`mastered=100% / partial=50% / missed=0%`）重算总分并刷新科目画像（已自评后题号状态更新为 `已自评`），并支持交卷后一键触发科目规则评估（`triggerType: 'practice'`）。收藏与错题集合练习保持纯刷题，不开放交卷（`canSubmit: false`）。

## 浏览器存储与账号隔离

| 状态     | 载体与键                                                                             | 隔离及失效                                                     |
| -------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 会话     | localStorage：`passitai:auth-session`                                                | 当前 origin 一份会话，同源标签页同步账号变化                   |
| 外观偏好 | localStorage：`passitai:appearance`                                                  | 设备全局，支持 `system / light / dark`，登出不清理             |
| 刷题设置 | localStorage：`passitai:practice-settings:<userId>`                                  | 按账号隔离，纯本地持久化，登出不清理，重新登录同账号直接恢复   |
| 浏览记忆 | sessionStorage：`passitai:browse:<userId>:<page>`，另有内存兜底                      | 按账号与 `home/favorites/mistakes` 隔离，不保存接口列表和答案  |
| 本地作答 | localStorage：`passitai:practice-record:<userId>:<source>:<paperId>`，ID 经 URL 编码 | 按账号、来源和资源隔离；指纹与账号/单题集清理代际控制恢复/回写 |
| 考试计划 | 当前会话 Store + 服务端计划                                                          | 读取缓存、保存更新、换账号 reset，不另写持久化副本             |

集合本地资源标识为 `collection:<groupBy>:<groupId>`，不是题集 ID。普通题集、收藏、错题即使涉及同题，也不共用答案键。

localStorage 同源共享；sessionStorage 不作为跨标签同步通道，不假定新标签一定为空或与原标签持续同步。身份通过 `storage` 及恢复前台检查；当前标签使用 Store 更新，不依赖自己收到 `storage` 事件。

退出或会话清理会清除该账号本地作答、当前标签浏览记忆并重置 Store。清理作答使用既有作用域和清理代际，不删服务端收藏/错题/报告。已具备跨标签清理失效同步，未实现同题并行编辑合并，不能宣称答案实时协同。

`usePracticeRecord` 防抖保存进度，在页面隐藏、`pagehide`、卸载时尽力保存；仅恢复当前版本且指纹有效的内容。存储受限按现有失败提示处理，不承诺浏览器清理或系统强杀后绝不丢失。

## 滚动与请求竞态

- 首页、收藏、错题由 `useBrowseScroll` 在内容加载后等待 Vue 更新及下一帧再恢复 `window` 滚动位置。离页/`pagehide` 记录位置，未恢复的加载页不能覆盖原位置。
- 其他路由按 Router 历史位置或回顶部，同路径 query 切换不强制置顶。
- `HomePracticeResources` 从 `/api/practice/resources` 读取已编排题集，在 watcher 清理时取消 `AbortController`，signal 传入请求；科目、账号变化及卸载取消旧请求。
- 收藏/错题列表、考试计划弹层、作答加载使用序号、Token、开合或卸载状态检查，忽略迟到响应。不是所有请求均已物理取消，不能只依赖 abort 保证正确性。
- 请求开始固定身份，旧请求成功、失败或 401 不能覆盖新账号。离页清理计时器与监听，主动取消不作为业务失败提示。

## 移动端 H5 边界

已有安全区留白、原生 dialog、题目横滑与纵向滚动区分；不等于所有浏览器均已验证。

业务下拉刷新未接入，也未统一拦截浏览器原生下拉刷新。刷新按页面初始化及本地恢复处理，不能描述成“仅刷新列表”。浏览器/微信返回、前后台恢复与键盘遮挡按维护文档真机验证。

微信和系统浏览器分别验证缓存、返回与存储，不假定共用会话。`pageshow` / BFCache 专项恢复、自动版本更新提示尚未接入，不列为已完成能力。
