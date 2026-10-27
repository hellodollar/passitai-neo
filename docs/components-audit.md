# 客户端组件梳理

日期：2026-10-27。范围：`src/components` 下全部 18 个 Vue 组件，以及它们在页面中的调用。

原始审查覆盖 18 个组件，共 1728 行，全部有调用方，没有发现完全未使用的组件。下方清单中的文件名、行数和调用方数保留审查时的快照，调用方数量按直接引用它的 Vue 文件计数，不按模板出现次数计数。

已落实修改密码和更换邮箱：原两个 `Account*Content.vue` 分别调整为 `me/ChangePasswordDialog.vue`、`me/ChangeEmailDialog.vue`，使用居中 Dialog，增加取消按钮与提交期间关闭控制；账户面板关闭后再显示。基础 Dialog 已支持输入框的焦点循环和内容滚动，全局提示已提升到弹窗之上。其余组件整理仍是待实施方案。

## 结论

目前主要有四类问题：业务目录归属不准确，文件名与实际形态不符，没有独立用途的包装层，以及弹窗交互与异步状态处理不一致。

保留现有的组件规模和按业务分组方式。优先处理明确的问题；不要为了复用把收藏、错题重新合成通用页面，也不要把每段页面 HTML 都拆成组件。

## 业务范围与弹层形态

记录管理统一命名为 `PracticeRecordsPopup.vue`：保留 `PracticeRecords` 这个中性的业务名称，将底部弹层后缀统一为 `Popup`。当前能力是清理本机作答，后续可以增加线上记录管理；组件名称不加 `Local`，也不提前实现线上清理接口或来源适配层。`ClearPracticeRecordsDialog.vue` 保留现名，负责实际清理前的确认。

界面标题与入口使用“刷题记录”，清理选项按业务分类展示。实际作用范围放在必要的说明和确认文案中：当前操作只影响本机作答时，应明确说明，不能让“全部记录”暗示已包含线上记录。以后有线上能力，再展示对应操作，不提前放不可用的线上入口或来源切换。

采用用户指定的移动端组件命名习惯，项目只保留下面三种职责：

| 类型 | 本项目约定 | 适用场景 |
| --- | --- | --- |
| Popup / 弹出层 | 本项目采用底部弹出的内容容器，容纳操作、表单、设置或详情。内容由业务组件自己组织。 | 刷题记录、计划、设置、科目管理、答题卡、题目详情。 |
| Dialog / 对话框 | 居中的消息提示、操作确认或简短表单，按任务提供确认、保存与取消。 | 修改密码、更换邮箱、提示需要知晓的信息、确认交卷、确认清理记录、确认清空收藏/错题。 |
| Toast / 轻提示 | 自动消失的短消息，不要求用户确认。 | 保存成功、操作失败等即时反馈。 |

