# Neo 用户端接入手册

本文是 Neo 开发 Banana 用户端时使用的当前接口契约。基础路径为 `/api`，只接受用户端登录签发的
`app` scope JWT。不要调用 `/api/admin`，也不要复用管理后台的 `admin_token`。

> 文档状态：已按当前代码核对。探索期、不明确或尚未落库的接口会明确返回 `placeholder: true`。

## 1. 当前可交付范围

Neo 现在可以直接开发：

- 注册、登录、退出、当前用户信息与 `/api/me` 聚合信息
- Profile、Preferences、Settings 更新占位
- 首页 dashboard 占位统计
- 选择项目接口（专业/科目，统一 `{ id, code, name }`）
- 按科目获取试卷
- 练习计划读取与更新（持久化到用户 preferences）
- 练习入口和练习会话占位
- 题目列表与搜索
- 我的答题记录列表、答题卡列表占位
- 收藏列表占位、新增/合并、删除
- 错题列表占位、新增/合并、删除
- 设置页和修改密码占位

核心业务层级：

```text
专业
└── 科目
    └── 试卷
        └── 题目
```

当前笔果数据只有 `pastExam`（历年真题）分类。试卷名称已经包含科目和年月，例如
“中国近现代史纲要 2015年10月”。

### 接口分类

用户端接口按用途分为两类：

- **业务接口**：承载真实业务数据（鉴权、练习计划、题目/试卷、记录、收藏、错题、设置等），返回各自
  领域模型，见第 4–14 章。
- **选择项目接口**：`/api/options/*`，供页面下拉、多选、回显使用的精简选项，统一返回
  `{ id, code, name }`，见 §6 专业与科目。专业/科目等基础数据也通过此类接口提供给页面选择控件，
  后续新增的同类选择接口都归入此类，与业务接口分离。

## 2. 请求与返回约定

除注册、登录外，请求都应携带：

```http
Authorization: Bearer <app-token>
```

所有接口使用统一返回体：

```ts
export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

export interface PaginationResult<T> {
  items: T[]
  total: number
}
```

前端必须同时判断 HTTP status 和 `code`。`code === 0` 才表示业务成功。分页使用 `page` 与
`limit`，默认 `1` 和 `20`，`limit` 最大为 `100`。

探索期接口减少 body 校验；前端不要依赖未文档化字段，也不要把 `placeholder: true` 的接口当作已经
持久化的真实业务闭环。

### ofetch 基础封装

```ts
import { ofetch } from 'ofetch'

export const userApi = ofetch.create({
  baseURL: '/api',
  async onRequest({ options }) {
    const token = localStorage.getItem('app_token')
    if (token) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      }
    }
  },
  async onResponse({ response }) {
    const body = response._data as ApiResponse<unknown> | undefined

    if (response.status === 401) {
      localStorage.removeItem('app_token')
      // 跳转登录页
      return
    }
    if (response.status === 403) {
      // 通常是误用了 admin scope token
      throw body
    }
    if (body && body.code !== 0) {
      throw body
    }
  },
  async onResponseError({ response }) {
    throw response._data || response
  },
})
```

登录失败当前返回 `HTTP 400`，不要把所有登录失败都按 `401` 处理。`401` 用于 token 缺失、过期、
无效或已登出。

## 3. 枚举

```ts
export type UserRole = 'admin' | 'user'
export type DataStatus = 'enabled' | 'disabled'
export type CreatedBy = 'system' | 'user' | 'ai'

export type QuestionType = 'single' | 'multiple' | 'judge' | 'shortAnswer' | 'essay'
export type QuestionCategory = 'pastExam' | 'practice' | 'mock'
export type PaperType = 'pastExam' | 'practice' | 'mock'
export type RecordStatus = 'notStarted' | 'inProgress' | 'completed'
```

用户端题目、试卷、专业、科目接口只返回 `enabled` 数据，前端不需要传 `status`。

## 4. 鉴权与用户

### 注册

```http
POST /api/register
Content-Type: application/json
```

```ts
interface AuthBody {
  email: string
  password: string // 6-20 位
}
```

### 登录

