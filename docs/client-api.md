# Neo 客户端 API

本文是 Neo 客户端接入的唯一接口契约。基础路径为 `/api`，仅接受客户端登录签发的 `app` scope
JWT。除注册、登录外，所有接口都需要：

```http
Authorization: Bearer <app-token>
```

## 1. 通用约定

统一返回体：

```ts
interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

interface PaginationResult<T> {
  items: T[]
  total: number
}
```

`code === 0` 表示成功。分页参数默认 `page=1&limit=20`，`limit` 最大为 `100`。

接口只划分为以下六个模块。本文未列出的其他 `/api` 客户端路径均不存在，不应调用。标记为“占位”的
接口只用于固定路径和基础入参，暂不执行真实业务写入。

## 2. 用户模块

| Method  | Path                               | 说明               | 状态 |
| ------- | ---------------------------------- | ------------------ | ---- |
| `POST`  | `/api/register`                    | 用户注册           | 可用 |
| `POST`  | `/api/login`                       | 用户登录           | 可用 |
| `POST`  | `/api/logout`                      | 用户登出，必须鉴权 | 可用 |
| `GET`   | `/api/user`                        | 获取用户基础信息   | 可用 |
| `GET`   | `/api/me`                          | 获取用户聚合信息   | 可用 |
| `PUT`   | `/api/user/password`               | 修改密码           | 可用 |
| `PUT`   | `/api/user/email`                  | 修改邮箱           | 可用 |
| `GET`   | `/api/user/settings/notifications` | 获取通知开关配置   | 可用 |
| `PATCH` | `/api/user/settings/notifications` | 更新通知开关       | 可用 |

### 注册与登录

```ts
interface AuthBody {
  email: string
  password: string // 6-20 位，须同时包含字母和数字
}

interface RegisterBody extends AuthBody {
  inviteCode?: string // 选填；填写时须 6-8 位，否则 1002
}
```

注册邀请码第一阶段固定为 `taikula`：

- 未填写（缺失或为空）：通过参数校验，注册失败返回 `code: 2005`（邀请码无效）。
- 填写但长度不在 6-8 位：参数校验失败返回 `code: 1002`（邀请码长度需在6-8位之间）。
- 填写且长度合法但不为 `taikula`：注册失败返回 `code: 2005`（邀请码无效）。

前端约定：不填写邀请码允许直接提交（由服务端返回 2005）；填写时前端先做 6-8 位长度校验。

注册与登录成功返回：

```ts
interface AuthResult {
  token: string
  user: {
    id: string
    email: string
    role: 'admin' | 'user'
    createdAt: string
  }
}
```

### 用户基础信息与聚合信息

`GET /api/user` 返回 `AuthResult['user']`。

`GET /api/me` 返回：

```ts
interface UserMe {
  user: AuthResult['user'] & { status: 'enabled' | 'disabled' }
  preferences: {
    plan: PracticePlan
    practice: PracticeSettings
    notifications: NotificationSettings
  }
}
```

### 修改密码与邮箱

```ts
interface ChangePasswordBody {
  currentPassword: string
  newPassword: string
}

interface ChangeEmailBody {
  password: string
  newEmail: string
}
```

- `PUT /api/user/password`：校验当前密码后更新为新密码，成功返回 `{ userId, changed: true }`。当前密码
  错误返回 `code: 2001`；新密码与当前密码相同返回 `code: 1000`。
- `PUT /api/user/email`：校验登录密码并确保新邮箱未被占用后更新，成功返回 `{ userId, email }`。邮箱
  已存在返回 `code: 2003`（HTTP 409）。

### 通知开关

```ts
interface NotificationSettings {
  dailyReminder: boolean
  reminderTime: string
  weeklyReport: boolean
}
```

`PATCH` 接受以上字段的任意子集，并写入当前用户的 `preferences.notifications`。

## 3. 学习计划模块

学习计划属于用户顶层配置，不属于练习子资源。

| Method | Path        | 说明             | 状态 |
| ------ | ----------- | ---------------- | ---- |
| `GET`  | `/api/plan` | 获取当前学习计划 | 可用 |
| `PUT`  | `/api/plan` | 更新当前学习计划 | 可用 |

