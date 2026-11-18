# H5 前端契约

记录已确认的登录注册、考试计划、收藏、错题和共用作答入口，以及必要的浏览器状态与导航规则。其他页面不扩写业务约定；后续明确确认后再补充。

HTTP 见 [client-api.md](client-api.md)，数据语义见 [data-model.md](data-model.md)，发布、CDN 和兼容性排查见 [client-maintenance.md](client-maintenance.md)。

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

统一使用 `exam-plan`，替代 `practice-scope`。接口、类型、Store 分别为 `api/exam-plan.ts`、`types/exam-plan.ts`、`stores/exam-plan.ts`。

- `useExamPlanStore.plan` 保存计划；`load()` 复用已加载结果及进行中的请求，失败可重试；`save()` 成功更新共享状态；`reset()` 清理会话并使旧请求失效。
- `components/exam-plan/ExamPlanPopup.vue` 管理选择和草稿，`ExamPlanCard.vue` 展示摘要，`ExamPlanSubjectsPopup.vue` 发出科目选择、显隐及移动事件，首页管理浏览状态。
- 计划使用 `provinceCode`、`majorCode`、`subjectCodes`。省份或学历变化清空专业及科目，专业变化重新选择科目；仅 `examType === 'written'` 的笔试科目可勾选，非笔试科目在列表中禁用展示；保存失败保留草稿。弹层关闭或换账号后，旧选项与保存响应不能更新当前界面。
- 科目显隐和顺序属于首页浏览记忆，不冒充服务端计划。科目业务码使用完整大写省份前缀。
- `useAuthStore` 管理登录身份，退出或换账号重置考试计划及相关会话 Store。收藏、错题列表不另建 Store，临时状态留在各自页面。

## 收藏、错题与共用内容读取

列表分别使用 `loadFavorites → fetchFavoriteGroups`、`loadMistakes → fetchMistakeGroups`，共享排序选项在 `constants/collection.ts`，不再合回共享列表视图。

- 列表 query 为 `groupBy`、`sort`、`order`，默认按科目、最近收录倒序；query 优先于浏览记忆。失败保留上次成功列表及对应筛选，不能用新分组解释旧列表。
- `openPractice` 按已展示分组取 `subjectId` 或 `paperId`，传入 `groupId` 和 `returnTo`。
- `api/practice-content.ts` 按来源读取内容。集合协议仍用 `subjectId`；普通题集返回 `subjectCode`，适配时查询真实科目 ID，不将业务码塞入 ID 参数。
- 集合每题保留实际科目和来源题集，本地聚合标识不能代替真实 `paperId` 发起收藏/错题操作。`favId` 和 `mistakeId` 按接口各自使用，不混用。

当前普通题集只下发题干和选项，可本机保存作答；无答案时显示已答，不伪造判分。内容适配器当前返回 `canSubmit: false`，新版交卷与报告尚未对接；已有报告路由和旧实现不代表新版闭环完成。

## 浏览器存储与账号隔离

| 状态     | 载体与键                                                                                | 隔离及失效                                                    |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 会话     | localStorage：`passitai:auth-session`                                                   | 当前 origin 一份会话，同源标签页同步账号变化                  |
| 浏览记忆 | sessionStorage：`passitai:browse:<userId>:<page>`，另有内存兜底                         | 按账号与 `home/favorites/mistakes` 隔离，不保存接口列表和答案 |
| 本地作答 | localStorage：`passitai:practice-record:v3:<userId>:<source>:<paperId>`，ID 经 URL 编码 | 按账号、来源和资源隔离；指纹与清理代际控制恢复/回写           |
| 考试计划 | 当前会话 Store + 服务端计划                                                             | 读取缓存、保存更新、换账号 reset，不另写持久化副本            |

集合本地资源标识为 `collection:<groupBy>:<groupId>`，不是题集 ID。普通题集、收藏、错题即使涉及同题，也不共用答案键。

localStorage 同源共享；sessionStorage 不作为跨标签同步通道，不假定新标签一定为空或与原标签持续同步。身份通过 `storage` 及恢复前台检查；当前标签使用 Store 更新，不依赖自己收到 `storage` 事件。

退出或会话清理会清除该账号本地作答、当前标签浏览记忆并重置 Store。清理作答使用既有作用域和清理代际，不删服务端收藏/错题/报告。已具备跨标签清理失效同步，未实现同题并行编辑合并，不能宣称答案实时协同。

`usePracticeRecord` 防抖保存进度，在页面隐藏、`pagehide`、卸载时尽力保存；仅恢复当前版本且指纹有效的内容。存储受限按现有失败提示处理，不承诺浏览器清理或系统强杀后绝不丢失。

## 滚动与请求竞态

- 首页、收藏、错题由 `useBrowseScroll` 在内容加载后等待 Vue 更新及下一帧再恢复 `window` 滚动位置。离页/`pagehide` 记录位置，未恢复的加载页不能覆盖原位置。
- 其他路由按 Router 历史位置或回顶部，同路径 query 切换不强制置顶。
- `HomePracticeTemplates` 在 watcher 清理时取消 `AbortController`，signal 传入请求；科目、账号变化及卸载取消旧请求。
- 收藏/错题列表、考试计划弹层、作答加载使用序号、Token、开合或卸载状态检查，忽略迟到响应。不是所有请求均已物理取消，不能只依赖 abort 保证正确性。
- 请求开始固定身份，旧请求成功、失败或 401 不能覆盖新账号。离页清理计时器与监听，主动取消不作为业务失败提示。

## 移动端 H5 边界

已有安全区留白、原生 dialog、题目横滑与纵向滚动区分；不等于所有浏览器均已验证。

业务下拉刷新未接入，也未统一拦截浏览器原生下拉刷新。刷新按页面初始化及本地恢复处理，不能描述成“仅刷新列表”。浏览器/微信返回、前后台恢复与键盘遮挡按维护文档真机验证。

微信和系统浏览器分别验证缓存、返回与存储，不假定共用会话。`pageshow` / BFCache 专项恢复、自动版本更新提示尚未接入，不列为已完成能力。