```http
POST /api/login
Content-Type: application/json
```

Body 与注册相同。注册和登录成功都返回：

```ts
interface AuthResult {
  token: string
  user: {
    id: string
    email: string
    role: UserRole
    createdAt: string
  }
}
```

将 `token` 保存为 `app_token`。

### 当前用户

```http
GET /api/user
```

返回 `AuthResult['user']`。

### 当前用户聚合信息

```http
GET /api/me
```

一次性返回用户端「我的/设置」页面需要展示的信息。`preferences` 是三个子接口的投影：

```ts
interface UserMe {
  user: AuthResult['user'] & { status: DataStatus }
  preferences: {
    plan: {
      majorName: string
      majorCode: string
      subjects: { name: string; code: string }[]
    }
    practice: {
      autoNext: boolean
      recordWrongQuestions: boolean
      showExplanationAfterAnswer: boolean
      loopAfterCompletion: boolean
      autoSubmitAfterCompletion: boolean
    }
    notifications: {
      dailyReminder: boolean
      reminderTime: string
      weeklyReport: boolean
    }
  }
}
```

- `preferences.plan` 等价于 `GET /api/practice/plan`。
- `preferences.practice` 等价于 `GET /api/practice/settings`。
- `preferences.notifications` 等价于 `GET /api/notifications`。
- 三者的数据统一存储在用户表的 `preferences` 字段（`{ plan, practice, notifications }`），
  `/api/me` 只是聚合投影，不额外持久化。

### 退出

```http
POST /api/logout
Authorization: Bearer <app-token>
```

成功后无论 `data` 是否为空，都应立即清理本地 `app_token`。

## 5. Profile

```http
GET /api/profile
PUT /api/profile
PATCH /api/profile
```

`GET` 返回真实用户基础字段，以及占位 profile 字段：

```ts
interface UserProfile {
  id: string
  email: string
  role: UserRole
  createdAt: string
  displayName: string
  avatarUrl: string
  bio: string
  examGoal: string
  placeholder: true
  persisted: false
}
```

新开发优先使用 `PATCH /api/profile`。`PUT /api/profile` 仅保留旧联调兼容。当前只接收并回显以下字段，
不写入数据库：

```ts
interface UpdateProfileBody {
  displayName?: string
  avatarUrl?: string
  bio?: string
  examGoal?: string
}
```

## 6. 专业与科目

专业与科目基础数据统一通过选择项目接口提供给页面，返回精简的 `{ id, code, name }`。

```http
GET /api/options/majors?id=&code=&ids=&codes=
GET /api/options/subjects?majorId=&id=&code=&ids=&codes=
```

返回 `OptionItem[]`：

```ts
interface OptionItem {
  id: string
  code: string
  name: string
}
```

- 只返回启用且未删除的数据，字段固定为 `{ id, code, name }`，不返回其他业务字段。
- 过滤参数：`id` / `code` 为单个值；`ids` / `codes` 为逗号分隔的多个值。同时传入时单个参数优先。
  - 例：`/api/options/subjects?ids=sub_aaa,sub_bbb`、`/api/options/majors?code=120206`
- `GET /api/options/subjects` 额外支持 `majorId`，用于取某专业下的科目。
  - 例：`/api/options/subjects?majorId=maj_xxx`
- 选择项目接口是后续同类接口（试卷、题目等）的统一形态：页面选择统一走 `/api/options/*`，
  与业务接口分离。

## 7. 首页 Dashboard

```http
GET /api/dashboard
```

当前为占位统计：

```ts
interface DashboardSummary {
  placeholder: true
  todayStats: {
    answeredCount: number
    wrongCount: number
    favoriteCount: number
    paperCount: number
  }
  subjectProgress: {
    subjectId: string
    subjectName: string
    totalPapers: number
    completedPapers: number
    progress: number
    accent: string
  }[]
  topWrongQuestions: {
    qid: string
    title: string
    wrongCount: number
    subjectName: string
  }[]
  weeklyVolume: number[]
}
```

不要把这些数字作为真实学习统计。

## 8. 练习 Practice

