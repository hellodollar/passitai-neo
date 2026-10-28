# 客户端组件约定

更新：2026-10-28。项目按当前业务拆组件，页面保留自己的请求、筛选和导航；只提取确有复用或独立交互的部分。

## 弹层名称

| 名称 | 用途 | 当前实例 |
| --- | --- | --- |
| Popup | 从底部弹出的内容层，可承载操作、设置、表单或详情 | 刷题计划、刷题设置、刷题记录、答题卡、科目管理、账户操作、结果详情 |
| Dialog | 居中的确认或简短输入任务 | 修改密码、更换邮箱、交卷确认、清除记录、清空收藏或错题 |
| Toast | 自动消失的操作反馈 | 保存成功、操作失败 |

基础容器只有 `common/BasePopup.vue` 和 `common/BaseDialog.vue`；`common/AppToast.vue` 负责提示。业务组件按实际形态使用 `Popup` 或 `Dialog` 后缀，不使用 `Modal` 命名。账户 Popup 收起后才打开密码或邮箱 Dialog，取消时返回“我的”页面。刷题记录保持中性名称；现有清理操作只影响本机作答，范围在操作与确认文案中说明。

## 目录与职责

```text
src/components/
  BottomTabBar.vue
  common/
    AppToast.vue
    BaseDialog.vue
    BasePopup.vue
    EmptyState.vue
    FormField.vue
    PagePlaceholder.vue
    SettingsToggleItem.vue
    SortMenu.vue
    overlay.ts
  auth/
    AuthFrame.vue
  home/
    SubjectManagerPopup.vue
  me/
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

- `BasePopup` 和 `BaseDialog` 处理遮罩、Esc、焦点循环及恢复；业务内容通过默认插槽或头部、底部插槽放入，不增加针对某个业务的基础属性。
- `AnswerSheetPopup` 保留题号网格、当前题定位和独立滚动；`PracticeQuestionPanel` 只负责题目展示与输入，不管理路由、请求或记录。
- `PracticePlanPopup` 管理表单草稿、选项加载和保存；切换专业、关闭弹层或换账号都会使旧请求失效，失败时可重试。
- `PracticeSettingsPopup` 管理刷题设置与保存，不再有只转发属性的额外组件层。
- `PracticeRecordsPopup` 负责选择管理操作，`ClearPracticeRecordsDialog` 负责确认范围和执行；换账号会结束旧确认流程。
- `SortMenu` 只负责排序菜单交互；收藏与错题继续各自管理列表、接口、筛选、失败回退、清空及滚动记忆。
- `SubjectManagerPopup` 只展示科目和发出选择、显隐、移动事件；首页负责实际顺序、当前选择和浏览记忆。

原审查发现的科目请求回填、旧保存关闭新弹层、换账号后保留旧清理确认，以及弹层遮挡 Toast 的问题均已修正。当前行为通过本地 Vue 运行时复现与回归测试验证；没有对线上账号或数据执行操作。
