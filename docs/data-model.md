# 数据模型与业务约束

实体与前端载体无关。完整字段、默认值、CHECK 和索引以相邻 API 的 [migrations](../../passitai-api/migrations/) 与 [Drizzle schema](../../passitai-api/src/db/schema/) 为准；对外字段以 [client-api.md](client-api.md) 为准。本文件不复制建表 SQL，也不据此调整数据库。

题库主线当前重构至 `0001–0009`；后续表按现有结构列出，不因此认定全部已对接新版题库。前端状态及数据适配见 [frontend-contract.md](frontend-contract.md)。

## 标识、格式与关联

- `id` 为 TEXT 数据标识，不是自增整数。已有业务用 API `src/utils/id.ts` 的 `generateId` 生成：实体前缀 + 12 位随机十六进制字符串。未定义的实体不自行补前缀规则。
- 数据 ID 和业务码分开；专业为 `majors.code`，科目为 `subjects.code`，关联字段 `subjectCode` 指向后者，不是 `subjects.id`。
- `provinceCode` 是六位字符串，如广东 `440000`；课程码保留前导零。
- JSON 在 D1 中以 TEXT 保存，按各表 schema 转换。已定义的对象/数组 CHECK 需要遵守；不能假定所有 JSON 结构或校验强度一致，接口也不直接暴露数据库 JSON 字符串。
- 时间字段为 TEXT，创建时间通常为 UTC ISO；考试 `period` 为 `YYYY-MM`、`examDate` 为 `YYYY-MM-DD`，不与时间戳混用。
- 下述关联是业务关系，不宣称全部有数据库 FOREIGN KEY；唯一性按实际索引，跨表同省、权限和可用性另由服务层校验。

## 表与实体

| 迁移 | 表                                | 职责与关键关系 / 约束                                                                    |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------- |
| 0001 | `users`                           | 账户和会话版本；邮箱忽略大小写唯一；计划在 `examPlan`，练习/通知偏好在 `preferences`     |
| 0002 | `majors`                          | 全国标准专业，`code` 唯一，无省份；扩展信息为 `extraFields`                              |
| 0003 | `subjects`                        | 科目实例，完整 `code` 唯一；保存 `originCode`、省份和 `majorCodes` 数组                  |
| 0004 | `subject_manifest`                | 科目规约；`subjectCode + version` 唯一，版本为正整数                                     |
| 0005 | `subject_profiles`                | 科目评估基线，考点/题型/训练场景三个可空 JSON 对象；目前无 `subjectCode` 唯一索引        |
| 0006 | `subject_exams_schedules`         | 科目考期，`provinceCode + period + subjectCode` 唯一                                     |
| 0007 | `papers`                          | 题集，关联科目、省份及可空用户；`sections` 保存分组、分值和题目结构                      |
| 0008 | `questions`                       | 题干、选项、答案、解析、来源和指纹；关联科目及可空用户                                   |
| 0009 | `practice_templates`              | 科目练习编排配置，含类型、JSON 对象 `config`、排序和启用状态                             |
| 0010 | `bots`                            | 机器人身份、运行及近期控制信息；令牌哈希唯一，不属于 H5 登录实体                         |
| 0011 | `tasks`                           | 任务配置、最近执行和回执；现有部分唯一索引限制活动执行                                   |
| 0012 | `notifications`                   | 通知内容、接收范围、跳转及草稿/发布/撤下状态                                             |
| 0013 | `user_notifications`              | 收件事实与首次阅读时间；`userId + notificationId` 唯一                                   |
| 0014 | `user_favorites`                  | 收藏收录，关联题目、`subjectCode`、来源题集；`userId + questionId` 唯一                  |
| 0015 | `user_mistakes`                   | 错题收录，与收藏独立；`userId + questionId` 唯一                                         |
| 0016 | `user_practice_records`           | 服务端作答记录，含题集名称快照、答案、状态、分数和起止时间                               |
| 0017 | `user_subject_profiles`           | 用户科目画像基础结构，`userId + subjectCode` 唯一，未定义能力维度字段                    |
| 0018 | `user_subject_evaluations`        | 用户科目评估基础结构，关联用户和科目，未定义评估内容字段                                 |
| 0019 | `user_practice_template_profiles` | 用户模板画像，`userId + practiceTemplateId` 唯一；科目及类型从模板取得，内容为 JSON 对象 |

