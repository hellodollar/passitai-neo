# 客户端维护约定

这是独立开发的小项目。优先让代码容易找到、修改和验证，目录只按现有用途划分。

## 结构

- `src/App.vue`：页面外壳、底栏显示和全局提示。
- `src/main.ts`：启动 Vue、Pinia 和路由。
- `src/router/index.ts`：一份路由表，直接处理登录判断、会话失效和滚动。
- `src/views/`：登录和注册放在 `auth/`，刷题和结果放在 `practice/`；其余页面直接放在此目录。只按实际相关页面分组，不附加多层子目录。
- `src/components/`：组件，沿用 `common`、`auth`、`practice`、`settings` 分组；底栏为 `BottomTabBar.vue`。
- `src/composables/`：响应式逻辑，例如切题、手势、收藏和错题同步。
- `src/api/`、`src/stores/`：接口和共享状态。
- `src/utils/`：按 `practice/`、`auth/`、`browse/` 分组；组内文件使用 `record.ts`、`session.ts` 等直接名称，通用的 `storage.ts` 和 `toast.ts` 保留在根目录。
- `src/types/`、`src/constants/`、`src/assets/`：类型、常量和静态资源。领域取值放在 `constants/domain-values.ts`，与后端保持同步。

组件使用 `PascalCase.vue`，组合式函数使用 `useXxx.ts`，普通模块使用 kebab-case。已有函数能表达清楚的功能直接使用函数；只有明确的重复或独立职责才提取组件和逻辑。

## 页面与路由

| 页面 | 地址 | 文件 |
| --- | --- | --- |
| 首页 | `/` | `HomeView.vue` |
| 刷题 | `/practice/:paperId` | `practice/PracticeView.vue` |
| 刷题结果 | `/practice/:paperId/result/:submissionId` | `practice/PracticeResultView.vue` |
| 收藏、错题 | `/favorites`、`/mistakes` | `QuestionCollectionView.vue` |
| 收藏、错题练习 | `/favorites/practice/:groupBy/:groupId`、`/mistakes/practice/:groupBy/:groupId` | `practice/PracticeView.vue` |
| 我的 | `/me` | `MeView.vue` |
| 登录、注册 | `/login`、`/register` | `auth/LoginView.vue`、`auth/RegisterView.vue` |
| 其他地址 | 未匹配地址 | `NotFoundView.vue` |

静态链接直接写路径，带参数的跳转使用路由自身的 name；不再另设路由名常量或路径映射表。登录、注册和未找到页公开，其余页面需要登录。底栏只在首页、收藏、错题和我的显示，由 `App.vue` 直接判断，不使用自定义路由 meta 或多套布局。

集合练习的 `groupBy` 只接受 `subject` 或 `paper`；来源、分组和资源 ID 通过路由 props 传入。作答页不从 ID 前缀猜测来源，报告 ID 使用路径参数。旧地址和旧导出不提供兼容别名。

## 保留的业务规则

- 登录、注册互相切换时保留 `redirect`；成功后只回跳到真实站内业务页面。安全回跳和练习返回的共用函数在 `utils/browse/navigation.ts`。
- 首页与集合列表的 URL 筛选优先于浏览记忆。记忆按账号和页面保存在 sessionStorage；列表加载完成后恢复滚动，不缓存整页或接口列表。
- 练习通过 `returnTo` 返回首页或对应集合，保留筛选和位置。历史匹配时后退，否则替换当前地址。
- 会话与用户快照由 auth Store 统一管理。登录、注册直接使用返回数据；启动恢复有效会话时查询一次用户，前台恢复、切页和跨标签同步不额外查询用户。
- 页面请求按会话 Token 和加载顺序隔离。切换练习或账号时，旧答案、定时器、收藏 ID 和迟到响应不能进入新页面。
- 接口函数处理协议，共享状态进 Store，弹窗和加载等临时状态留在组件。基础 UI 只通过 props、事件和插槽协作；业务弹窗可以直接调用对应 Store。每次失败只由一个位置提示。
- API 契约以后端为准，见 [客户端 API](client-api.md)。前端错题模块为 `mistakes`，后端 `/wrong-questions`、`wrongQuestionId`、`recordWrongQuestions` 按实际协议使用；生成的领域取值不手改。
- 本地作答与服务端交卷报告独立；只读取当前 v3 记录，详见 [本地做题记录](practice-local-records.md)。本地清理不删除服务端报告、收藏或错题。

## 检查

改完运行类型检查、测试、lint 和生产构建。涉及导航时检查直开与刷新、登录回跳、浏览器后退、练习退出及报告返回；涉及状态时检查换账号、旧请求和本地作答恢复。

目录/科目加载失败的提示方式，以及 API 404 是否显示“练习已失效”，仍按独立的产品改动处理。
