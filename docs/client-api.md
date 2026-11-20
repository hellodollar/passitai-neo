# Client API

本契约以 API 路由、schema 和服务实现为准。唯一源为 `passitai-api/docs/client-api.md`。
Neo 和 Desktop 各自的 `docs/client-api.md` 都是逐字节镜像。更新源文件后，在 API 项目执行 `pnpm sync` 并检查镜像。
各客户端的实际接入状态随各自的实现确认。
Neo 已接入下列账户、考试计划和题库读取接口，题集预览按服务端分组和题序展示。单独同步 Neo 题集类型和布局可运行
`node scripts/sync-domain-values.mjs --neo-catalog`。基础路径为 `/api`，仅接受客户端登录签发的
`app` scope JWT。除注册、登录外，所有接口都需要：

```http
Authorization: Bearer <app-token>
```

当前题库重写范围为 `0001–0009`，覆盖用户、全国专业、省份科目、科目考期、题集、题目和练习模板。
科目规约和科目画像目前仅完成 ORM 映射，未开放内容管理接口。练习包、交卷、练习记录、收藏、错题、通知等后续表未在本轮重写；下文保留的这些模块说明仅供后续重构核对，不能作为新版联调验收依据。
机器人和生成相关代码完全不在本轮范围内。

新资源路由尽量对应表名，表名的下划线在 URL 中写为连字符。关联专业、科目使用完整业务 `code`，内部 `id` 仅定位记录。

## 导航