```ts
interface PracticePlan {
  majorName: string
  majorCode: string
  educationLevel: '本科' | '专科' // 来自 majors.educationLevel
  nextExamDate: string | null // 来自 majors.nextExamDate，YYYY-MM-DD
  subjects: {
    name: string
    code: string
  }[]
}

interface UpdatePracticePlanBody {
  majorId: string
  majorCode?: string
  subjectIds?: string[]
}
```

计划存储在当前用户的 `preferences.plan`。`majorId` 必须指向存在且未删除的专业，否则返回资源不存在。
`educationLevel`、`nextExamDate` 均从所选专业读取。

用户未设置计划（新用户）、专业不存在或已删除时，`GET /api/plan` 返回 `data: null`，`/api/me` 的
`preferences.plan` 同样为 `null`；需先调用 `PUT /api/plan` 手动设置计划。

## 4. 练习模块

- `paper`：固定的试卷资源。
- `record`：用户的一次练习记录。
- `entries`：按科目获取的练习入口和可刷试卷列表。

| Method  | Path                                                          | 说明                           | 状态     |
| ------- | ------------------------------------------------------------- | ------------------------------ | -------- |
| `GET`   | `/api/practice/settings`                                      | 获取练习全局配置               | 可用     |
| `PATCH` | `/api/practice/settings`                                      | 修改练习全局配置               | 可用     |
| `GET`   | `/api/practice/entries?subjectId=sub_xxx`                     | 获取该科目下的练习入口         | 部分可用 |
| `GET`   | `/api/practice/papers/:paperId`                               | 获取题集内容及最近真实练习记录 | 可用     |
| `POST`  | `/api/practice/papers/:paperId/submissions`                   | 交卷并创建练习记录             | 可用     |
| `GET`   | `/api/practice/papers/:paperId/submissions/:submissionId`    | 获取本次交卷记录               | 可用     |

### 练习设置

```ts
interface PracticeSettings {
  autoNext: boolean
  recordWrongQuestions: boolean
  showExplanationAfterAnswer: boolean
  loopAfterCompletion: boolean
  autoSubmitAfterCompletion: boolean
}
```

`PATCH` 接受部分字段，并写入当前用户的 `preferences.practice`。

### 练习入口

`subjectId` 必填。固定返回 `baseline`（专项训练）、`pastExam`（历年真题）、`mock`（考前模拟）、
`ai`（AI训练）四个入口；`type` 与题集 `type` 使用同一组取值。

`pastExam`、`mock`、`ai` 的 `children` 分别来自该科目下同类型、启用且未删除的题集，只包含平台题集
或当前用户自己的题集。每个子项返回 `{ paperId, name, questionCount, answeredCount }`，其中
`questionCount` 为题集 `sections` 内全部题目数之和，`answeredCount` 暂为 `0`；父项的
`questionCount` 为全部子项之和。父项 `name`、`description` 和 `answeredCount` 保持现有固定值，
没有匹配题集时 `children` 为 `[]`、`questionCount` 为 `0`。

`baseline`（专项训练）的 `children` 来自该科目 `type=baseline` 的题集，按 `assessmentType`
映射为固定子项（顺序固定，子项名取配置文案，`paperId` 为该组第一个题集）：

| assessmentType  | 子项名   | 说明                           |
| --------------- | -------- | ------------------------------ |
| `overall`       | 考点通练 | 按大纲全面覆盖，逐考点建立基准 |
| `highFrequency` | 高频考点 | 聚焦历年高频考点，优先突破重点 |
| `errorProne`    | 易错强化 | 针对易错点定向强化，查漏补缺   |

baseline 子项额外返回 `assessmentType` 字段（取值见上表），供客户端做差异化展示；
该科目缺少某 `assessmentType` 的 baseline 题集时跳过对应子项。四类入口的作答进度尚未接入练习记录。

### 题集详情与最近练习记录

`paperId` 为路径参数。只能读取启用且未删除的平台题集或当前用户自己的题集。返回结构：

