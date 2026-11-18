# 客户端已确认约定

仅记录本轮已确认、已调整的登录注册、考试计划、收藏与错题约定。已有且未改动的实现不补录；后续内容在明确要求记录后再追加。接口字段及请求格式以 [client-api.md](client-api.md) 为准。

## 登录与注册

- 页面分别为 `views/auth/LoginView.vue`、`views/auth/RegisterView.vue`，路由为 `/login`、`/register`。
- 登录和注册互相切换时保留 `redirect`；成功后返回有效的站内目标，无有效目标时进入首页。回跳规则统一使用 `utils/browse/navigation.ts` 的 `resolveLoginRedirect`。
- 受保护页面未登录时跳转登录并保留完整目标；会话失效先清理登录状态，再跳转登录。
- 退出或切换账号时同步重置考试计划状态，旧账号的迟到响应不能写入新会话。

## 考试计划选择

- 统一使用 `exam-plan` 命名，替代 `practice-scope`。
- 接口、状态和类型分别位于 `api/exam-plan.ts`、`stores/exam-plan.ts`、`types/exam-plan.ts`；Store 为 `useExamPlanStore`，当前计划为 `plan`。
- 组件集中在 `components/exam-plan/`：`ExamPlanPopup` 负责选择和保存，`ExamPlanCard` 展示计划摘要，`ExamPlanSubjectsPopup` 管理首页科目的选择、显隐和顺序。
- 计划读取与保存使用 GET / PUT `/practice/exam-plan`，选择结果使用 `provinceCode`、`majorCode`、`subjectCodes`，科目使用带省份前缀的完整业务码。
- 省份、学历变化后清空已选专业及科目，专业变化后重新选择科目；关闭弹层或切换账号后，旧选项请求失效。
- 保存成功更新共享计划；保存失败保留草稿。首页科目显隐和顺序属于浏览状态，与服务端计划选择分开。

## 收藏与错题

| 模块 | 列表路由     | 独立页面                            | 列表加载                                |
| ---- | ------------ | ----------------------------------- | --------------------------------------- |
| 收藏 | `/favorites` | `views/favorites/FavoritesView.vue` | `loadFavorites` → `fetchFavoriteGroups` |
| 错题 | `/mistakes`  | `views/mistakes/MistakesView.vue`   | `loadMistakes` → `fetchMistakeGroups`   |

- 两个列表各自管理请求、筛选、排序、空态和浏览记忆，后续可以独立调整。移除 `LibraryView` 和通过 `module` 切换列表的结构。
- 共享排序选项位于 `constants/collection.ts`；列表临时状态留在各自页面，不单独建立列表 Store。
- 列表支持按科目或题集分组。分组、排序通过 URL 保留，浏览记忆按账号和列表区分；切换失败保留原列表及其已生效的筛选条件。
- 收藏练习路由为 `/favorites/practice/:groupBy/:groupId`，错题练习为 `/mistakes/practice/:groupBy/:groupId`；`groupBy` 只接受 `subject`、`paper`。
- 首页题集、收藏和错题点击后统一进入 `views/practice/PracticeView.vue`。入口可以独立，落地页只有一套，不另设 `PaperView` 预览页。
- 来源、分组和资源 ID 由路由 props 明确传入，`api/practice-content.ts` 负责对应内容读取；不从 ID 前缀推断来源或分组。
- 返回列表时保留分组、排序与滚动位置；切换账号或离页后，旧请求不能覆盖当前列表。
- 收藏、错题接口仍按当前契约使用 `subjectId`，不将业务码直接代入数据 ID；接口约定与前端命名分别维护。
