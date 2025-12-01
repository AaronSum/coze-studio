# frontend/packages/agent-ide/entry-adapter

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/entry-adapter）中安全、高效地协作开发。

## 全局架构与职责定位
- 本包是 Agent IDE 的「入口适配层」，主要导出带上下文的 Bot 编辑器组件：`src/index.ts` 暴露 `BotEditor`（实际为 `BotEditorWithContext`）。
- 核心编辑逻辑位于 `src/editor/agent-editor.tsx`，该组件不直接管理路由或全局状态，而是通过一系列跨包的 Store、Provider 和 Hook 嵌入到 Coze Studio 主应用。
- 该入口组件根据 Bot 信息（`useBotInfoStore`）判断当前是单模型模式（`BotMode.SingleMode`）还是工作流模式（`BotMode.WorkflowMode`），并分别渲染：
  - 单模型编辑界面：`SingleMode`（来自 `@coze-agent-ide/bot-creator`）。
  - 工作流编辑界面：`WorkflowMode`（同样来自 `@coze-agent-ide/bot-creator`）。
- 包内对「工具面板」「记忆工具」等 UI 只做“插槽级别”的定制：
  - 单模型工具栏：`SingleModeToolPaneList`，从 `src/components/single-mode-tool-pane-list` 导入（实现位于其他包或待补充，当前仅作为占位与依赖路径）。
  - 工作流工具栏：`WorkflowModeToolPaneList`，从 `src/components/workflow-mode-tool-pane-list` 导入。
  - 表格记忆工具：`TableMemory`，从 `src/components/table-memory-tool` 导入。
- 包外依赖承担大部分业务逻辑：
  - Bot 详情与运行时：`@coze-studio/bot-detail-store/*`。
  - Space / 工作区信息：`@coze-arch/bot-studio-store`。
  - Prompt 编辑器：`@coze-common/prompt-kit-base`。
  - Agent IDE 基础能力：`@coze-agent-ide/*` 系列（bot-creator、model-manager、space-bot 等）。

## 关键数据流与上下文
- 运行态与初始化：
  - `usePageRuntimeStore` 提供 `isInit` 等运行态字段，用于控制是否上报 TTI、是否可以渲染编辑器。
  - `useInitStatus`（来自 `@coze-common/chat-area`）用于统一判断聊天区域/页面是否完成初始化；在状态为 `unInit` 或 `loading` 时，`BotEditor` 返回 `null`，避免闪烁与无效渲染。
- Bot 信息：
  - `useBotInfoStore` 提供 `botId` 与 `mode`（`BotMode.SingleMode` / `BotMode.WorkflowMode`），用于确定渲染的编辑模式和上报用户行为中的资源信息。
- Space / Workspace：
  - `useSpaceStore` 提供当前 `spaceId`，用于埋点上报、toast 初始化等跨模块操作。
- 上下文 Provider 组合（外层包装组件）：
  - `BotEditorWithContext` 依次包裹：
    - `BotEditorContextProvider`（编辑上下文 Store）。
    - `BotEditorServiceProvider`（编辑服务层，如保存、发布等）。
    - `PromptEditorProvider`（Prompt 编辑上下文）。
    - `FormilyProvider`（表单/模型管理上下文）。
  - 任何需要使用这些上下文的子组件必须在 `BotEditorWithContext` 的树下渲染，新增组件时请不要绕过该入口单独挂载。

## 组件行为与外部集成
- 模式切换与 UI 插槽：
  - 单模型模式：
    - 通过 `SingleMode` 的 `renderChatTitleNode` 插槽注入 `SingleModeToolPaneList`，用于扩展聊天顶部工具栏/操作区。
    - 通过 `memoryToolSlot` 注入 `TableMemory`，作为「表格存储」类型的记忆工具入口。
  - 工作流模式：
    - 通过 `WorkflowMode` 的 `renderChatTitleNode` 插槽注入 `WorkflowModeToolPaneList`。
    - 同样通过 `memoryToolSlot` 复用 `TableMemory`。
- 用户行为与埋点上报：
  - 首屏性能：`useReportTti`（`@coze-arch/report-tti`）在页面初始化完成时上报 TTI，`scene` 固定为 `page-init`，`extra.mode` 为 `bot-ide`。扩展埋点时应复用该 Hook 或相同的埋点体系。
  - 最近打开：`useEffect` 中调用 `PlaygroundApi.ReportUserBehavior` 上报 `BehaviorType.Visit`，`resource_type` 固定为 `SpaceResourceType.DraftBot`，携带 `botId` 与 `spaceId`。新增行为类型时需遵循该 API 的入参约定。
- 编辑流程相关 Hook：
  - `useEditConfirm`：统一处理编辑确认/离开确认等逻辑（例如关闭前提醒未保存修改）。
  - `useSubscribeOnboardingAndUpdateChatArea`：将新手引导与聊天区域更新关联起来。
  - `useInitToast(spaceId)`：注册与当前空间相关的全局提示/通知。
  - `useGetModelList()`：在编辑器加载时预加载可用模型列表，避免后续交互时延迟加载。