```http
GET  /api/practice
GET  /api/practice/plan
PUT  /api/practice/plan
GET  /api/practice/entries
GET  /api/practice/answer-sheet
GET  /api/practice/settings
PATCH  /api/practice/settings
POST /api/practice/sessions
GET  /api/practice/sessions/:id
```

### 练习计划

练习计划是当前用户已保存的「专业 + 自选科目」，持久化在用户表的 `preferences.plan` 字段中。

```http
GET /api/practice/plan
```

```ts
interface PracticePlan {
  majorName: string
  majorCode: string
  subjects: {
    name: string
    code: string
  }[]
}
```

- `subjects` 只包含用户自己选择的科目，**未选择时为空数组**；选择一个返回一个，选择两个返回两个。
- 不会返回该专业下的全部科目（那是基础数据，供选择用，见 `/api/options/*`）。
- 返回顺序与用户选择顺序一致。
- 未设置计划、或所选专业已被删除时，回退到默认的「人力资源管理」专业及其两个默认科目。

```http
PUT /api/practice/plan
Content-Type: application/json
```

```ts
interface UpdatePracticePlanBody {
  majorId: string
  majorCode?: string
  subjectIds?: string[]
}
```

- `majorId` 必填，必须指向存在的专业（未删除），否则返回 `code: 4001`（资源不存在，HTTP 404）。
- `subjectIds` 是用户选择的科目 ID 数组，可为空或省略；服务端只保存这些选择，并忽略不属于该专业的科目。
- `majorCode` 可选，服务端以专业实际 `code` 为准。
- 更新成功后返回与 `GET /api/practice/plan` 相同的 `PracticePlan`。

### 科目练习入口

```http
GET /api/practice/entries?code=<subject-code>
```

根据科目 `code` 返回该科目的练习入口列表（训练章节）。当前为 mock 数据，数据来源与存储表待补充：

```ts
interface PracticeEntry {
  type: 'practice' | 'pastExam' | 'mock' | 'ai' | string
  name: string
  description: string
  questionCount: number
  answeredCount: number
  children?: {
    paperId: string
    name: string
    questionCount: number
    answeredCount: number
  }[]
}
```

固定四类入口：

- `practice` 专项训练：带 `children`，展开题集（考点通练、高频考点、易错强化）。
- `pastExam` 历年真题：带 `children`，展开历年真题卷。
- `mock` 考前模拟：带 `children`，展开系统后台生成的通用标准模拟卷。
- `ai` AI训练：不带 `children`，点击后弹出模态框选择配置（规划中），确定后生成对应 AI 练习题。

`description` 是入口的简短说明，供页面副标题展示。带 `children` 的入口点击后展开选择题集；不带
`children` 的入口按 `type` 决定交互（当前仅 `ai`）。

### 答题卡

```http
GET /api/practice/answer-sheet?paperId=<paper-id>
```

根据试卷 `paperId` 返回答题卡信息（含题目、正确答案、用户作答与解析）。当前为 mock 数据，数据来源与
存储表待补充：

```ts
interface PracticeAnswerSheet {
  paperName: string
  recordStatus: 'notStarted' | 'inProgress' | 'completed' | string
  score: number
  questionGroups: {
    type: 'single' | 'multiple' | 'judge' | 'shortAnswer' | 'essay' | string
    label: string
    items: {
      id: string
      title: string
      questionType: string
      A: string | null
      B: string | null
      C: string | null
      D: string | null
      E: string | null
      F: string | null
      correctAnswer: string
      userAnswer: string | null
      explanation: string | null
    }[]
  }[]
}
```

- `questionGroups` 按题型分组，`type` 为题型，`label` 为分组标题（如「单选题」「多选题」）。
- 选择题返回 `A`~`F` 选项（非选择题为 `null`）；多选题 `correctAnswer` 为逗号分隔，如 `A,B,C`。
- `userAnswer` 为当前用户作答，未作答为 `null`；`score` 为得分，进行中通常为 `0`。

### 练习设置

```http
GET /api/practice/settings
PATCH /api/practice/settings
Content-Type: application/json
```

