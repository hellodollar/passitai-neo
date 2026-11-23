# [P0] 后端生成常量命名对齐 TODO

- **优先级**：`P0`（最高）
- **状态**：待处理
- **来源**：`passitai-api` 练习资源领域常量命名对齐（对应最新镜像 [docs/client-api.md](../client-api.md)）

## 1. 领域常量生成文件替换

`passitai-api` 执行 `pnpm sync` 已生成 `src/generated/practice-resource-values.ts`（导出 `practiceResourceTypes`、`PracticeResourceType`）。

- 将以下文件中的 `@/generated/practice-template-values` 替换为 `@/generated/practice-resource-values`，并将类型 `PracticeTemplateType` 替换为 `PracticeResourceType`：
  - `src/types/practice-resource.ts`
  - `src/components/home/HomePracticeResources.vue`
- 替换完成后删除旧文件 `src/generated/practice-template-values.ts`。

> 注：客户端 `GET /api/practice/resources` 接口路径与返回字段无破坏性变更。

## 2. 接入个人科目画像与规则估分评估最小闭环（`0016 / 0017`）

后端已开放纯规则个人科目画像与估分诊断闭环（完整字段见最新镜像 [docs/client-api.md](../client-api.md#个人科目画像与规则评估)）：

- `GET /api/subjects/:code/profile`：读取当前用户在某科目的个人画像（交卷即时重算，无新变动按水位线直接复用），含 `practiceCount / answeredQuestions / objectiveAnswered / objectiveCorrect / subjectiveAnswered / unresolvedMistakes / highFrequencyCoverage`、`pointStats`、`questionTypeStats`、`trainingProgress`（4 训练槽位完成度）与 `latestEvaluation` 摘要。
- `POST /api/subjects/:code/evaluate`：传入 `{ triggerType?: 'manual' | 'practice' | 'baseline' }`（传 `{}` 默认 `manual`）触发一次规则估分，返回不可变快照（`estimatedScore`、`objectiveEstimatedScore`、`subjectiveEstimatedScore`、`readinessLevel`、`confidence`、`diagnosis.{summary,strengths,gaps}`、`recommendations[]`）。
- `GET /api/subjects/:code/evaluations?page=1&limit=10`：分页读取历史评估快照，用于渲染提分曲线与复盘历史。

**前端待对接要点**：
- 在 `src/types/` 与 `src/api/` 补齐上述 3 个接口的类型与请求方法；
- 在首页或科目学习概览区接入 `GET /api/subjects/:code/profile`（展示 4 槽位进度、预估分与准备度档位）；
- 提供“立即评估 / 交卷后评估”触发 `POST /api/subjects/:code/evaluate`，将 `recommendations` 中 `actionType: 'paper'` 直接跳对应 `paperId` 练习、`'mistakes'` 跳错题本、`'aiGenerate'` 预留或引导薄弱考点强化；
- 历史评估列表接入 `GET /api/subjects/:code/evaluations`。

## 验收条件

- [ ] 类型检查与构建通过，代码库无残留 `practice-template-values` / `PracticeTemplateType` 引用
- [ ] 已删除 `src/generated/practice-template-values.ts`
- [ ] 首页训练资源模块渲染与切换正常
- [ ] 个人科目画像展示、手动/交卷触发评估、推荐跳转与历史评估列表联调通过
- [ ] 验收完成后删除本 TODO 文档
