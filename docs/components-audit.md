# 客户端组件约定

更新：2026-11-06。项目按当前业务拆组件，页面保留自己的请求、筛选和导航；只提取确有复用或独立交互的部分。

## 弹层名称

| 名称   | 用途                                             | 当前实例                                                                                    |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Popup  | 从底部弹出的内容层，可承载操作、设置、表单或详情 | 刷题计划、刷题设置、数据清理、答题卡、科目管理、账户操作、外观选择、省份/专业选择、结果详情 |
| Dialog | 居中的确认或简短输入任务                         | 修改密码、更换邮箱、交卷确认、清除记录、清空收藏或错题                                      |
| Toast  | 自动消失的操作反馈                               | 保存成功、操作失败                                                                          |

基础容器只有 `common/BasePopup.vue` 和 `common/BaseDialog.vue`，二者均基于原生 `<dialog>`（焦点陷阱、Esc、背景惰性化由浏览器提供）；`common/AppToast.vue` 负责提示。业务组件按实际形态使用 `Popup` 或 `Dialog` 后缀，不使用 `Modal` 命名。账户 Popup 收起后才打开密码或邮箱 Dialog，取消时返回“我的”页面。数据清理 Popup 在确认期间保持打开，由原生 dialog 管理层叠与焦点，取消或完成后回到清理面板。

## 目录与职责

```text
src/components/
  BottomTabBar.vue
  collection/
    ClearCollectionDialog.vue
    CollectionListView.vue
  common/
    AppToast.vue
    BaseDialog.vue
    BasePopup.vue
    EmptyState.vue
    FormField.vue
    LogoPassitai.vue
    OptionSheet.vue
    PageContainer.vue
    PageHeader.vue
    PagePlaceholder.vue
    SettingsToggleItem.vue
    SortMenu.vue
  auth/
    AuthFrame.vue
  home/
    HomePlanCard.vue
    HomePracticeEntries.vue
    SubjectManagerPopup.vue
  me/
    AppearancePopup.vue
    ChangeEmailDialog.vue
    ChangePasswordDialog.vue
    DataCleanupPopup.vue
  practice/
    AnswerSheetPopup.vue
    ClearPracticeRecordsDialog.vue
    PracticePlanPopup.vue
    PracticeQuestionPanel.vue
    PracticeResultQuestionPopup.vue
    PracticeSettingsPopup.vue
```

- `BasePopup` 和 `BaseDialog` 依赖原生 dialog 处理遮罩、Esc、焦点陷阱及恢复；业务内容通过默认插槽或头部、底部插槽放入，不增加针对某个业务的基础属性。弹层本体常驻 DOM，内容随开合挂载销毁。
- `PageContainer` 统一页签内容的留白、安全区和占位定位，不读取路由或业务状态。`PageHeader` 统一固定页头，接收标题和返回按钮名称、发出返回事件，通过插槽承载练习进度。
- `CollectionListView` 是收藏与错题共享的集合列表：加载、分组排序与浏览记忆只实现一次，两个来源的差异（文案、图标、接口、练习路由）收敛在 `sourceConfig`；FavoritesView/MistakesView 仅是薄壳。
- `OptionSheet` 用弹层单选列表替代原生 select（原生展开列表无法样式化且被视口裁剪）；刷题计划的省份与专业选择使用它。
- `LogoPassitai` 内联品牌字标，文字部分用 `currentColor` 跟随主题，深浅模式均可读。
- `AnswerSheetPopup` 保留题号网格、当前题定位和独立滚动；`PracticeQuestionPanel` 只负责题目展示与输入，不管理路由、请求或记录。
- `PracticePlanPopup` 管理表单草稿、选项加载和保存；切换省份、学历、专业，关闭弹层或换账号都会使旧请求失效，失败时可重试。
- `PracticeSettingsPopup` 管理刷题设置与保存，不再有只转发属性的额外组件层。
- `DataCleanupPopup` 按作答记录、收藏和错题组织清理入口，不显示数量或常驻说明。作答组的“全部清除”仅清除本机作答，包含收藏与错题练习的本地记录，不混合清空账号数据。范围在确认框说明。
- `ClearPracticeRecordsDialog` 确认并清理本机作答；`ClearCollectionDialog` 由清理面板与集合列表共用，确认后清空当前账号的收藏或错题。请求中阻止重复操作和关闭，失败可重试，换账号或离页后旧响应失效。
- `SortMenu` 只负责排序菜单交互；列表数据由 `CollectionListView` 统一管理。
- `HomePlanCard` 接收计划并自行计算省份、考试日期与倒计时展示，只发出打开计划、设置的意图；加载、错误和空计划仍由首页决定。
- `HomePracticeEntries` 接收已合并本地进度的题集入口、当前选中入口、加载态与科目名，负责入口色彩图标和题集映射展示，不自行请求或读取路由；选择入口和开始题集通过事件交给首页。
- `AiPracticePanel` 是 AI 练习入口的静态还原面板（推荐卡、自定义生成、历史列表），数据为组件内占位，AI 训练接口落地后由 store 提供同构数据并接通操作。
- `SubjectManagerPopup` 只展示科目和发出选择、显隐、移动事件；首页负责实际顺序、当前选择和浏览记忆。
- `PracticeResultQuestionPopup` 使用一个题目对象的双向模型管理当前详情；关闭弹层即清空选择，不同时维护两份开合状态。报告页面不再内嵌详情展示。
- `usePracticeResult` 管理报告请求、加载/错误状态、当前账号与目标的请求校验和卸载失效；不处理路由跳转或弹层。报告页面保留筛选与显示分组。