```ts
type QuestionType = 'single' | 'multiple' | 'judge' | 'nounExplain' | 'shortAnswer' | 'essay'

interface PracticePaperDetail {
  paper: {
    id: string
    name: string
    subjectId: string
    type: 'baseline' | 'pastExam' | 'mock' | 'ai'
    assessmentType: string
    questionCount: number
    sections: PracticePaperSection[]
  }
  favoriteQuestionIds: string[]
  latestRecord: {
    id: string
    recordStatus: 'notStarted' | 'inProgress' | 'completed'
    userAnswers: Record<string, string | string[]>
    score: number | null
    startTime: string | null
    endTime: string | null
  } | null
}

interface PracticePaperSection {
  name: string
  questionType?: QuestionType // 缺失表示通用 Section
  totalScore?: number
  perScore?: number
  items: PracticePaperItem[]
}

interface PracticePaperItem {
  id: string
  title: string
  questionType: QuestionType // 每道题始终有具体题型
  A: string | null
  B: string | null
  C: string | null
  D: string | null
  E: string | null
  F: string | null
  correctAnswer: string
  explanation: string | null
}
```

`sections` 严格保持题集 Section 顺序，组内 `items` 严格保持 `questionIds` 顺序。具体题型
Section 的所有题目都与 `questionType` 一致；缺失 `questionType` 表示通用（不限题型），组内可以包含
不同题型。客户端不得把通用 Section 强制拆分或重新按题型排序，渲染题目时应使用每个 item 自身的
`questionType`。

`favoriteQuestionIds` 按题集中的题目顺序返回当前用户在该题集下仍有效的收藏题目 ID；仅包含本次
`paper.sections[].items` 实际返回的题目。没有收藏时返回 `[]`，不受 `/api/favorites` 分页限制。
收藏或取消收藏成功后，再次获取本接口会反映最新状态。

题型和同类型 Section 的默认中文文案由 API `src/constants/question.ts` 的 `QuestionTypeLabels`
维护，同步到 Neo/Dash 的 `src/generated/domain-values.ts`：`single`→`单选题`、
`multiple`→`多选题`、`judge`→`判断题`、`nounExplain`→`名词解释`、
`shortAnswer`→`简答题`、`essay`→`论述题`。这只是展示/输入建议；Section 的 `name`
如已自定义，客户端须原样展示，不用默认文案覆盖。

`latestRecord` 仅从当前用户、当前题集、未删除的真实记录中选创建时间最新的一条。新一次进入题集
始终从空答卷开始，不继承旧记录的作答。已有记录的 `userAnswers` 为按题目 ID 索引的已解析对象，
而非数据库 JSON 字符串。`score` 未评分时为 `null`，不伪造 `0`。

### 交卷与结果

`POST /api/practice/papers/:paperId/submissions` 请求体：

```ts
interface SubmitPracticePaperBody {
  submissionId: string // 客户端生成 rec_ + 12 位十六进制；同一次交卷重试保持不变
  userAnswers: Record<string, string | string[]> // 只传已作答题目；多选为数组，其余为字符串
  startTime?: string // ISO 时间；缺失或晚于交卷时间时使用服务端交卷时间
}
```

服务端只接受当前用户可读取的启用题集，校验每道答案对应题集内的有效题目及选项。
每次新交卷都在 0006 `practice_records` 表创建独立记录；相同 `submissionId`、题集、
用户及答案的重试返回同一记录，不重复写入；同 ID 对应其他作答时返回 HTTP 409。
请求校验失败不创建记录。
`POST` 返回 HTTP 201，`GET /api/practice/papers/:paperId/submissions/:submissionId` 返回
当前用户、当前题集的指定已完成记录：

```ts
interface PracticeSubmission {
  id: string
  paperId: string
  recordStatus: 'completed'
  userAnswers: Record<string, string | string[]>
  score: number | null // 尚无服务端评分时为 null
  startTime: string | null
  endTime: string | null
}
```

结果页必须按 `submissionId` 获取本次记录，不能用 `latestRecord` 代替。旧
`/api/practice/answer-sheet`、`/api/practice/submit`、`/api/practice/result` 和
`/api/practice/records/*` 均不提供，也不保留兼容。

## 5. 题目收藏模块

| Method   | Path                                                     | 说明                             | 状态 |
| -------- | -------------------------------------------------------- | -------------------------------- | ---- |
| `GET`    | `/api/favorites?groupBy=&order=`                         | 聚合查询收藏（默认按科目）       | 可用 |
| `PUT`    | `/api/favorites/:questionId`                             | 收藏题目（幂等）                 | 可用 |
| `DELETE` | `/api/favorites/:questionId`                             | 取消收藏（幂等）                 | 可用 |
| `DELETE` | `/api/favorites`                                         | 清空当前用户全部收藏             | 可用 |
| `GET`    | `/api/favorites/practice?subjectId=` / `?paperId=`       | 收藏练习数据（与练习题集同构）   | 可用 |

