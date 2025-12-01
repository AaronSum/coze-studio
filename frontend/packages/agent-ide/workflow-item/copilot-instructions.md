# @coze-agent-ide/workflow-item — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/workflow-item）中安全、高效地协作开发。

## 一、子包定位与职责边界
- 本包位于 agent-ide 域，提供「工作流卡片列表」类 UI，方便在 Agent 详情页等场景中展示和跳转 Workflow。
- 对外入口为 src/index.ts，导出 `WorkFlowItemCozeDesign` 组件及其 props 类型 `WorkflowItemProps`，作为上层页面复用的统一组件。
- 组件本身不发起网络请求，仅依赖：
  - agent-ide 层工具组件：`@coze-agent-ide/tool` 的 `ToolItem`、`ToolItemList`；
  - 导航能力：`@coze-agent-ide/navigate` 的 `useNavigateWorkflowEditPage`；
  - 上游状态与类型：`@coze-arch/bot-studio-store` 的空间信息、`@coze-studio/bot-detail-store` 的 `WorkFlowItemType`；
  - 基础设施：`@coze-arch/i18n`、`@coze-arch/coze-design`、`@coze-arch/bot-hooks`、`@coze-arch/bot-error`、`@coze-arch/report-events` 等。
- 额外提供 hook `useNavigateWorkflowOrBlockwise`（src/hooks/use-navigate-workflow.ts），统一处理「跳转 workflow / 拦截脏数据」逻辑，被组件内部调用。

## 二、整体数据流与关键行为
- 输入数据：
  - `list: Array<WorkFlowItemType | undefined>`：工作流条目数组，允许包含空位，组件内部会使用 `filter(Boolean)` 清洗。
  - `removeWorkFlow(index: number)`：删除指定下标 workflow 的回调，由上层维护真正数据源。
  - `isReadonly?: boolean`：控制是否允许删除等交互行为（由子组件 Actions 决定）。
  - `pageFrom?: BotPageFromEnum`、`sceneType?: SceneType`：标记当前所在页面/场景，用于导航与埋点。
  - `size?: 'default' | 'large'`：透传给 ToolItem 控制卡片尺寸。
  - 插槽：
    - `renderToolItemIcon?(params: RenderSlotParameters): ReactNode`：自定义卡片右侧图标区域。
    - `renderActionSlot?(params: RenderSlotParameters & ActionsCallback): ReactNode`：注入额外操作按钮区域（配合 `handleCopy`）。
- 渲染流程：
  1. 使用 `useSpaceStore` + `useShallow` 读取当前 `spaceID`，作为导航入参的一部分。
  2. 调用 `useNavigateWorkflowEditPage({ newWindow: true, spaceID }, sceneType)` 得到基础编辑页跳转函数 `onNavigate2Edit`。
  3. 调用 `useNavigateWorkflowOrBlockwise({ onNavigate2Edit, spaceID })` 生成包装后的 `navigateToWorkflow`：
     - 若 `workflowId` 为空或为 "0"，视为脏数据，弹出 `workflow_error_jump_tip` 提示并阻止跳转；
     - 否则调用 `onNavigate2Edit(workflowId)` 进入工作流编辑页。
  4. 将 `list` 过滤后映射为 `ToolItem`：
     - 标题：`item.name`；描述：`item.desc`；头像：`item.plugin_icon`。
     - `icons` 使用 `renderToolItemIcon` 自定义图标区（入参含 `apiUniqueId`）。
     - `actions` 渲染内部 `Actions` 组件，注入 `removeWorkFlow`、`isReadonly` 以及 `renderActionSlot` 插槽。
     - `onClick` 回调调用 `navigateToWorkflow(item.workflow_id)` 完成跳转。
- 复制行为：
  - `handleCopy(text: string)` 内部调用 `copy-to-clipboard`：
    - 复制成功：展示 `copy_success` Toast，固定 `id: 'workflow_copy_id'`；
    - 返回 false 或抛异常：抛出 `CustomError(ReportEventNames.parmasValidation, 'empty content')` 或降级为 `copy_failed` Toast。
  - 供 `renderActionSlot` 通过 `ActionsCallback` 使用（如“复制链接/ID”按钮）。