命名参考用户提供的 [TDesign Popup](https://tdesign.tencent.com/miniprogram/components/popup)、[Vant Dialog](https://vant4.ylhtest.com/#/zh-CN/dialog) 和 [Vant ActionSheet](https://vant4.ylhtest.com/#/zh-CN/action-sheet)。Vant 官方将 [Popup 定义为弹出层容器](https://github.com/youzan/vant/blob/main/packages/vant/src/popup/README.zh-CN.md)，将 [Dialog 用于消息提示与确认](https://github.com/youzan/vant/blob/main/packages/vant/src/dialog/README.zh-CN.md)。本项目按现有需求选用底部 Popup，不照搬组件库的全部位置和模式选项。

基础层使用 `BasePopup.vue`、`BaseDialog.vue` 和现有 `AppToast.vue`。将 `BaseModal` 调整为 `BasePopup`，底部业务弹层使用 `Popup` 后缀，修改密码等居中任务使用 `Dialog` 后缀。撤回增加 `BaseActionSheet` 的建议：记录操作、账户操作直接在 Popup 内组织即可，不再增加 Modal、ActionSheet 或 Sheet 这几套基础容器。未来只有明确需要可复用的标准动作列表时，再考虑独立 ActionSheet。

Popup 统一负责底部呈现、遮罩、关闭、焦点、滚动和安全区；列表、表单、计数及业务请求由各业务组件负责。Dialog 承载居中的提示、确认和简短输入任务。两者都要有准确的无障碍语义，组件命名不取决于底层使用的 CSS 类或 `aria-modal` 属性。

按现有用途重新归类：

| 当前业务 | 交互形态 | 调整原则 |
| --- | --- | --- |
| `PracticeRecordsModal` | Popup | 改为 `PracticeRecordsPopup`，保持记录管理范围中性。选择清理动作后关闭 Popup，再进入确认 Dialog。 |
| 我的页面的账户操作入口 | Popup | 展示修改密码、更换邮箱等操作；先关闭账户 Popup，再打开相应的居中 Dialog。 |
| `ClearPracticeRecordsDialog`、交卷确认、收藏/错题清空确认 | Dialog | 显示本次操作范围及后果，处理确认和取消，不承担记录分类选择。 |
| `PracticePlanModal` | Popup | 使用 `PracticePlanPopup`，保持计划表单草稿、校验与提交。 |
| 密码修改 | Dialog | 使用 `ChangePasswordDialog`，居中展示当前密码、新密码和确认密码，提供取消与保存。 |
| 邮箱修改 | Dialog | 使用 `ChangeEmailDialog`，居中展示当前邮箱、密码验证和新邮箱，提供取消与保存。 |
| `PracticeSettingsModal`、首页科目管理 | Popup | 使用 `PracticeSettingsPopup`、`SubjectManagerPopup`；承载设置控件或排序管理。 |
| `QuestionSheetModal` | Popup | 改为 `AnswerSheetPopup`，业务名明确表示答题卡，保留题号网格、滚动和当前题定位。 |
| 结果页题目详情 | Popup | 阅读题干、答案和解析，暂时直接使用基础 Popup。 |
| 收藏、错题排序菜单 | 锚定按钮的 Menu | 保留现有菜单位置与用途。 |

修改密码的流程为“账户 Popup → 收起 → 修改密码 Dialog”。等待账户 Popup 关闭后再显示 Dialog；取消后回到我的页面，不自动重新打开账户 Popup。保存期间防止重复提交，失败保留表单，成功沿用现有会话失效和跳转登录规则。`BaseDialog` 的焦点处理应覆盖输入框和按钮，不能沿用仅查找按钮的实现。

更换邮箱沿用相同的打开、关闭和提交交互。成功后由现有账户 Store 更新邮箱并关闭 Dialog，继续保留登录状态；失败保留表单。

这里只借鉴组件命名和交互划分，继续使用项目现有技术与样式，不引入完整 UI 组件库或全局弹层管理器。

## 全部组件清单

| 当前文件 | 行数 / 调用方数 | 实际职责 | 建议 |
| --- | --- | --- | --- |
| `BottomTabBar.vue` | 43 / 1 | 应用四个固定入口 | 保留。单一调用方符合应用底栏的职责，无需再拆导航项或配置文件。 |
| `common/AppToast.vue` | 23 / 1 | 显示全局操作结果 | 保留，优先修正弹窗遮挡提示的问题。 |
| `common/BaseModal.vue` | 65 / 8 | 底部弹层容器，桌面端当前居中 | 调整为 `common/BasePopup.vue`，统一底部呈现，承载现有业务内容；补齐焦点、语义和关闭控制。 |
| `common/BaseDialog.vue` | 108 / 4 | 审查时承载清空、清除、交卷等确认框 | 保留，并支持修改密码、更换邮箱这样的简短表单。焦点约束覆盖输入框和按钮，表单校验与提交留在业务 Dialog 中。 |
| `common/EmptyState.vue` | 66 / 3 | 空态、错误态及操作按钮 | 保留。`embedded` 已用于卡片内空态，有真实用途；暂不扩充更多样式模式。 |
| `common/PagePlaceholder.vue` | 13 / 3 | 统一首页、收藏、错题的加载和空态位置 | 保留。虽然代码少，但统一了三个页面的位置约定，不是无用包装。 |
| `common/SettingsToggleItem.vue` | 32 / 1 | 带标题、说明的设置开关行 | 保留。一个调用方里使用了四次，没有接口或业务状态，作为基础行组件合理。 |
| `auth/AuthField.vue` | 60 / 4 | 带标签、图标和校验错误的文本输入框 | 改为 `common/FormField.vue`。已同时用于登录、注册、修改邮箱和修改密码，实现本身没有认证业务逻辑；保持现有输入框能力即可。 |
| `auth/AuthFrame.vue` | 26 / 2 | 登录、注册共用的页面外观 | 保留。页面布局复用，不承接表单提交和路由守卫。 |
| `auth/AccountEmailContent.vue` | 139 / 1 | 完整的更换邮箱弹层，含校验和提交 | 已调整为 `me/ChangeEmailDialog.vue`，使用居中 Dialog，与修改密码交互一致。 |
| `auth/AccountPasswordContent.vue` | 154 / 1 | 完整的修改密码弹层，含提交和登录跳转 | 调整为 `me/ChangePasswordDialog.vue`，使用居中 Dialog；账户 Popup 先收起，再显示密码表单。与邮箱弹层分别维护，不抽通用账号表单。 |
| `settings/PracticeSettingsModal.vue` | 22 / 3 | 弹层外壳、关闭状态、转发参数 | 调整为 `practice/PracticeSettingsPopup.vue`，将下行组件合并进来。 |
| `settings/PracticeSettingsSection.vue` | 102 / 1 | 加载、修改刷题设置及设置项展示 | 合并进 `PracticeSettingsPopup.vue`。目前没有独立嵌入页面的使用场景，`active` 仅用于穿透打开状态。 |
| `practice/PracticePlanModal.vue` | 241 / 2 | 专业、科目选择及计划保存 | 调整为 `PracticePlanPopup.vue`，保留完整业务职责，修正请求失效、加载失败状态和保存回调。省份方案另行实施，本次不预设地区表单。 |
| `practice/PracticeQuestionPanel.vue` | 263 / 1 | 题干、选项、输入、答后反馈和解析 | 保留。作答页用它渲染当前及相邻题，边界清楚；继续通过 props 和事件协作，不加入接口、路由和本地记录管理。 |
| `practice/QuestionSheetModal.vue` | 228 / 1 | 答题卡题号、作答状态及跳题/交卷/清除入口 | 调整为 `AnswerSheetPopup.vue`，保留独立答题卡布局，由基础 Popup 承担共同弹层交互。通过内容插槽保留固定操作区和题号区滚动，不添加答题卡专用布局参数到基础组件。 |
| `practice/PracticeRecordsModal.vue` | 90 / 1 | 刷题记录管理操作入口，目前提供本机作答清理 | 调整为 `PracticeRecordsPopup.vue`；业务名、标题和布局保持中性，具体操作范围在说明和确认中体现。修正换账号后子确认框未关闭的问题。 |
| `practice/ClearPracticeRecordsDialog.vue` | 53 / 2 | 确认并执行本次指定的记录清理，目前校验账号后清理本机记录 | 保留现名与 Dialog 职责。作答页与记录操作面板都用到，确认文案必须对应实际清理范围；不提前实现线上清理。 |

## 已确认的行为问题

### 1. 弹窗会遮挡操作提示（已修复）

- 审查时 `AppToast.vue:10` 使用 `z-50`，本轮已调整为 `z-[1000]`。
- 当前安装的 DaisyUI 及实际构建产物中，`.modal` 的 `z-index` 是 `999`，同时用于 `BaseModal`、`BaseDialog`。
- 例如修改邮箱或保存计划失败时，组件保留弹窗并依赖请求层提示，提示消息会落在弹窗遮罩下面。
- 处理：明确页面、弹层和全局提示的层级，使提示高于全部弹窗。修正当前样式即可，无需新增层级管理服务。

验证方式：对照组件、当前依赖样式和本地生产构建产物。尚未进行浏览器视觉走查。

### 2. 清空专业后，旧科目请求仍会回填

- 位置：`PracticePlanModal.vue:38`。
- `loadSubjectOptions('')` 直接清空并返回，没有递增请求序号，也没有结束原来的加载状态。
- 复现：选择专业 A，在科目请求返回前把专业改回空值；A 的响应随后到达，专业为空，但 `displaySubjects` 又包含 A 的科目。
- 处理：每次切换都先使旧请求失效，包括清空值；空值分支同时清理加载状态。失败要显示失败和重试，不与“该专业暂无科目”混在一起。

验证方式：运行真实组件 setup，使用可控的替代接口响应，已复现上述状态。

### 3. 上一次保存会关闭重新打开的计划弹窗

- 位置：`PracticePlanModal.vue:107`；原邮箱弹窗存在同类关闭逻辑，现通过提交期间禁用关闭避免同一轮保存时关闭重开。
- 复现：开始保存计划，关闭弹窗后重新打开；旧保存完成时直接执行 `model.value = false`，把新打开的弹窗关闭。
- Store 已有账号隔离，但没有表示“这是第几次打开”的局部状态。
- 处理：允许关闭时，使旧回调失去操作新弹窗的资格；提交期间是否允许关闭也应有明确、一致的约定。保存结果仍可正常更新当前账号的共享计划。

验证方式：运行真实计划组件 setup，控制保存完成时机，已复现重新打开后被关闭。

### 4. 换账号后，记录确认框仍保留旧流程

- 位置：`PracticeRecordsModal.vue:32`、`PracticeRecordsModal.vue:36`。
- 页面切换账号会关闭外层 `recordsModalOpen`，但组件内部的 `clearOpen` 和 `clearScope` 没有同步清理。
- 复现：账号 A 打开清除确认框，切到账号 B；确认框仍指向 A。关闭确认框又触发监听器，重新打开记录弹窗。
- `ClearPracticeRecordsDialog` 会核对账号，因此这里不是跨账号误删问题；问题在于旧确认流程和重新打开行为延续到了新账号。
- 处理：账号改变时清理整个记录操作流程；只有同一账号、同一轮操作正常结束时才返回记录操作面板。

验证方式：运行真实记录组件 setup，并模拟调用页面关闭外层弹窗，已复现。

### 5. 审查时三种弹层的基础交互不一致

| 行为 | BaseModal | BaseDialog | QuestionSheetModal |
| --- | --- | --- | --- |
| 弹窗语义和名称 | 未声明 `role="dialog"`、`aria-modal` | 有 | 有 |
| Tab 焦点约束 | 无 | 有，仅覆盖按钮，适用于当前确认框用途 | 有，仅覆盖按钮，适用于当前题号和操作 |
| 关闭后恢复焦点 | 无 | 有 | 有 |
| 提交期间控制 Esc / 遮罩关闭 | 无 | 有，交卷已使用 | 无提交中状态，操作交由页面处理 |
| 滚动限制 | 依赖 DaisyUI 样式 | 依赖 DaisyUI 样式 | 自己修改 body overflow |

处理方向：底部内容统一为 Popup，居中的消息提示、确认和密码/邮箱修改使用 Dialog，统一焦点、关闭和层级等基础规则。答题卡保留业务布局，复用 Popup 的弹层交互。不引入弹窗注册中心、全局队列或模式配置体系；焦点约束必须覆盖输入框等实际可交互元素。

本轮已补齐 `BaseDialog` 对输入框、选择框、文本域等元素的焦点循环，并允许内容区域在可用高度不足时滚动，适用于修改密码表单；Popup 的整体整理仍待实施。

## 页面里值得检查的组件边界

### 收藏和错题的排序菜单

两页必须继续独立维护业务。上一步拆分页面时，排序菜单的展开、外部点击、键盘操作、焦点处理及模板也被完整复制了。

这一段适合提取为 `common/SortMenu.vue`：只接收排序选项和当前选中值，发出选择事件，处理菜单交互。具体有哪些排序方式、怎样请求数据、如何更新 URL、失败后回退到哪里，仍由收藏页和错题页各自负责。不提取统一列表页面或统一列表请求控制器。

### 首页科目管理

`HomeView.vue:698` 内嵌了完整的科目管理弹窗，同时在页面内处理显示隐藏和排序。这是一个可以单独修改的实际功能，比把图标、头像、题集行都拆成小组件更值得提取。

建议放在 `components/home/SubjectManagerPopup.vue`，只展示科目并发出选择、显示切换和移动事件。首页继续负责持久化、当前科目和路由筛选。安排在基础问题之后处理，不与地区课程方案捆绑。

### 暂时继续放在页面内的内容

- 我的页面中的账户入口列表：改用 Popup 容器，选项继续由页面处理，不再额外拆一个只有转发功能的业务壳组件。“通知暂未开放”文案暂留页面。
- 结果页的只读题目详情：目前只在结果页使用，先保留；不要强行复用带作答交互的 `PracticeQuestionPanel`。
- 首页与作答页的普通按钮、图标、标题：沿用现有样式即可，不新增一套 Button / Icon / PageHeader 包装。

## 建议目录

下面列的是调整后的目标，并非当前已经完成的结构。

```text
src/components/
  BottomTabBar.vue
  common/
    AppToast.vue
    BasePopup.vue
    BaseDialog.vue
    EmptyState.vue
    PagePlaceholder.vue
    FormField.vue
    SettingsToggleItem.vue
    SortMenu.vue
  auth/
    AuthFrame.vue
  me/
    ChangeEmailDialog.vue
    ChangePasswordDialog.vue
  practice/
    PracticePlanPopup.vue
    PracticeSettingsPopup.vue
    PracticeQuestionPanel.vue
    AnswerSheetPopup.vue
    PracticeRecordsPopup.vue
    ClearPracticeRecordsDialog.vue
  home/
    SubjectManagerPopup.vue
```

`settings/` 移除：现有内容全部属于刷题业务。以后有通知设置，就归通知业务；不再把不同业务集中到一个不断增长的 settings 目录。

业务弹窗可以直接使用自己的 Store 或接口，不为“组件纯净”而把所有提交过程推给页面。只有在多个入口之间确实需要同步的数据才进 Store；打开状态、草稿和本次提交状态留在组件。

## 调整顺序与验收

1. 先修正提示层级、计划请求失效、旧保存回调和记录确认框的账号切换；这些已经影响现有行为。
2. 保留记录相关组件的中性业务名称；统一底部弹层的 Popup 后缀，调整 Content 名称和目录，合并两层刷题设置，更新全部引用，不保留旧组件转发文件。
3. 分清 Popup、Dialog 和 Toast 的职责，整理记录与账户操作面板；对齐键盘、焦点和关闭行为，保留答题卡独立布局和滚动。
4. 提取排序菜单，再单独整理首页科目管理；避免把页面业务重新合并。

结构调整使用类型检查、现有测试、lint 和生产构建验证。新增测试只覆盖上述异步竞态、换账号和弹窗交互等实际行为，不为文件搬迁写镜像测试。浏览器走查覆盖表单输入、Esc/遮罩关闭、提示可见性、关闭后焦点、弹窗切换和移动端滚动。

审查及组件复现没有调用真实接口或改动业务数据；行为复现使用本地 Vue 运行时和替代数据。修改密码实现已通过类型检查、140 项现有测试、lint、格式检查和生产构建；另外验证了输入框焦点循环、密码校验、防重复提交、失败保留表单、取消清空与成功跳转登录。尚未进行浏览器视觉走查。