当前持久化在用户表的 `preferences.practice` 中，未设置时返回默认值：

```ts
interface PracticeSettings {
  autoNext: boolean
  recordWrongQuestions: boolean
  showExplanationAfterAnswer: boolean
  loopAfterCompletion: boolean
  autoSubmitAfterCompletion: boolean
}
```

默认值：

```json
{
  "autoNext": false,
  "recordWrongQuestions": true,
  "showExplanationAfterAnswer": true,
  "loopAfterCompletion": false,
  "autoSubmitAfterCompletion": false
}
```

`PATCH` 接收以上字段（可部分更新），返回合并后的 `PracticeSettings` 并写入 `preferences.practice`。

### 练习入口

`GET /api/practice` 返回练习入口配置占位：

```ts
interface PracticeOverview {
  placeholder: true
  defaultMode: 'paper'
  modes: {
    key: 'paper' | 'multi-paper' | 'subject' | string
    name: string
    enabled: boolean
  }[]
  hints: {
    paperListApi: string
    questionListApi: string
  }
}
```

`POST /api/practice/sessions` 当前可传任意探索期 body，建议先传：

```ts
interface CreatePracticeSessionBody {
  mode?: 'paper' | 'multi-paper' | 'subject' | string
  paperId?: string
  paperIds?: string[]
}
```

返回：

```ts
interface PracticeSession {
  id: string
  userId: string
  mode: string
  paperIds: string[]
  status: 'notStarted'
  placeholder: true
  persisted: false
  createdAt?: string
  questions?: unknown[]
}
```

真实做题、保存进度、提交、评分尚未实现。当前 Neo 可以继续用
`GET /api/questions?paperId=<paper-id>` 展示题目列表投影。

## 9. 题目

```http
GET /api/questions
```

Query：

```ts
interface QuestionListQuery {
  page?: number
  limit?: number
  keyword?: string
  subjectId?: string
  paperId?: string
  createdBy?: CreatedBy
}
```

返回 `PaginationResult<QuestionListItem>`：

```ts
interface QuestionListItem {
  id: string
  subjectId: string
  title: string
  questionType: QuestionType
  questionCategory: QuestionCategory
  status: 'enabled'
  createdBy: CreatedBy
  createdAt: string
}
```

注意：

- 这是列表投影，不返回选项、正确答案和解析。
- `paperId` 会按试卷中保存的题目顺序范围筛选，但当前接口的最终排序仍是题目创建时间倒序。
- 不支持 `questionCategory` query；当前用户端数据可按返回字段在前端展示分类。

## 10. 试卷 Papers

```http
GET /api/papers
```

Query：

```ts
interface PaperListQuery {
  page?: number
  limit?: number
  keyword?: string
  subjectId?: string
  paperType?: PaperType
  createdBy?: CreatedBy
}
```

返回 `PaginationResult<PaperListItem>`：

```ts
interface PaperListItem {
  id: string
  subjectId: string
  name: string
  paperType: PaperType
  status: 'enabled'
  createdBy: CreatedBy
  createdAt: string
}
```

获取某科目下的卷子使用 `GET /api/papers?subjectId=<subject-id>`。列表不返回 `sections`。当前可以用
`GET /api/questions?paperId=<paper-id>` 获取该卷关联的题目列表，但由于题目详情接口尚未提供，这个
结果暂时只适合目录/摘要展示。

## 11. 我的答题记录

```http
GET /api/records?page=1&limit=20&keyword=
```

服务端强制使用 JWT 中的当前用户 ID，忽略前端传入的 `userId`。

```ts
interface RecordListItem {
  id: string
  userId: string
  paperName: string
  recordStatus: RecordStatus
  score: number | null
}
```

返回 `PaginationResult<RecordListItem>`。当前只有列表读取接口。

### 答题卡列表

```http
GET /api/answer-sheets?page=1&limit=20&paperId=&status=
```

这是面向用户端做题场景的独立列表接口，不复用管理端记录列表形状。当前返回标准空列表占位：

```ts
interface AnswerSheetListItem {
  id: string
  paperId: string
  paperName: string
  status: string
  answeredCount: number
  totalCount: number
  updatedAt?: string | null
  createdAt: string
}
```