## 三、代码结构与约定
- 目录简要：
  - src/index.ts：公共导出入口，统一 re-export `WorkFlowItemCozeDesign` 与 `WorkflowItemProps`。
  - src/components/workflow-item/index.tsx：核心 UI 组件实现。
  - src/hooks/use-navigate-workflow.ts：封装导航逻辑的自定义 hook。
  - typings.d.ts：本包的 ambient 类型声明（如需要全局类型，可放在这里）。
- 类型与参数约定：
  - `RenderSlotParameters = WorkFlowItemType & { apiUniqueId: string }`：插槽入参在 workflow 领域内扩展了 `apiUniqueId`，来自 `getApiUniqueId({ apiInfo: item })`。
  - `ActionsCallback.handleCopy(text: string)`：由组件提供的工具函数，保证复制行为与 Toast 文案统一。
- 依赖使用模式：
  - 状态获取通过 `useSpaceStore` + `useShallow` 选择器，避免整店重渲染；新增依赖字段时尽量在 selector 中一次性取出。
  - 所有文案使用 `I18n.t(key)`，新增提示时需在 i18n 资源包中添加 key（本包内不存放文案表）。
  - Toast 使用 `@coze-arch/coze-design`，`showClose: false` 为统一体验，非必要不要改动。

## 四、开发与调试流程
- 依赖安装（在仓库根目录）：
  - 使用 Rush 管理 workspace 依赖：`rush update` 或参考 frontend/README 中的脚本。
- 本包脚本（在 frontend/packages/agent-ide/workflow-item 目录）：
  - `npm run build`：当前为 `exit 0` 占位，本包不独立打包，构建由上层应用负责。
  - `npm run lint`：运行 ESLint，规则来自 `@coze-arch/eslint-config`（web 预设）。
  - `npm test`：`vitest --run --passWithNoTests`，可新增针对 hook 与组件的单测。
  - `npm run test:cov`：在 test 基础上收集覆盖率。
- 推荐联调方式：
  - 在实际使用本组件的 Agent 详情或 IDE 页面中调试；通过启动对应 app（如 frontend/apps 下相关应用）的 dev server，观察点击跳转、删除、复制等行为。

## 五、对 AI 助手的实现建议
- 修改组件时的注意点：
  - 保持 `WorkFlowItemCozeDesign` 的 props 兼容，新增能力优先通过可选 props 或插槽拓展，而非修改现有字段语义。
  - 不要在组件中新增与 Workflow 运行或后端请求相关的逻辑；本包只负责展示与导航，业务调用应在上层完成。
  - 若需要扩展跳转参数或策略，请在 `useNavigateWorkflowOrBlockwise` 中集中处理，避免在多处散落判断逻辑。
- 使用 hook 的约定：
  - `useNavigateWorkflowOrBlockwise` 目前通过 `Record<string, any>` 接收参数，内部仅依赖 `spaceID` 与 `onNavigate2Edit`；
  - 若未来需要更多依赖（例如埋点参数），建议显式声明参数类型，避免继续扩散 any。
- 新增行为的典型路径：
  - 想要在卡片上增加新的操作入口（如“在新标签打开运行日志”）：
    - 在上层页面实现业务逻辑，并通过 `renderActionSlot` 渲染按钮；
    - 按需使用 `apiUniqueId`、`handleCopy` 等信息，不在本组件中直接写业务跳转。
  - 想要根据不同场景改变点击行为：
    - 在 `useNavigateWorkflowOrBlockwise` 中增加基于 `sceneType` 的分支逻辑，并通过 props 传入合适的 `sceneType`。

## 六、特殊注意事项
- `list` 允许传入 `undefined` 条目，组件内部会过滤；如果上层不希望“跳过”某些位置，应在自身逻辑中先处理。
- `navigateToWorkflow` 对 `workflowId === '0'` 的判断是约定俗成的脏数据标记，AI 修改逻辑时不要删除这层防护；如需扩展更多无效 ID 规则，应一并复用 `workflow_error_jump_tip` 文案或新增明确提示。
- 复制逻辑使用固定 Toast id `workflow_copy_id`，以避免重复堆叠；如变更 id，需确认不会与其他复制操作冲突。