收藏是题目维度的事实：记录只存 `userId + questionId`，科目与题集上下文由服务端实时
join 计算；同一道题在任何题集内都显示一致的收藏状态。

聚合接口 query：

```ts
{
  groupBy?: 'subject' | 'paper' // 默认 subject
  order?: 'desc' | 'asc'        // 按题数排序，默认 desc
}
```

返回结构（只统计题目启用且可见、科目/题集启用未删的记录）：

```ts
// groupBy=subject（默认）
{ items: Array<{ subjectId: string; subjectName: string; questionCount: number }>, totalQuestionCount: number }

// groupBy=paper：口径为"该题集内含多少道我的收藏题"，同一题在多个题集会被分别计入
{ items: Array<{ paperId: string; paperName: string; subjectId: string; subjectName: string; questionCount: number }>, totalQuestionCount: number }
```

收藏/取消按题目 ID 操作，无请求体；题目不存在或不可见返回 404（`code 4001`）。

练习接口 `subjectId` 与 `paperId` 二选一：按科目取该科目全部收藏题，按题集取该题集
sections 内的收藏题；按题型重新分组，题目按收藏时间倒序。返回与
`GET /api/practice/papers/:paperId` 的 `paper` 同构（无 `type`/`assessmentType`/
`latestRecord`/`favoriteQuestionIds`），收藏练习不落服务端记录：

```ts
{
  paper: {
    id: string // "fav:<subjectId>" 或 "fav:<paperId>"
    name: string // 按科目=科目名；按题集=题集名
    subjectId: string // 归属科目（按题集模式为题集的科目）
    questionCount: number
    sections: Array<{ name: string; items: PracticePaperItem[] }>
  }
}
```

## 6. 错题模块

统一使用 `wrong-questions`，不使用语义不完整的 `/wrong`。与收藏完全同构，仅添加语义
为"发生了错误"，使用 `POST`：

| Method   | Path                                                     | 说明                             | 状态 |
| -------- | -------------------------------------------------------- | -------------------------------- | ---- |
| `GET`    | `/api/wrong-questions?groupBy=&order=`                   | 聚合查询错题（默认按科目）       | 可用 |
| `POST`   | `/api/wrong-questions/:questionId`                       | 记错题（幂等，保持原收录时间）   | 可用 |
| `DELETE` | `/api/wrong-questions/:questionId`                       | 移除错题（幂等）                 | 可用 |
| `DELETE` | `/api/wrong-questions`                                   | 清空当前用户全部错题             | 可用 |
| `GET`    | `/api/wrong-questions/practice?subjectId=` / `?paperId=` | 错题练习数据（与练习题集同构）   | 可用 |

聚合、练习、清空的行为与收藏模块一致（见第 5 章）；错题练习同样不落服务端记录。

## 7. 字典选项模块

| Method | Path                                    | 说明                 | 状态 |
| ------ | --------------------------------------- | -------------------- | ---- |
| `GET`  | `/api/options/majors`                   | 获取专业选项         | 可用 |
| `GET`  | `/api/options/subjects?majorId=maj_xxx` | 根据专业获取科目选项 | 可用 |

统一返回：

```ts
interface OptionItem {
  id: string
  code: string
  name: string
}
```

仅返回启用且未删除的数据。

## 8. 接口总表

```text
POST   /api/register
POST   /api/login
POST   /api/logout
GET    /api/user
GET    /api/me
PUT    /api/user/password
PUT    /api/user/email
GET    /api/user/settings/notifications
PATCH  /api/user/settings/notifications

GET    /api/plan
PUT    /api/plan

GET    /api/practice/settings
PATCH  /api/practice/settings
GET    /api/practice/entries
GET    /api/practice/papers/:paperId

GET    /api/favorites
PUT    /api/favorites/:questionId
DELETE /api/favorites/:questionId
DELETE /api/favorites
GET    /api/favorites/practice

GET    /api/wrong-questions
POST   /api/wrong-questions/:questionId
DELETE /api/wrong-questions/:questionId
DELETE /api/wrong-questions
GET    /api/wrong-questions/practice

GET    /api/options/majors
GET    /api/options/subjects
```
