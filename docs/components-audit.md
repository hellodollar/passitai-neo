# 客户端组件约定

更新：2026-11-06。项目按当前业务拆组件，页面保留自己的请求、筛选和导航；只提取确有复用或独立交互的部分。

## 弹层名称

| 名称 | 用途 | 当前实例 |
| --- | --- | --- |
| Popup | 从底部弹出的内容层，可承载操作、设置、表单或详情 | 刷题计划、刷题设置、刷题记录、答题卡、科目管理、账户操作、外观选择、省份/专业选择、结果详情 |
| Dialog | 居中的确认或简短输入任务 | 修改密码、更换邮箱、交卷确认、清除记录、清空收藏或错题 |
| Toast | 自动消失的操作反馈 | 保存成功、操作失败 |

基础容器只有 `common/BasePopup.vue` 和 `common/BaseDialog.vue`，二者均基于原生 `<dialog>`（焦点陷阱、Esc、背景惰性化由浏览器提供）；`common/AppToast.vue` 负责提示。业务组件按实际形态使用 `Popup` 或 `Dialog` 后缀，不使用 `Modal` 命名。账户 Popup 收起后才打开密码或邮箱 Dialog，取消时返回“我的”页面。刷题记录保持中性名称；现有清理操作只影响本机作答，范围在操作与确认文案中说明。

## 目录与职责

```text
src/components/
  BottomTabBar.vue
  collection/
    CollectionListView.vue
  common/
    AppToast.vue
    BaseDialog.vue
    BasePopup.vue
    EmptyState.vue
    FormField.vue
    LogoPassitai.vue
    OptionSheet.vue
    PagePlaceholder.vue
    SettingsToggleItem.vue
    SortMenu.vue
  auth/
    AuthFrame.vue
  home/
    SubjectManagerPopup.vue
  me/
    AppearancePopup.vue
    ChangeEmailDialog.vue
    ChangePasswordDialog.vue
  practice/
    AnswerSheetPopup.vue
    ClearPracticeRecordsDialog.vue
    PracticePlanPopup.vue
    PracticeQuestionPanel.vue
    PracticeRecordsPopup.vue
    PracticeSettingsPopup.vue
```

- `BasePopup` 和 `BaseDialog` 依赖原生 dialog 处理遮罩、Esc、焦点陷阱及恢复；业务内容通过默认插槽或头部、底部插槽放入，不增加针对某个业务的基础属性。弹层本体常驻 DOM，内容随开合挂载销毁。
- `CollectionListView` 是收藏与错题共享的集合列表：加载、分组排序、清空确认与浏览记忆只实现一次，两个来源的差异（文案、图标、接口、练习路由）收敛在 `sourceConfig`；FavoritesView/MistakesView 仅是薄壳。
- `OptionSheet` 用弹层单选列表替代原生 select（原生展开列表无法样式化且被视口裁剪）；刷题计划的省份与专业选择使用它。
- `LogoPassitai` 内联品牌字标，文字部分用 `currentColor` 跟随主题，深浅模式均可读。
- `AnswerSheetPopup` 保留题号网格、当前题定位和独立滚动；`PracticeQuestionPanel` 只负责题目展示与输入，不管理路由、请求或记录。
- `PracticePlanPopup` 管理表单草稿、选项加载和保存；切换省份、学历、专业，关闭弹层或换账号都会使旧请求失效，失败时可重试。
- `PracticeSettingsPopup` 管理刷题设置与保存，不再有只转发属性的额外组件层。
- `PracticeRecordsPopup` 负责选择管理操作，`ClearPracticeRecordsDialog` 负责确认范围和执行；换账号会结束旧确认流程。
- `SortMenu` 只负责排序菜单交互；列表数据由 `CollectionListView` 统一管理。
- `SubjectManagerPopup` 只展示科目和发出选择、显隐、移动事件；首页负责实际顺序、当前选择和浏览记忆。