表结构存在、接口存在、前端接通是不同状态。画像表不代表已实现稳定分、轮次门槛、置信度或 AI 评估算法。

## 专业与科目业务码

全国专业通过 `majorCode` 识别，省内可用科目按 `provinceCode + majorCode` 查询，不为全国专业重复附加省份主键。

科目业务码按字典生成：省份 ISO 两位大写后缀 + `-` + 原始课程码，如 `GD-00024`、`SH-00024`。前缀查字典，不自行按拼音推算。`originCode` 只在科目表保存，不作为跨省画像或推荐的聚合键；同名同源但完整业务码不同的科目分别关联题集、基线和用户画像。

省份筛选使用 `provinceCode`，不运行时拆码。参考表和完整规则只维护于 API [科目业务编码规范](../../passitai-api/docs/design/subject-codes.md)。测试资料允许既有 `-test` 后缀，不当作正式课程码。

## 考试计划与偏好

当前计划存于 `users.examPlan`，不是独立表，选中值为 `provinceCode`、`majorCode`、`subjectCodes`。响应的 `major`、`subjects`、`nextExam` 是关联查询结果，不整份重复持久化。

所选科目必须同省、属于专业且可用。首页显隐、顺序及滚动属于浏览状态，不写入服务端计划。偏好在 `users.preferences`，尚无独立的用户设置表。

## 模板、题集与题目

下列分类独立，不因文案相似而互换：

| 对象 / 字段        | 当前值                                                               |
| ------------------ | -------------------------------------------------------------------- |
| 模板 `type`        | `baseline`、`mockExams`、`pastExams`、`aiEnhance`                    |
| 题集 `type`        | `pointCoverage`、`highFrequency`、`errorTarget`、`realSource`        |
| 题集 `paperLayout` | `custom`、`exam`                                                     |
| 题集 `sourceType`  | `system`、`ai`                                                       |
| 题目 `type`        | `single`、`multiple`、`judge`、`nounExplain`、`shortAnswer`、`essay` |
| 题目 `sourceType`  | `system`、`crawler`、`manual`、`import`、`ai`                        |

模板 `config` 目前仅约束为 JSON 对象，完整编排结构待确认；Client 返回的 `list` 目前为 `[]`。不能假定模板已绑定题集，也不恢复旧 bundle 的权重、轮次或分档算法。

题集用 `sections` 组织题目，不表示题目独占一个题集。题数等派生字段按服务端计算，不自行加成数据库列。题集真题类型、布局和题目 `isPastExam` 语义各自独立。

`ownerId = null` 表示平台资源，有用户 ID 表示用户资源；可见性、同科目关系及答案下发由服务端决定。数据库有答案，不等于普通题集读取接口下发答案。

模板类型由 API 常量生成至 `src/generated/practice-template-values.ts`，供业务判断。Neo 用模板名称展示。枚举以 API 常量及生成文件为准；Neo `src/generated/domain-values.ts`、`src/generated/paper-catalog-values.ts` 不手改。前者仍含旧练习分类，不能直接把其中 `paperType` 用作新版 `papers.type`。

## 收藏、错题、作答与评估

- 收藏、错题各自按用户和题目去重，来源题集不是唯一键的一部分；同题可同时在两张表中。
- 数据库收录表用 `subjectCode`，当前 Client 收藏/错题协议仍用 `subjectId`，由服务端解析，不因此修改接口契约。
- 本机作答不是 `user_practice_records`，不作为服务端分数或权限依据。新版普通题集交卷/报告仍待对接。
- 单次作答分数、科目画像、模板画像、AI 评估不能混为同一事实。当前基线对象和画像基础结构未实现之前讨论的最低轮次、稳定分、置信机制或评分上限，后续确认后再记录。

常见启用状态为 `enabled / disabled`，开考状态为 `open / closed`，练习状态为 `notStarted / inProgress / completed`，通知发布状态为 `draft / published / withdrawn`。各表具体校验、软删除和状态组合按 migrations、服务与接口契约，不统一套用所有表。
