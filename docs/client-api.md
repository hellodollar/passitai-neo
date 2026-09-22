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
  inviteCode: string // 注册邀请码，当前服务端固定校验为 "taikula"
}
```

注册时 `inviteCode` 必须为 `taikula`，否则返回 `code: 2005`（邀请码无效）；缺失或为空返回
`code: 1002`（请输入邀请码）。

登录仅允许 `role = user` 的账号；`admin` 账号请使用管理端登录，在用户端登录统一返回
`code: 2001`（账号或密码错误）。

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
  educationLevel?: string | null // 教育层次，当前服务端写死返回，仅部分专业有值
  nextExamDate?: string | null // 考试时间（ISO 字符串），当前服务端写死返回，仅部分专业有值
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
`educationLevel`、`nextExamDate` 为临时写死字段，后续接入专业维度配置。

用户未设置计划（新用户）、专业不存在或已删除时，`GET /api/plan` 返回 `data: null`，`/api/me` 的
`preferences.plan` 同样为 `null`；需先调用 `PUT /api/plan` 手动设置计划。

## 4. 练习模块

- `paper`：固定的试卷资源。
- `record`：用户的一次练习记录。
- `entries`：按科目获取的练习入口和可刷试卷列表。

| Method  | Path                                      | 说明                       | 状态 |
| ------- | ----------------------------------------- | -------------------------- | ---- |
| `GET`   | `/api/practice/settings`                  | 获取练习全局配置           | 可用 |
| `PATCH` | `/api/practice/settings`                  | 修改练习全局配置           | 可用 |
| `GET`   | `/api/practice/entries?subjectId=sub_xxx` | 获取该科目下的练习入口     | 占位 |
| `POST`  | `/api/practice/records`                   | 创建练习记录               | 占位 |
| `GET`   | `/api/practice/records/:recordId`         | 获取练习记录               | 占位 |
| `POST`  | `/api/practice/records/:recordId/submit`  | 提交练习记录               | 占位 |
| `GET`   | `/api/practice/records/:recordId/result`  | 获取本次作答结果和错题明细 | 占位 |

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

`subjectId` 必填。当前返回固定占位列表，第二阶段再确定实际试卷筛选、进度和响应字段。

### 练习记录

创建记录的请求体已经固定：

```ts
interface CreatePracticeRecordBody {
  paperId: string
}
```

创建、详情、提交和结果接口当前仅返回带有 `placeholder: true`、`persisted: false` 的占位数据。
提交请求体和完整结果字段留到第二阶段确定，当前不要依赖未文档化字段。

## 5. 题目收藏模块

| Method   | Path                                                 | 说明             | 状态 |
| -------- | ---------------------------------------------------- | ---------------- | ---- |
| `GET`    | `/api/favorites?page=1&limit=20&subjectId=&paperId=` | 分页查询收藏题目 | 可用 |
| `PUT`    | `/api/favorites/:questionId`                         | 收藏题目         | 可用 |
| `DELETE` | `/api/favorites/:questionId`                         | 取消收藏         | 可用 |

收藏采用一道题一条记录的扁平结构：

```ts
interface Favorite {
  id: string
  userId: string
  questionId: string
  subjectId: string
  paperId: string
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
}
```

收藏请求体：

```json
{ "paperId": "pap_xxx" }
```

添加时校验题目、试卷、科目和试卷题目关系；重复添加或删除保持幂等。

## 6. 错题模块

统一使用 `wrong-questions`，不使用语义不完整的 `/wrong`。

| Method   | Path                                                       | 说明         | 状态 |
| -------- | ---------------------------------------------------------- | ------------ | ---- |
| `GET`    | `/api/wrong-questions?page=1&limit=20&subjectId=&paperId=` | 分页查询错题 | 可用 |
| `PUT`    | `/api/wrong-questions/:questionId`                         | 添加错题     | 可用 |
| `DELETE` | `/api/wrong-questions/:questionId`                         | 移除错题     | 可用 |

错题与收藏使用相同的扁平字段：

```ts
interface WrongQuestion {
  id: string
  userId: string
  questionId: string
  subjectId: string
  paperId: string
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
}
```

添加错题请求体为 `{ "paperId": "pap_xxx" }`，添加和移除保持幂等。

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
POST   /api/practice/records
GET    /api/practice/records/:recordId
POST   /api/practice/records/:recordId/submit
GET    /api/practice/records/:recordId/result

GET    /api/favorites
PUT    /api/favorites/:questionId
DELETE /api/favorites/:questionId

GET    /api/wrong-questions
PUT    /api/wrong-questions/:questionId
DELETE /api/wrong-questions/:questionId

GET    /api/options/majors
GET    /api/options/subjects
```
