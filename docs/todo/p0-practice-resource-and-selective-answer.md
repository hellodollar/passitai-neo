# [P0] 对齐 `paperMode` 重命名、修订版练习资源、选答题（answerCount）与题集名称口径

> **优先级：P0（最高优先级）**
> 由 `passitai-api` 后端契约变更同步下沉，最新镜像与生成常量已通过 `pnpm sync` 更新至 `docs/client-api.md` 与 `src/generated/domain-values.ts`。

## 需跟进项

1. **Breaking：`paperLayout` 重命名为 `paperMode`（`'custom'` → `'bank'`）**：
   - `GET /api/practice/papers/:paperId`、`GET /api/subjects/:code/profile`（`trainingProgress.*.papers[]`）及 `POST /api/subjects/:code/ai-enhance/generate` 返回字段已由 `paperLayout: 'custom' | 'exam'` 统一变更为 **`paperMode: 'bank' | 'exam'`**（题库模式 / 套卷模式）；
   - 生成常量由 `catalogPaperLayouts` 变更为 `catalogPaperModes`（`type PaperMode = 'bank' | 'exam'`），请全局替换前端判断与类型定义。
2. **实践考核科目（`examType === 'practical'`）展示**：
   - 实践课仅作科目展示，不开放练习，`GET /api/practice/resources` 固定返回 `[]`，前端直接按空态/实践课提示展示即可。
3. **选答题分组（`sections[].answerCount`）答题与自评体验**：
   - `GET /api/practice/papers/:paperId` 的 `sections[]` 新增可选字段 `answerCount`（如模拟卷论述题 3 选 2 时 `questionIds.length = 3`、`answerCount = 2`）；
   - 答题页与交卷前提示：当分组存在 `answerCount < items.length` 时，清晰提示「本大题任选 `answerCount` 题作答（共 `items.length` 题，每题 `perScore` 分，满分 `answerCount × perScore` 分）」；
   - 主观自评页与成绩汇总：前端预计分值与后端对齐——分段得分按最高 `answerCount` 题汇总封顶，避免展示出 110 分等超百分误导。
4. **模拟考试两类套卷与历年真题命名展示**：
   - `mockExams` 槽位现包含 `type = 'pointCoverage'`（复刻模拟卷，如 `2027年1月考前模拟（一）`）与 `type = 'highFrequency'`（趋势压轴卷，如 `2027年1月考前压轴（一）`）共 6 套，列表展示直接以服务端 `name` 为准，勿仅按 `pointCoverage` 过滤；
   - 历年真题名称已统一为考试月份（如 `2025年4月`、`2025年10月`），收藏 / 错题按题集分组名称也统一返回 `papers.name`，客户端直接透出即可。