## 开发与构建流程
- 本包为 Rush 管理的 workspace 包，位于 `frontend/packages/agent-ide/entry-adapter`：
  - 依赖安装：在仓库根目录执行 `rush install` 或 `rush update`。
  - 本包自身脚本定义在 `package.json`：
    - 构建：`npm run build`（当前是 `exit 0` 占位，不生成独立 bundle，实际使用由上层应用通过源码引用）。
    - Lint：`npm run lint`，使用 `eslint.config.js` 中的 `@coze-arch/eslint-config` 预设，`preset: 'web'`。
    - 单测：`npm run test`，通过 `vitest` 执行，`vitest.config.ts` 使用 `@coze-arch/vitest-config` 的 `web` 预设。
    - 覆盖率：`npm run test:cov`，在上述测试基础上开启 coverage。
- TypeScript 工程配置：
  - 根 `tsconfig.json` 仅作为复合项目入口，全部文件默认被 `exclude: ['**/*']` 排除，真正的编译配置在 `tsconfig.build.json`、`tsconfig.misc.json` 中，由上层工具引用（无需在本包手动修改全局 ts 规则时改动 `tsconfig.json`）。
- Storybook / 组件调试：
  - README 中标明本模板支持 Storybook，但本子包未直接暴露相应脚本；如需为该包增加 Storybook，请遵循前端根目录下的统一 Storybook 配置规范（参考其它包实现）。

## 项目约定与风格
- 代码风格：
  - 使用 `@coze-arch/eslint-config` + TypeScript 严格模式；新增文件请保持相同的 import 顺序与 React 函数组件写法（`React.FC` / 箭头函数组件）。
  - 使用 `zustand` 的 `useShallow` 选择器以减少渲染；在新增 Store 订阅时尽量只选择所需字段，避免传递整个状态对象。
- 组件组织：
  - 所有与编辑器入口相关的容器组件放在 `src/editor`，具体 UI 模块（工具栏、记忆工具等）放在 `src/components/*`。
  - `src/index.ts` 仅做对外导出，不应承载业务逻辑；如需新增导出，请统一从对应的功能模块 re-export。
- 上下文与副作用：
  - `BotEditor` 内的副作用（埋点、初始化调用等）集中在组件顶部和 `useEffect` 内；
    - 新增副作用时请确保依赖数组正确填写，避免频繁上报或重复初始化。
    - 所有需要使用 Space / Bot 信息的逻辑优先复用已有 Store 与 Hook，而不是直接从 URL/query-string 解析。

## 与上层应用的集成方式
- 典型使用场景：
  - 在 Studio 主应用（如 `apps/coze-studio`）中，将 `BotEditor` 作为某个路由或面板的子组件渲染，前置条件是：
    - 已在更外层挂载全局 Provider（如 Router、全局 Store、国际化、设计系统等），以满足本包依赖的跨包 Hook 需求。
    - 上层已完成 PageRuntime 与 BotDetail 等 Store 初始化；否则 `useInitStatus` / `usePageRuntimeStore` 会导致编辑器不渲染。
- 对外 API：
  - 默认导出：`BotEditorWithContext`（类型上等同于 `React.FC`），上层一般直接使用默认导出即可。
  - 具名导出：`BotEditor`（同 `BotEditorWithContext`），保留给可能需要进一步包装的调用方。

## 团队流程与约束
- 质量门槛：
  - 在 `frontend/rushx-config.json` 中本包被标记为 `level-3`，Codecov 配置对 level-3 没有强制覆盖率要求，但仍建议为关键逻辑（模式切换、埋点调用、插槽渲染）补充基础单测。
  - `packageAudit` 要求该包必须存在 `eslint.config.js`，删除或重命名会触发 Rush 检查失败。
- 提交流程（从整个前端来看）：
  - 使用 Rush 管理依赖与构建，一般不在子包中单独运行 `pnpm install`。
  - 修改跨包依赖（如新增 `@coze-agent-ide/*` 包依赖）时，需同时在对应包内维护语义清晰的导出结构，避免循环依赖。

## 开发建议（对 AI 助手的特别提示）
- 在修改 `agent-editor.tsx` 时，优先保持现有的数据流：通过 Store + Hook 获取状态，而不是引入新的全局单例或直接访问 window 级变量。
- 新增 UI 功能时，优先考虑以「插槽组件」的方式扩展 `SingleMode` / `WorkflowMode`，而不是直接修改外部包源码：
  - 例如新增一个只在工作流模式下可见的工具按钮，可以在 `WorkflowModeToolPaneList` 中实现并通过现有 `renderChatTitleNode` 注入。
- 当需要集成新的服务调用或埋点：
  - 尽量复用 `@coze-arch/bot-api` / `@coze-arch/report-*` 提供的封装，而不是手写 `fetch` 或自定义上报格式，以保持与其它包一致。