当前响应：

```json
{ "total": 0, "items": [] }
```

## 12. 收藏

```http
GET    /api/favorites?page=1&limit=20&subjectId=
GET    /api/favorites/:id
POST   /api/favorites
DELETE /api/favorites/:id
```

`GET /api/favorites` 当前作为用户端学习页占位，只返回标准空列表：

```json
{ "total": 0, "items": [] }
```

保存和删除接口仍保留当前实现。收藏按“当前用户 + 科目”聚合，不是一道题一条数据库记录。

```ts
interface FavoriteQuestion {
  qid: string
  title: string
}

interface SaveFavoriteBody {
  subjectId: string
  subjectName: string
  questions: FavoriteQuestion[] // 至少 1 条
}

interface Favorite extends SaveFavoriteBody {
  id: string
  userId: string
  total: number
  createdAt: string
  updatedAt?: string | null
}
```

重复提交同一 `qid` 会保留一条并更新标题。删除参数是聚合记录的 `Favorite.id`，不是题目 ID。

## 13. 错题

```http
GET    /api/wrong-questions?page=1&limit=20&subjectId=
GET    /api/wrong-questions/:id
POST   /api/wrong-questions
DELETE /api/wrong-questions/:id
```

`GET /api/wrong-questions` 当前作为用户端学习页占位，只返回标准空列表：

```json
{ "total": 0, "items": [] }
```

保存和删除接口仍保留当前实现。错题同样按“当前用户 + 科目”聚合：

```ts
interface WrongQuestionItem {
  qid: string
  title: string
  count: number // 至少 1
  userAnswer: string | string[]
}

interface SaveWrongQuestionBody {
  subjectId: string
  subjectName: string
  wrongList: WrongQuestionItem[] // 至少 1 条
}

interface WrongQuestion extends SaveWrongQuestionBody {
  id: string
  userId: string
  total: number
  createdAt: string
  updatedAt?: string | null
}
```

重复提交同一 `qid` 时 `count` 会累加，`userAnswer` 更新为最近一次答案。删除参数是聚合记录的
`WrongQuestion.id`。

## 14. 设置 Settings

```http
GET   /api/settings
PATCH /api/preferences
PATCH /api/settings
PATCH /api/settings/practice
PUT   /api/settings/password
```

`PATCH /api/preferences` 当前回显偏好设置占位，不写入数据库：

```ts
interface UserPreferences {
  userId: string
  placeholder: true
  persisted: false
  study: {
    dailyGoal: number
    defaultMode: 'paper' | string
    questionOrder: 'paper' | string
    autoNext: boolean
    showAnswerAfterSubmit: boolean
  }
  notifications: {
    dailyReminder: boolean
    reminderTime: string
    weeklyReport: boolean
  }
  display: {
    theme: 'system' | string
    compactMode: boolean
  }
}
```

`GET /api/settings` 和 `PATCH /api/settings` 当前返回账号设置占位：

```ts
interface UserSettings {
  userId: string
  placeholder: true
  persisted: false
  practice: {
    dailyGoal: number
    questionOrder: 'paper' | string
    autoNext: boolean
    showAnswerAfterSubmit: boolean
  }
  account: {
    emailChangeEnabled: false
    passwordChangeEnabled: false
  }
  privacy: {
    profileVisibility: 'private' | string
    showLearningStats: boolean
  }
  security: {
    activeSessions: unknown[]
  }
}
```

`PATCH /api/settings/practice` 是旧练习设置路径，会合并并回显 body，但不写入数据库。`PUT
/api/settings/password` 当前不修改真实密码，返回：

```ts
interface PasswordChangePlaceholder {
  userId: string
  changed: false
  placeholder: true
  persisted: false
}
```

### 通知设置

```http
GET   /api/notifications
PATCH /api/notifications
Content-Type: application/json
```

持久化在用户表的 `preferences.notifications` 中，未设置时返回默认值：

```ts
interface NotificationSettings {
  dailyReminder: boolean
  reminderTime: string
  weeklyReport: boolean
}
```