- [通用约定](#1-通用约定)
- [用户](#2-用户模块) · [题库](#3-题库读取) · [练习](#4-练习模块)
- [收藏](#5-题目收藏模块) · [错题](#6-错题模块) · [字典选项](#7-字典选项模块)
- [站内通知](#8-站内通知) · [接口总表](#9-接口总表)

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

新版题库接口集中在第 3 节；其他模块是否可用于新版表，以文首的重构范围为准。

## 2. 用户模块

| Method  | Path                               | 说明               | 状态 |
| ------- | ---------------------------------- | ------------------ | ---- |
| `POST`  | `/api/register`                    | 用户注册           | 可用 |
| `POST`  | `/api/login`                       | 用户登录           | 可用 |
| `POST`  | `/api/logout`                      | 用户登出，必须鉴权 | 可用 |
| `GET`   | `/api/users/me`                        | 获取用户基础信息   | 可用 |
| `PUT`   | `/api/users/me/password`               | 修改密码           | 可用 |
| `PUT`   | `/api/users/me/email`                  | 修改邮箱           | 可用 |

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
恢复已有有效会话时，Client初始化仅请求一次`GET /api/users/me`；新登录/注册直接使用返回的user。
站内路由切换不追加用户请求；窗口focus、页面恢复可见、到期及跨标签事件只核对本地会话，
不会自动刷新用户或续期。跨标签直接同步已保存的会话快照；旧请求及旧退出结果不能覆盖新登录。
资料显式刷新由账户Store统一处理，GET /api/users/me使用10秒超时、零自动重试。
密码/邮箱修改也由账户Store统一提交；邮箱成功后直接更新共享用户，密码成功后清理原会话，均不追加资料请求。

### 用户基础信息与“我的”页

`GET /api/users/me` 只返回 `AuthResult['user']`，不返回密码哈希、会话版本、考试计划或偏好。
账户信息由当前会话统一维护；“我的”页不再复制账户和设置的聚合快照。
考试计划与刷题设置分别按需读取，共享各自的状态与缓存；两者可并行加载、独立失败与重试。
保存考试计划后首页与“我的”读取同一份计划状态；设置保存后答题页与“我的”读取同一份设置状态。
账号切换或退出清理缓存，迟到响应不能覆盖新会话。

`/api/me`、`/api/user` 已移除（账户资料迁移到 `/api/users/me`）。通知展示设置单独使用 `/api/notifications/settings`，
`GET/PATCH /api/users/me/settings/notifications` 返回404；页面只显示“暂未开放”。
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

- `PUT /api/users/me/password`：校验当前密码后更新为新密码，成功返回 `{ userId, changed: true }`。当前密码
  错误返回 `HTTP 400`；新密码与当前密码相同返回 `HTTP 400`。成功后包括当前会话在内的旧会话
  全部失效，客户端清除本地会话并跳转登录页；更新期间账号被并发修改返回 `HTTP 409`。
- `PUT /api/users/me/email`：校验登录密码并确保新邮箱未被占用后更新，成功返回 `{ userId, email }`。邮箱
  已被占用返回 `HTTP 409`；与当前邮箱规范化后相同返回 `HTTP 409`；返回规范化的小写邮箱。
  原邮箱、密码或会话版本在更新期间变化，或账号被删除时返回 `HTTP 409`，不覆盖并发改动。
  更换邮箱本身不延长有效期、不撤销已有会话；客户端同步更新当前会话的用户邮箱。

## 3. 题库读取

### 专业

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/majors` | 分页获取可用全国专业 |
| GET | `/api/majors/:code` | 按全国专业代码读取详情 |

列表支持 `page / limit / keyword / educationLevel / provinceCode`；不传省份读取全国目录，传省份则仅保留该省可用科目关联的专业。
专业全国唯一，不保存省份。客户端只返回启用、开考且未删除记录。
列表及详情字段：`id / code / name / educationLevel / requiredCredits`；不返回管理扩展 `extraFields`。
列表返回 `{ total, items }`，默认 20 条、最多 100 条，按 `code` 排序。

### 科目

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/subjects?provinceCode=440000&majorCode=120206` | 分页获取某省的可用科目 |
| GET | `/api/subjects/:code` | 按完整业务码读取科目详情 |

列表 `provinceCode` 必填，`majorCode` 选填，另支持 `page / limit / keyword`。
只返回启用、开考且未删除记录；传专业时还要求该专业可用。
科目字段为 `id / code / originCode / provinceCode / majorCodes / name / credit / examType`。
详情另返回 `nextExam: { period, examDate } | null`，按该科目和省份读取最近未来考期。
例如广东 `GD-15043` 与湖南 `HN-15043` 是不同科目，不以同名或 `originCode` 合并。

### 题集与题目

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/practice/papers/:paperId` | 获取题集和按分组排序的题目 |

只返回启用且未删除的题集，以及启用、开考、同省且未删除的所属科目。
归属只能为平台（`ownerId=NULL`）或当前用户；其他用户资源视为不存在。

题集详情基础字段：`id / subjectCode / provinceCode / name / type / paperLayout / contentPeriod / sourceType / questionCount`。
`type` 必填，值为 `pointCoverage / highFrequency / errorTarget / realSource`，其中 `realSource` 表示真题。
`paperLayout` 为 `custom / exam`，与题集来源 `system / ai` 分开。

详情附 `sections: [{ name, questionType?, perScore?, questionIds, items }]`。
每个 `items` 含 `id / subjectCode / title / type / A / B / C / D / E / F / correctAnswer / explanation`，保持分组和题序。
`correctAnswer` 为正确/参考答案字符串，`explanation` 为解析字符串或 null，用于练习确认后的即时对错反馈与解析展示；选择题沿用现有答案格式。
不返回来源原文、指纹或其他用户资料。题目必须同科目、归属兼容、启用且未删除。
存在缺题、重复题、无效分组或题型冲突时返回 409，不静默丢题。空题集不能作为启用题集读取。

Neo 首页按科目加载练习模板，从模板的 `list` 获取可打开的题集。收藏和错题使用各自的列表与练习接口。已知题集 ID 可用于读取单份题集详情。
旧 `/api/papers`、`/api/papers/:id`、`/api/practice/entries`、`/api/users/me/practice-scope`、`/api/users/me/practice-plan`、`/api/practice/plan`、`/api/practice/scope` 和 `/api/profile` 已移除，不提供别名。

## 4. 练习模块

考试计划、练习模板和刷题设置已可用。交卷记录等待后续表对接。

- `paper`：固定的试卷资源。
- `record`：用户的一次练习记录。

| Method  | Path                                                          | 说明                           | 状态     |
| ------- | ------------------------------------------------------------- | ------------------------------ | -------- |
| `GET`   | `/api/practice/exam-plan`                                     | 获取当前考试计划               | 可用     |
| `PUT`   | `/api/practice/exam-plan`                                     | 整体替换考试计划               | 可用     |
| `GET`   | `/api/practice/resources?subjectCode=`                       | 获取指定科目的练习资源         | 可用     |
| `GET`   | `/api/practice/settings`                                      | 获取用户刷题设置               | 可用     |
| `PATCH` | `/api/practice/settings`                                      | 修改用户刷题设置               | 可用     |
| `GET`   | `/api/practice/papers/:paperId` | 题集和题目，见第3节 | 本轮已实现 |
| `POST`  | `/api/practice/papers/:paperId/submissions`                   | 交卷并创建练习记录             | 待重构   |
| `GET`   | `/api/practice/papers/:paperId/submissions/:submissionId`    | 获取本次交卷记录               | 待重构   |

### 考试计划

`GET` 在未设置考试计划或所选专业、科目不可用时返回 `data: null`。`PUT` 整体替换当前考试计划，未知字段返回 400。

#### 当前报考范围

Neo 和 Desktop 的报考省份按此顺序展示：北京（`110000`）、上海（`310000`）、
广东（`440000`）、湖北（`420000`）、浙江（`330000`）。

| 学历 | 开通专业 |
| --- | --- |
| 本科 | 汉语言文学 `050101`、工商管理 `120201K`、行政管理 `120402`、会计学 `120203K`、人力资源管理 `120206`、学前教育 `040106`、法学 `030101K` |
| 专科 | 工商企业管理 `530601`、行政管理 `590206`、人力资源管理 `590202`、市场营销 `530605`、计算机应用技术 `510201` |

候选专业由 `GET /api/options/majors` 按省份和学历下发，要求该省至少有一门可用关联科目。
某省暂无匹配题库数据时返回空列表。客户端省份选项由 API 常量生成。
已有考试计划读取时按现有题库状态解析；新建或替换计划时校验当前开放范围。

#### 保存

```json
{
  "provinceCode": "440000",
  "majorCode": "120206",
  "subjectCodes": ["GD-15043"]
}
```

只保存以上三个字段到 `users.examPlan`。`majorCode` 必填；`subjectCodes` 必填、最多 100 项，按首次出现顺序去重，允许空数组。
省份和专业必须在当前报考范围内，专业须启用、开考、未删除且在该省有可用科目。
所选科目须同省、启用、开考且在 `majorCodes` 中关联所选专业。校验失败返回 400 且不写入。
不接受旧 `majorId / subjectIds / educationLevel` 字段；学历由专业读取。
返回 `{ provinceCode, majorCode, subjectCodes, major, subjects, nextExam }`，专业与科目字段见第 3 节。
所选科目均附 `nextExam: { subjectCode, period, examDate } | null`；计划级 `nextExam` 取最近一场。
考期从 `subject_exams_schedules` 按科目及省份读取，以北京时间的今天为下限；同日按期次、科目代码稳定排序，不随计划落库。

### 练习资源

`GET /api/practice/resources?subjectCode=GD-13811-test` 返回指定科目的启用模板及其题集，按 `sort` 升序、同序按 `id` 排列。
科目必须启用、开考且未删除，无可用模板返回 `[]`。每条模板返回 `id`、`name`、`type`、`list`。
`type` 取 `baseline`、`mockExams`、`pastExams` 或 `aiEnhance`，供业务判断。Neo 使用 `name` 展示模板名称。
模板下的题集沿用题集自身的分类。
`list` 按管理端配置顺序返回仍可用的同科目公开题集，使用题集详情的基础字段（含 `questionCount`）。未编排或无可用题集时为 `[]`。
接口仅返回题集列表，不返回模板占比、题集占比或题目答案。旧 `/api/practice/templates` 已移除。

### 刷题设置

```ts
interface PracticeSettings {
  shuffleQuestions: boolean // 乱序出题，默认关闭
  autoNext: boolean
  recordWrongQuestions: boolean
  autoSubmitAfterCompletion: boolean
  removeMistakeOnCorrect: boolean // 答对自动移除错题
}
```

`PATCH` 接受非空局部更新，只允许上述五个布尔字段；空对象、未知字段或非布尔值返回400。
配置存于 `users.preferences.practice`，以数据库原子合并保存，不覆盖并发修改的其他字段或考试计划。
未设置时返回 `autoNext: false`、`recordWrongQuestions: true`、
`autoSubmitAfterCompletion: false`、`removeMistakeOnCorrect: false`、`shuffleQuestions: false`；默认值以
`src/services/client/user-preference.ts` 为准。
乱序出题在下次进入练习时生效：保留原分组，在每组内打乱题目顺序，不打乱选项。存在本地作答记录时，客户端按记录的开始时间固定同一轮顺序，刷新或恢复时保持稳定；答案和进度仍按题目 ID 对应。API 返回题集保留原顺序，提交协议不变。
未接入实际行为的循环练习、答后解析开关已移除；请求旧字段返回400。

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

收藏使用 `user_favorites`，按 `subjectCode` 关联科目。客户端提交和接收的科目标识为 `subjectId`，由服务端与科目代码对应。

| Method   | Path                                               | 说明                                       | 状态 |
| -------- | -------------------------------------------------- | ------------------------------------------ | ---- |
| `GET`    | `/api/favorites?groupBy=&sort=&order=`             | 聚合查询收藏（默认按科目）                 | 可用 |
| `PUT`    | `/api/favorites`                                   | 收藏题目（幂等）                           | 可用 |
| `DELETE` | `/api/favorites`                                   | 按三元组取消收藏（幂等）                   | 可用 |
| `DELETE` | `/api/favorites/:recordId`                         | 按收藏记录 ID 取消（收藏训练页）           | 可用 |
| `DELETE` | `/api/favorites/all`                               | 清空当前用户全部收藏                       | 可用 |
| `GET`    | `/api/favorites/practice?subjectId=` / `?paperId=` | 收藏练习数据（与练习题集 paper 同构）      | 可用 |

收藏和取消使用训练页的三元组请求体：

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

按题集分组的 `paperName` 和题集练习的 `paper.name` 与普通练习一致：
`pointCoverage` 显示 `考点通练`，其他题集显示存储名称；按科目使用科目名。
名称变化不改变收录上下文、题目 ID 或实际 paperId，也不合并名称相同的分组。

练习接口 `subjectId` 与 `paperId` 二选一：按科目取该科目全部收藏题；按题集只取收录记录的
`paperId` 与目标题集一致、且仍在该题集 sections 内的收藏题，不混入其他题集收录的共享题目。
按题型重新分组、按收藏时间倒序。返回与
下方 `paper` 结构。收藏训练为纯刷题：**不提供交卷**，不产生任何
服务端记录。分组默认名称使用统一题型文案（如 `single`→`单选题`、`multiple`→`多选题`）；
按科目聚合不返回顶层 `paper.id`；按题集返回真实题集 ID，不再返回 `fav:` 虚拟 ID。
每道题的 `paperId` 保留原收录题集上下文，不因按科目进入而丢失。取消后重新收藏仍提交该题的三元组。
`items` 额外携带收藏/错题 ID 及收录上下文：

```ts
{
  paper: {
    id?: string // 仅按题集返回真实 paperId；按科目不返回此字段
    name: string // 按科目=科目名；按题集=客户端展示名（综合专项训练为考点通练）
    subjectId: string
    questionCount: number
    sections: Array<{
      name: string // 题型中文名
      questionType: QuestionType
      items: Array<PracticePaperItem & {
        favId: string | null // 当前用户收藏记录 ID（fav），未收藏为 null
        mistakeId: string | null // 错题练习中的错题记录 ID（wrq）；收藏练习为 null
        subjectId: string | null
        paperId: string | null // 收藏发生时的题集
      }>
    }>
  }
}
```

## 6. 错题模块

错题使用 `user_mistakes`，与收藏一样按 `subjectCode` 关联科目。

客户端错题资源使用 `/api/mistakes`，路由文件使用复数 `mistakes.ts`，服务和校验文件使用单数 `mistake.ts`；ORM 文件使用 `user-mistakes.ts`，对应目标表 `user_mistakes`，不再使用 `/api/user-mistakes`、`/api/wrong-questions` 或 `/wrong`。与收藏完全同构，仅添加语义
为"发生了错误"，使用 `POST`：

| Method   | Path                                                     | 说明                                       | 状态 |
| -------- | -------------------------------------------------------- | ------------------------------------------ | ---- |
| `GET`    | `/api/mistakes?groupBy=&sort=&order=`             | 聚合查询错题（默认按科目）                 | 可用 |
| `POST`   | `/api/mistakes`                                   | 记错题（幂等，更新最近错题题集上下文）     | 可用 |
| `DELETE` | `/api/mistakes/:recordId`                         | 按错题记录 ID 移除（错题训练页）           | 可用 |
| `DELETE` | `/api/mistakes`                                   | 按三元组移除错题（答对自动移除，幂等）     | 可用 |
| `DELETE` | `/api/mistakes/all`                               | 清空当前用户全部错题                       | 可用 |
| `GET`    | `/api/mistakes/practice?subjectId=` / `?paperId=` | 错题练习数据（与练习题集 paper 同构）      | 可用 |

记错题请求体与收藏三元组相同，沿用题目、题集的可见性校验；重复记错保持原收录时间并更新题集上下文为最近一次发生
错误的题集。`DELETE /api/mistakes`（body 三元组）供"答对自动移除错题"设置使用：
练习设置 `removeMistakeOnCorrect` 开启时，客户端在判对后按答题上下文调用，幂等。
聚合、练习、清空的行为与收藏模块一致（见第 5 章）；错题练习同样不落服务端记录。
错题练习每道题分别返回 `mistakeId`（错题记录 ID）和 `favId`（当前用户实际收藏 ID，
未收藏为 null）；两者不可混用。收藏状态由 `favId` 初始化，取消收藏使用 `favId`，
移除错题使用 `mistakeId`。按科目不返回顶层 `paper.id`，按题集返回真实题集 ID。

## 7. 字典选项模块

- `GET /api/options/majors`：考试计划的可选专业，`provinceCode` 必填，支持 `educationLevel`、
  `page`、`limit`、`keyword`。返回当前开通且在该省有可用科目的专业，按 `code` 排序。
- `GET /api/options/subjects`：`provinceCode` 必填，`majorCode` 选填。省份和已传的专业须在开通范围内，
  其余查询及可见性规则同 `/api/subjects`。

成功返回当前分页的 `{ id, code, name }[]`。需要完整分页信息时直接调用资源列表接口。
不接受旧 `majorId / ids / subjectId` 关联参数。

## 8. 站内通知

仅 `app` scope 当前启用账号可访问；用户 ID 来自 JWT，不能在请求体中指定他人。

| Method | Path | 说明 |
| --- | --- | --- |
| GET | `/api/notifications` | 个人收件箱 |
| GET | `/api/notifications/summary` | 统一未读摘要 |
| GET | `/api/notifications/:id` | 纯读取详情，不自动标记已读 |
| PUT | `/api/notifications/:id/read` | 首次已读，body `{}`，重复保持原时间 |
| PUT | `/api/notifications/read-all` | 将当前可见的消息标为已读，body `{}` |

列表严格接受 `page`、`limit`、`unread?: "true"|"false"`，
默认 1/20，最多100；按 publishedAt、id 倒序，返回 `{items,total}`。收件箱先取当前账号
最近 7 天内已发布、未撤下的最新 10 条，再应用已读筛选和分页。未读数、最新未读及详情使用同一范围。

```ts
interface NotificationItem {
  id: string // ntf + 12 位小写 hex
  title: string
  publishedAt: string // ISO
  readAt: string | null
  linkPath: string | null // 仅 / 或 /practice/<paperId>，无外部链接
  contentPreview: string // 前100个字符
}
// 详情为 NotificationItem 去掉 contentPreview，增加 content:string（纯文本）。
interface NotificationSummary {
  unreadCount: number
  latestUnread: { id: string; title: string; publishedAt: string } | null
}
// 单条已读：{id,readAt:string}；全部已读：{read:true}。
```

从发布时间起满 7 天即过期，读过和未读的消息使用同一规则。过期、超出最近 10 条、
未知、他人、草稿、撤下的详情和单条已读请求统一返回 404。
过期由查询判断，保留通知和用户收件记录供后台核对。关联题集停用、删除或变为私有时 linkPath 为 null。
正文是纯文本，不作为 HTML 渲染。广播以发布时的启用普通用户为准，新注册用户不补发历史广播。
Neo 首页铃铛、通知条、“我的”和消息页共享摘要。摘要在登录、恢复可见或窗口焦点、
进入消息中心时按需读取，自动检查间隔至少 5 分钟。单条或全部标记已读成功后立即刷新。
Desktop 打开消息中心时先标记全部已读，再读取列表。关闭通知横幅时只标记该条消息，成功后关闭横幅。
启用横幅时，Desktop 在首次加载和恢复前台按同样的 5 分钟间隔检查。账号切换清理缓存并隔离迟到响应。
通知展示设置见下文；自动提醒、Telegram 和邮件不属于站内通知。

## 9. 接口总表

```text
POST   /api/register
POST   /api/login
POST   /api/logout
GET    /api/users/me
PUT    /api/users/me/password
PUT    /api/users/me/email

GET    /api/practice/exam-plan
PUT    /api/practice/exam-plan
GET    /api/practice/resources?subjectCode=

GET    /api/practice/settings
PATCH  /api/practice/settings
GET    /api/majors
GET    /api/majors/:code
GET    /api/subjects
GET    /api/subjects/:code
GET    /api/practice/papers/:paperId

GET    /api/favorites
PUT    /api/favorites
DELETE /api/favorites
DELETE /api/favorites/:recordId
DELETE /api/favorites/all
GET    /api/favorites/practice

GET    /api/mistakes
POST   /api/mistakes
DELETE /api/mistakes
DELETE /api/mistakes/:recordId
DELETE /api/mistakes/all
GET    /api/mistakes/practice

GET    /api/options/majors
GET    /api/options/subjects

GET    /api/notifications
GET    /api/notifications/summary
GET    /api/notifications/:id
PUT    /api/notifications/:id/read
PUT    /api/notifications/read-all
```


## 通知展示设置

`GET /api/notifications/settings` 返回 `{ inAppBanner: boolean, contentPreview: boolean }`，默认均为 `true`。
`PATCH /api/notifications/settings` 接受至少一个上述布尔字段；空对象、未知字段、非布尔值返回 400。
开关以当前登录用户为范围，存于 `users.preferences.notifications`，原子局部合并，不覆盖并发更新的刷题设置或其他开关。
`inAppBanner` 只控制 App 内的最新未读横幅；`contentPreview` 控制横幅标题预览及通知列表正文摘要，消息详情仍可主动查看。
关闭开关不停止消息接收、不更改收件或已读事实，不关联系统推送、邮件和短信。
查询未读消息时传 `unread=true`，查询全部消息时省略 `unread`。
账户安全继续使用 `PUT /api/users/me/password` 和 `/api/users/me/email`，请求严格拒绝未知字段。
改密成功后旧会话失效，客户端清理会话并返回登录；改邮箱成功后使用响应邮箱同步本地会话。
