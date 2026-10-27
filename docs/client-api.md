# Neo 客户端 API

本契约以 API 路由、schema 和服务实现为准。唯一源为 `passitai-api/docs/client-api.md`，
`passitai-neo/docs/client-api.md` 是逐字节镜像，不单独编辑；源文件更新后在 API 执行 `pnpm sync`。
接口变更同时对齐 Neo 的 `src/api/` 与领域类型。基础路径为 `/api`，仅接受客户端登录签发的
`app` scope JWT。除注册、登录外，所有接口都需要：

```http
Authorization: Bearer <app-token>
```

## 导航

- [通用约定](#1-通用约定)
- [用户](#2-用户模块) · [刷题计划](#3-刷题计划模块) · [练习](#4-练习模块)
- [收藏](#5-题目收藏模块) · [错题](#6-错题模块) · [字典选项](#7-字典选项模块)
- [接口总表](#8-接口总表)

## 1. 通用约定

统一返回体：

```ts
type ApiResponse<T> =
  | { ok: true; data: T; message?: string }
  | { ok: false; data: null; message: string }

interface PaginationResult<T> {
  items: T[]
  total: number
}
```

HTTP 2xx、`ok: true` 表示成功；HTTP 4xx/5xx、`ok: false` 表示失败，失败时 `data: null`。
成功默认只返回 `{ ok: true, data }`，不返回固定的 `"success"` 或空字符串。
失败返回 `{ ok: false, message, data: null }`，`message` 必填。
仅明确需要服务端动态提示时，成功响应才可携带字符串 `message`；普通成功提示由前端按操作场景展示。
分页参数默认 `page=1&limit=20`，`limit` 最大为 `100`。

实体 ID 为资源前缀直接接 12 位小写十六进制，例如 `usrd6b8bfc02727`、`pap32bf50a871c1`。
交卷 `submissionId` 使用 `rec` 前缀；旧的带下划线格式不再接受，不自动转换旧记录或本地草稿。

所有 `/api/*` 请求正文上限为 **1 MiB（1,048,576 字节）**，按 UTF-8 字节计，
包括没有 Content-Length 的流式请求；超限在鉴权和 JSON 校验之前返回
`HTTP 413`、`{ ok: false, message: "请求体不能超过 1 MiB", data: null }`。
正文大小限制不代替各接口的字段校验，也不是请求频率限制。

接口结果以 **HTTP status** 判定：`2xx` 成功；`400` 参数/请求体校验失败；`401` 登录凭证错误、未登录
或 token 失效；`403` 权限不足；`404` 资源不存在；`409` 唯一/状态冲突；`500` 服务端异常；`503`
依赖服务不可用。不返回顶层 `code`，客户端不维护业务错误码字典。
`ok` 是布尔值，必须与 HTTP 状态一致，不使用 HTTP 200 包装失败。请求入口校验成功正文的
`ok === true`，鉴权、重试和错误分类依据 HTTP 状态；`message` 只用于展示，不用于程序分支。
答错题、空列表等业务结果不等于请求失败，接口处理成功仍返回 `ok: true`。

接口只划分为以下六个模块。本文未列出的其他 `/api` 客户端路径均不存在，不应调用。

## 2. 用户模块

| Method  | Path                               | 说明               | 状态 |
| ------- | ---------------------------------- | ------------------ | ---- |
| `POST`  | `/api/register`                    | 用户注册           | 可用 |
| `POST`  | `/api/login`                       | 用户登录           | 可用 |
| `POST`  | `/api/logout`                      | 用户登出，必须鉴权 | 可用 |
| `GET`   | `/api/user`                        | 获取用户基础信息   | 可用 |
| `PUT`   | `/api/user/password`               | 修改密码           | 可用 |
| `PUT`   | `/api/user/email`                  | 修改邮箱           | 可用 |

### 注册与登录

```ts
interface AuthBody {
  email: string
  password: string // 登录校验6–20位；注册还须同时包含字母和数字
}

interface RegisterBody extends AuthBody {
  inviteCode?: string // 字段可选；仅在当前策略要求时必须提供有效邀请码
}
```

注册页始终显示邀请码选填输入框，不读取服务端注册配置，也不调用公开配置接口。
空值可以提交；填写时 trim 并转大写，校验六位字母数字且至少各一个。请求中省略空邀请码。

注册由服务端读取 KV 设置后判断：

- 没有 KV 配置时默认允许普通注册，不要求邀请码；用户有效期默认三天，管理员默认一天。
- 已配置 `registrationEnabled=false` 时返回 `403`（暂未开放注册），已有账号仍可登录。
- 允许注册且 `requireInviteCode=false` 时不校验邀请码有效性。
- 允许注册且 `requireInviteCode=true` 时必须匹配当前六位统一邀请码，否则返回 `400`。
- `inviteCode` 请求字段始终可选，基础校验只接受最多64字符的字符串；是否必需由后端决定。
- 鉴权配置读取失败或内容无效返回 `503`，与未配置区分，不能当作普通注册放行。
- 登录只读取鉴权策略以取得有效期，不受注册开关影响，也不读取邀请码；普通注册同样不读取邀请码。
  仅开启邀请注册时读取邀请码存储，其故障返回 `503`；关闭注册仍优先返回 `403`。
- KV 配置存在传播延迟；换码、关闭注册或有效期变更逐步生效，已在处理中的注册可能按原策略完成。
- 不保留固定邀请码；邀请码可多人使用，新码传播后旧码不再接受。

邮箱已被占用时注册失败返回 `HTTP 409`（账号已存在）；未预期的服务端错误返回
`HTTP 500`。

注册、登录和修改邮箱统一去除首尾空格并转小写。邮箱查重不区分大小写，
仅大小写或首尾空格不同不视为新账号；已占用或软删除账号的邮箱不能重新注册。

注册失败直接显示后端返回的错误，Client 不预判是否需要邀请码。
Client 注册只产生启用的普通用户，不接受角色或状态字段。
注册与登录请求拒绝未知字段。Client 仅允许 `role=user` 登录，管理员使用 Dash 登录入口；
不存在、禁用、已删除、角色不符或密码错误统一返回 `401`（账号或密码错误）。

注册与登录成功返回：

```ts
interface AuthResult {
  token: string
  expiresAt: string // ISO 8601 UTC，与 JWT exp 来自同一次计算
  user: {
    id: string
    email: string
    role: 'admin' | 'user'
    status: 'enabled' | 'disabled'
    createdAt: string
  }
}
```

`POST /api/login`、`POST /api/register` 为公开接口；`POST /api/logout` 需要携带当前
`Authorization: Bearer <token>`。客户端捕获原 Token 后请求撤销，只清理对应原会话，失败仍可本地退出，
并提示服务端撤销未确认。登录/注册/登出等认证动作接口应排除在后台会话失效广播之外：它们返回的 `401` 不代表当前
会话失效，不应据此清除已有本地会话。

会话使用 HS256，服务端每次鉴权核对账号当前角色、启用/删除状态和内部 `sessionVersion`。
修改密码、管理员重置密码、变更角色或启用状态、删除及恢复账号都会撤销该账号的旧会话；
重新启用或恢复不会让旧 Token 再次生效。`sessionVersion` 不属于用户信息或可编辑字段。
不带会话版本的 Token 返回 `401`，用户需要重新登录。
每次登录签发独立 Token，登出仅撤销当前 Token，不影响其他登录。
登出存储失败返回通用 `500`，不会假报成功；KV 黑名单存在跨节点传播延迟，
不保证跨节点即时生效。密码与账号安全变更通过 D1 会话版本撤销，不依赖黑名单传播。

用户登录有效期默认 **3天（259200秒）**，由后台独立配置；允许3600–2592000秒整数。
从签发时计固定有效期，到期必须重新登录，不自动刷新或滑动续期。
修改策略只影响新签发 Token，已有会话仍按自身 `exp` 到期。登录响应不返回密码、偏好或会话版本。
恢复已有有效会话时，Client初始化仅请求一次`GET /api/user`；新登录/注册直接使用返回的user。
站内路由切换不追加用户请求；窗口focus、页面恢复可见、到期及跨标签事件只核对本地会话，
不会自动刷新用户或续期。跨标签直接同步已保存的会话快照；旧请求及旧退出结果不能覆盖新登录。
资料显式刷新由账户Store统一处理，GET /api/user使用10秒超时、零自动重试。
密码/邮箱修改也由账户Store统一提交；邮箱成功后直接更新共享用户，密码成功后清理原会话，均不追加资料请求。

### 用户基础信息与“我的”页

`GET /api/user` 只返回 `AuthResult['user']`，不返回密码哈希、会话版本、刷题计划或偏好。
账户信息由当前会话统一维护；“我的”页不再复制账户和设置的聚合快照。
刷题计划与刷题设置分别按需读取，共享各自的状态与缓存；两者可并行加载、独立失败与重试。
保存计划后首页与“我的”读取同一份计划状态；设置保存后答题页与“我的”读取同一份设置状态。
账号切换或退出清理缓存，迟到响应不能覆盖新会话。

`/api/me` 已移除。通知尚未开放，不持久化通知占位配置，
`GET/PATCH /api/user/settings/notifications` 返回404；页面只显示“暂未开放”。
本地刷题记录由浏览器按用户隔离保存，管理入口明确标注“本地”，不删除服务端交卷报告。

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
  错误返回 `HTTP 400`；新密码与当前密码相同返回 `HTTP 400`。成功后包括当前会话在内的旧会话
  全部失效，客户端清除本地会话并跳转登录页；更新期间账号被并发修改返回 `HTTP 409`。
- `PUT /api/user/email`：校验登录密码并确保新邮箱未被占用后更新，成功返回 `{ userId, email }`。邮箱
  已被占用返回 `HTTP 409`；与当前邮箱规范化后相同返回 `HTTP 409`；返回规范化的小写邮箱。
  原邮箱、密码或会话版本在更新期间变化，或账号被删除时返回 `HTTP 409`，不覆盖并发改动。
  更换邮箱本身不延长有效期、不撤销已有会话；客户端同步更新当前会话的用户邮箱。

## 3. 刷题计划模块

刷题计划表示当前选择的专业和刷题科目，属于 practice 模块；每个用户最多一份当前计划。

| Method | Path        | 说明             | 状态 |
| ------ | ----------- | ---------------- | ---- |
| `GET`  | `/api/practice/plan` | 获取当前刷题计划 | 可用 |
| `PUT`  | `/api/practice/plan` | 更新当前刷题计划 | 可用 |

```ts
interface PracticePlan {
  provinceCode: string // 六位省级地区代码，如 440000
  majorId: string
  majorName: string
  majorCode: string
  educationLevel: '本科' | '专科' // 来自 majors.educationLevel
  nextExamDate: string | null // 来自 majors.nextExamDate，YYYY-MM-DD
  subjects: {
    id: string
    name: string
    code: string
  }[]
}

interface UpdatePracticePlanBody {
  provinceCode: string // 必填，须与所选专业的省份一致
  majorId: string
  subjectIds?: string[]
}
```

计划独立存于 `users.practicePlan`，只保存 `{ provinceCode, majorId, subjectIds }`；未设置为SQL NULL。
省份代码独立保存用于回显，不重复保存专业或科目的名称、代码。响应中的展示字段实时从题库读取。
`PUT` 严格接受上述请求字段，未知字段（包括旧majorCode）返回400；省略subjectIds视为空数组，
数组最多100项，重复ID按首次出现顺序去重。
省份代码仅接受统一省份常量中的六位字符串（如440000）；缺失、数字类型、城市代码或未收录代码返回400。
API源为src/constants/province.ts，通过pnpm sync同步到Neo的src/constants/domain-values.ts；
前端使用provinceOptions（code/name）进行选择和回显，ProvinceCode为对应代码类型。
字典包含的地区不表示已有可用题库；专业候选项仍由启用且未删除的业务数据决定。
当前仍为单专业计划，majorId必填；provinceCode必须与专业记录一致，不一致返回400且不改写计划。
专业必须启用且未删除，否则返回404。每个科目必须属于该专业、启用且未删除，
任一不符合返回400且不改写计划。`educationLevel`、`nextExamDate` 从所选专业读取。

未设置计划、专业不存在、禁用、删除或省份归属已变化时，GET返回 `data: null`；需用户手动设置计划。
读取时过滤已失效的科目并保留选择顺序。返回专业和科目ID，Client直接使用ID，
不再通过code额外请求字典接口反查。科目不返回学分。
保存计划不改写偏好、不修改会话版本，也不清理已有刷题记录、收藏或错题。
旧 `/api/plan` 路径返回404。

## 4. 练习模块

- `paper`：固定的试卷资源。
- `record`：用户的一次练习记录。
- `entries`：按科目获取的练习入口和可刷试卷列表。

| Method  | Path                                                          | 说明                           | 状态     |
| ------- | ------------------------------------------------------------- | ------------------------------ | -------- |
| `GET`   | `/api/practice/settings`                                      | 获取用户刷题设置               | 可用     |
| `PATCH` | `/api/practice/settings`                                      | 修改用户刷题设置               | 可用     |
| `GET`   | `/api/practice/entries?subjectId=subxxx`                     | 获取该科目下的练习入口         | 部分可用 |
| `GET`   | `/api/practice/papers/:paperId`                               | 获取题集内容及最近真实练习记录 | 可用     |
| `POST`  | `/api/practice/papers/:paperId/submissions`                   | 交卷并创建练习记录             | 可用     |
| `GET`   | `/api/practice/papers/:paperId/submissions/:submissionId`    | 获取本次交卷记录               | 可用     |

### 刷题设置

```ts
interface PracticeSettings {
  autoNext: boolean
  recordWrongQuestions: boolean
  autoSubmitAfterCompletion: boolean
  removeMistakeOnCorrect: boolean // 答对自动移除错题
}
```

`PATCH` 接受非空局部更新，只允许上述四个布尔字段；空对象、未知字段或非布尔值返回400。
配置存于 `users.preferences.practice`，以数据库原子合并保存，不覆盖并发修改的其他字段或刷题计划。
未设置时返回 `autoNext: false`、`recordWrongQuestions: true`、
`autoSubmitAfterCompletion: false`、`removeMistakeOnCorrect: false`；默认值以
`src/services/client/user-preferences.ts` 为准。
未接入实际行为的循环练习、答后解析开关已移除；请求旧字段返回400。

### 练习入口

`subjectId` 必填。固定返回 `baseline`（专项训练）、`pastExam`（历年真题）、`mock`（考前模拟）、
`ai`（AI训练）四个入口；`type` 与题集 `type` 使用同一组取值。

`pastExam`、`mock`、`ai` 的 `children` 分别来自该科目下同类型、启用且未删除的题集，只包含平台题集
或当前用户自己的题集。每个子项返回 `{ paperId, name, questionCount, answeredCount }`，其中
`name` 直接取题集存储的名称（如 `2024年10月真题`），不拼接科目名称；
`questionCount` 为题集 `sections` 内全部题目数之和，`answeredCount` 暂为 `0`；父项的
`questionCount` 为全部子项之和。父项 `name`、`description` 和 `answeredCount` 来自
`src/constants/practice.ts` 的 `PracticeEntryPresets`（当前 `answeredCount` 依次为 0、75、12、0，
尚非真实进度）。没有匹配题集时 `children` 为 `[]`、`questionCount` 为 `0`。

`baseline`（专项训练）的 `children` 来自该科目 `type=baseline` 的题集。按以下
`assessmentType` 顺序排列，同一类型内按题集创建时间倒序；每份题集对应一个子项，`name`
取题集存储的名称（如 `考点通练`、`高频考点`、`易错强化`），`paperId` 指向该题集，
`questionCount` 只统计该题集。父项题数为全部子项之和：

`overall` → `highFrequency` → `errorProne`。该顺序由 `PaperAssessmentPreset` 定义；
`assessmentType` 只用于排序和客户端图标，不覆盖题集名称。其他自定义考查类型也是合法的子项，
排在上述预设类型之后，统一按题集创建时间倒序、ID 倒序排列，不会被丢弃。

baseline 子项额外返回 `assessmentType: string`（预设值或自定义值），供客户端做差异化展示；
该科目缺少某 `assessmentType` 的 baseline 题集时跳过对应类型。四类入口的作答进度尚未接入练习记录。

### 题集详情与最近练习记录

`paperId` 为路径参数。只能读取启用且未删除的平台题集或当前用户自己的题集。返回结构：
`paper.name` 与入口子项的 `name` 同源，直接展示题集名称，不拼接科目名。

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

`favoriteQuestionIds` 按题集中的题目顺序返回当前用户已收藏、且本次
`paper.sections[].items` 实际返回的题目 ID。查询同时限定当前用户、科目和题集；
只有收藏记录的 `subjectId`、`paperId` 与当前题集一致时才显示已收藏，
同一道题出现在其他题集时不会带入该收藏状态。没有收藏时返回 `[]`，不受 `/api/favorites`
分页限制；收藏或取消收藏成功后，再次获取本接口会反映最新状态。

题型和同类型 Section 的默认中文文案由 API `src/constants/question.ts` 的 `QuestionTypeLabels`
维护，同步到 Neo 的 `src/constants/domain-values.ts` 与 Dash 的 `src/generated/domain-values.ts`：`single`→`单选题`、
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
  submissionId: string // 客户端生成 rec + 12 位十六进制；同一次交卷重试保持不变
  userAnswers: Record<string, string | string[]> // 只传已作答题目；多选为数组，其余为字符串
  startTime?: string // ISO 时间；缺失或晚于交卷时间时使用服务端交卷时间
}
```

服务端只接受当前用户可读取的启用题集，校验每道答案对应题集内的有效题目及选项。
每次新交卷都在 0006 `practice_records` 表创建独立记录；相同 `submissionId`、题集、
用户及答案的重试返回同一记录，不重复写入；答案对象的字段顺序、多选答案顺序不影响重试判定。
同 ID 对应其他作答时返回 HTTP 409。
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

| Method   | Path                                               | 说明                                       | 状态 |
| -------- | -------------------------------------------------- | ------------------------------------------ | ---- |
| `GET`    | `/api/favorites?groupBy=&sort=&order=`             | 聚合查询收藏（默认按科目）                 | 可用 |
| `PUT`    | `/api/favorites`                                   | 收藏题目（幂等）                           | 可用 |
| `DELETE` | `/api/favorites`                                   | 按三元组取消收藏（幂等）                   | 可用 |
| `DELETE` | `/api/favorites/:recordId`                         | 按收藏记录 ID 取消（收藏训练页）           | 可用 |
| `DELETE` | `/api/favorites/all`                               | 清空当前用户全部收藏                       | 可用 |
| `GET`    | `/api/favorites/practice?subjectId=` / `?paperId=` | 收藏练习数据（与练习题集 paper 同构）      | 可用 |

收藏/取消使用训练页三元组请求体（`subjectId` 服务端校验一致后固化）：

```json
{ "questionId": "qstxxx", "subjectId": "subxxx", "paperId": "papxxx" }
```

题目、题集必须启用、未删除且属于平台或当前用户，题目须在题集中，否则 HTTP 404；
重复收藏更新题集上下文并保持
原收藏时间。`PUT /api/favorites` 成功返回 `{ favId: string }`，包含本次实际收藏记录 ID；
重复收藏返回已有 ID，取消后重新收藏返回新 ID，客户端必须更新而不能沿用旧 ID。
收藏和错题训练页统一按 `favId` 调用记录 ID 删除接口取消收藏；普通刷题页仍使用三元组取消。
普通刷题页取消时同时匹配当前用户、题目、科目及题集，不删除其他题集的收藏。
记录 ID 唯一，无需其他上下文；重复取消保持幂等。

聚合接口 query：

```ts
{
  groupBy?: 'subject' | 'paper'  // 默认 subject
  sort?: 'count' | 'recent'      // count 按题数（默认），recent 按收录时间
  order?: 'desc' | 'asc'         // 排序方向，默认 desc（recent 的 asc 为最早在前）
}
```

返回结构（只统计题目启用且可见、对应科目/题集启用未删的记录；
`totalQuestionCount` 为当前分组下各组 `questionCount` 之和）：

```ts
// groupBy=subject（默认）
{ items: Array<{ subjectId: string; subjectName: string; questionCount: number; lastCollectedAt: string }>, totalQuestionCount: number }

// groupBy=paper：按记录固化的题集上下文分组
{ items: Array<{ paperId: string; paperName: string; subjectId: string; subjectName: string; questionCount: number; lastCollectedAt: string }>, totalQuestionCount: number }
```

练习接口 `subjectId` 与 `paperId` 二选一：按科目取该科目全部收藏题；按题集只取收录记录的
`paperId` 与目标题集一致、且仍在该题集 sections 内的收藏题，不混入其他题集收录的共享题目。
按题型重新分组、按收藏时间倒序。返回与
`GET /api/practice/papers/:paperId` 的 `paper` 同构（无 `type`/`assessmentType`/
`latestRecord`/`favoriteQuestionIds`）。收藏训练为纯刷题：**不提供交卷**，不产生任何
服务端记录。分组默认名称使用统一题型文案（如 `single`→`单选题`、`multiple`→`多选题`）；
按科目聚合不返回顶层 `paper.id`；按题集返回真实题集 ID，不再返回 `fav:` 虚拟 ID。
每道题的 `paperId` 保留原收录题集上下文，不因按科目进入而丢失。取消后重新收藏仍提交该题的三元组。
`items` 额外携带收藏/错题 ID 及收录上下文：

```ts
{
  paper: {
    id?: string // 仅按题集返回真实 paperId；按科目不返回此字段
    name: string // 按科目=科目名；按题集=题集名
    subjectId: string
    questionCount: number
    sections: Array<{
      name: string // 题型中文名
      questionType: QuestionType
      items: Array<PracticePaperItem & {
        favId: string | null // 当前用户收藏记录 ID（fav），未收藏为 null
        wrongQuestionId: string | null // 错题练习中的错题记录 ID（wrq）；收藏练习为 null
        subjectId: string | null
        paperId: string | null // 收藏发生时的题集
      }>
    }>
  }
}
```

## 6. 错题模块

统一使用 `wrong-questions`，不使用语义不完整的 `/wrong`。与收藏完全同构，仅添加语义
为"发生了错误"，使用 `POST`：

| Method   | Path                                                     | 说明                                       | 状态 |
| -------- | -------------------------------------------------------- | ------------------------------------------ | ---- |
| `GET`    | `/api/wrong-questions?groupBy=&sort=&order=`             | 聚合查询错题（默认按科目）                 | 可用 |
| `POST`   | `/api/wrong-questions`                                   | 记错题（幂等，更新最近错题题集上下文）     | 可用 |
| `DELETE` | `/api/wrong-questions/:recordId`                         | 按错题记录 ID 移除（错题训练页）           | 可用 |
| `DELETE` | `/api/wrong-questions`                                   | 按三元组移除错题（答对自动移除，幂等）     | 可用 |
| `DELETE` | `/api/wrong-questions/all`                               | 清空当前用户全部错题                       | 可用 |
| `GET`    | `/api/wrong-questions/practice?subjectId=` / `?paperId=` | 错题练习数据（与练习题集 paper 同构）      | 可用 |

记错题请求体与收藏三元组相同，沿用题目、题集的可见性校验；重复记错保持原收录时间并更新题集上下文为最近一次发生
错误的题集。`DELETE /api/wrong-questions`（body 三元组）供"答对自动移除错题"设置使用：
练习设置 `removeMistakeOnCorrect` 开启时，客户端在判对后按答题上下文调用，幂等。
聚合、练习、清空的行为与收藏模块一致（见第 5 章）；错题练习同样不落服务端记录。
错题练习每道题分别返回 `wrongQuestionId`（错题记录 ID）和 `favId`（当前用户实际收藏 ID，
未收藏为 null）；两者不可混用。收藏状态由 `favId` 初始化，取消收藏使用 `favId`，
移除错题使用 `wrongQuestionId`。按科目不返回顶层 `paper.id`，按题集返回真实题集 ID。

## 7. 字典选项模块

| Method | Path                                     | 说明                     | 状态 |
| ------ | ---------------------------------------- | ------------------------ | ---- |
| `GET`  | `/api/options/majors?provinceCode=&code=`              | 获取专业选项（省份和code选填） | 可用 |
| `GET`  | `/api/options/subjects?majorId=majxxx`  | 根据专业获取科目选项     | 可用 |

统一返回：

```ts
interface OptionItem {
  id: string
  code: string
  name: string
}
```

仅返回启用且未删除的数据。`/api/options/majors` 支持 `provinceCode`（同计划中的省份代码格式）
和 `code` 精确过滤，组合使用时取交集；`/api/options/subjects` 支持单个 `majorId` 过滤，精确匹配科目 `majorIds` 数组中的专业 ID。

## 8. 接口总表

```text
POST   /api/register
POST   /api/login
POST   /api/logout
GET    /api/user
PUT    /api/user/password
PUT    /api/user/email

GET    /api/practice/plan
PUT    /api/practice/plan

GET    /api/practice/settings
PATCH  /api/practice/settings
GET    /api/practice/entries
GET    /api/practice/papers/:paperId

GET    /api/favorites
PUT    /api/favorites
DELETE /api/favorites
DELETE /api/favorites/:recordId
DELETE /api/favorites/all
GET    /api/favorites/practice

GET    /api/wrong-questions
POST   /api/wrong-questions
DELETE /api/wrong-questions
DELETE /api/wrong-questions/:recordId
DELETE /api/wrong-questions/all
GET    /api/wrong-questions/practice

GET    /api/options/majors
GET    /api/options/subjects
```