默认值：

```json
{
  "dailyReminder": false,
  "reminderTime": "",
  "weeklyReport": false
}
```

`PATCH` 接收以上字段（可部分更新），返回合并后的 `NotificationSettings` 并写入
`preferences.notifications`。

## 15. 页面与接口映射

### 业务接口

| 用户端页面         | 使用接口                                             | 当前状态               |
| ------------------ | ---------------------------------------------------- | ---------------------- |
| 注册 / 登录        | `POST /register`, `POST /login`                      | 可直接开发             |
| 我的 / 当前用户    | `GET /me`, `GET /user`, `POST /logout`               | 聚合信息占位           |
| Profile            | `GET /profile`, `PUT/PATCH /profile`                 | 读取基础信息，更新占位 |
| 首页               | `GET /dashboard`                                     | 占位统计               |
| 题库列表           | `GET /papers?subjectId=`                             | 可直接开发             |
| 真题卷列表         | `GET /papers`                                        | 可直接开发             |
| 试卷题目目录       | `GET /questions?paperId=`                            | 只能展示列表字段       |
| 练习计划           | `GET /practice/plan`, `PUT /practice/plan`           | 已持久化到用户偏好     |
| 科目练习入口       | `GET /practice/entries?code=`                        | mock 数据              |
| 答题卡             | `GET /practice/answer-sheet?paperId=`                | mock 数据              |
| 练习设置           | `GET /practice/settings`, `PATCH /practice/settings` | 已持久化到用户偏好     |
| 通知设置           | `GET /notifications`, `PATCH /notifications`         | 已持久化到用户偏好     |
| 练习入口           | `GET /practice`, `POST /practice/sessions`           | 会话占位               |
| 我的记录 / 答题卡  | `GET /records`, `GET /answer-sheets`                 | 记录列表 + 答题卡占位  |
| 收藏               | `GET /favorites`                                     | 空列表占位             |
| 错题               | `GET /wrong-questions`                               | 空列表占位             |
| 设置               | `PATCH /preferences`, `GET/PATCH /settings`          | 占位                   |
| 修改密码           | `PUT /settings/password`                             | 占位，不修改真实密码   |
| 做题 / 交卷 / 评分 | 无真实接口                                           | 等待服务端补充         |

### 选择项目接口

| 用途     | 使用接口                         | 当前状态   |
| -------- | -------------------------------- | ---------- |
| 专业选项 | `GET /options/majors`            | 可直接开发 |
| 科目选项 | `GET /options/subjects?majorId=` | 可直接开发 |

## 16. 当前服务端缺口

以下能力在管理端 service 中可能存在相关逻辑，但**没有作为真实用户端 `/api` 能力开放**。Neo 不要
猜测路径，也不要调用 `/api/admin` 绕过：

1. Profile 字段持久化。
2. 首页真实学习统计。
3. 题目详情（选项，不应提前暴露正确答案和解析）。
4. 试卷详情及稳定的试题顺序/分组。
5. 开始答题、保存进度、提交试卷、评分。
6. 答题记录详情。
7. 从收藏或错题聚合中删除单个题目的接口。
8. 用户端设置持久化与真实修改密码。

这些接口补齐前，Neo 可以先完成应用壳、鉴权、目录、列表、筛选、收藏、错题、记录列表和占位页面；
做题闭环不要用前端 mock 冒充真实接口。

## 17. Neo 对接检查清单

- API base URL 使用 `/api`，开发代理指向 Banana API 的 `http://127.0.0.1:8787`。
- token key 使用 `app_token` 或 Neo 自己的用户端 session key，不要使用 `admin_token`。
- 页面刷新后先调用 `GET /api/user` 恢复会话。
- 所有分页空态以 `data.items.length === 0` 判断，总数使用 `data.total`。
- 统一处理 `401` 清 token、`403` 提示 token scope 错误、`code !== 0` 展示 `message`。
- 列表类型只按本文档声明字段使用，不假设接口会返回完整数据库对象。
- 对 `placeholder: true` 的能力保留明确的 disabled/coming-soon 状态，不自行拼接管理端接口。
