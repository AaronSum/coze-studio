# @coze-agent-ide/workflow 开发说明（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/workflow）中安全、高效地协作开发。

## 1. 子包角色与全局架构

- 本包是 Agent IDE 中「Workflow 作为 Bot 能力」的 UI 适配层，入口为 `src/index.tsx`，对外主要导出 `WorkflowConfigArea`。
- 主要职责：在 Bot 详情页中承载「为单个 Bot 选择一个 Workflow/ChatFlow 能力」的配置区，与上游 store（bot-detail-store、space-bot）和下游 workflow 组件库进行编排。
- 数据与状态全部托管在上游 store 和后端接口中（`@coze-studio/bot-detail-store`、`@coze-agent-ide/space-bot`、`@coze-workflow/*`、`@coze-arch/bot-api` 等），本包自身只维护极少量 UI 局部 state（当前选中的 workflow、弹窗显隐等）。
- 结构概览：
  - `src/index.tsx`：仅 re-export `WorkflowConfigArea`。
  - `src/components/workflow-as-agent/workflow-config-area/index.tsx`：主配置组件，实现「选工作流 + 显示当前工作流卡片」。
  - `src/components/workflow-as-agent/workflow-config-area/use-agent-workflow-modal.tsx`：封装 `WorkflowModalBase` 的 hook，处理弹窗可见性、跨页面返回状态恢复、跳转逻辑等。
  - `src/components/index.module.less`：Workflow 能力默认说明区域、API 表格、图标按钮等的样式集合，供工作流相关内容复用。
  - `src/typings.d.ts`：引入全局 `@coze-arch/bot-typings`，避免在本包重复类型定义。
- 架构理念：将「工作流列表选择弹窗」「工作流发布模型联动」「Bot 能力布局信息更新」都通过独立模块/外部包处理，本包只负责 Glue Code 和 UI 编排，便于在其它模式（如 WorkflowMode）中重用相同能力。

## 2. 核心组件与数据流

### 2.1 WorkflowConfigArea（src/components/workflow-as-agent/workflow-config-area/index.tsx）

- 作用：在 Bot 配置页的某一块区域中，让用户为当前 Bot 选择一个 Workflow/ChatFlow 能力，并展示选中的 workflow 卡片。
- 关键依赖与数据来源：
  - `useBotDetailIsReadonly`：来自 `@coze-studio/bot-detail-store`，控制当前 Bot 是否可编辑，影响「添加/删除 workflow」的交互禁用态。
  - `useBotInfoStore`：取 `botId`、`space_id` 用于 WorkflowCard 渲染与后续接口参数。
  - `useBotSkillStore`：从 `layoutInfo` 中读取现有 `workflow_id` / `plugin_id`，并通过 `updateSkillLayoutInfo` 回写更新后的能力布局信息。
  - `useWorkflowPublishedModel`：来自 `@coze-agent-ide/space-bot/hook`，负责在 workflow 发布后回填选中项（`onOk` 回调中调用本地 `onChange`）。
  - `PluginDevelopApi.GetPlaygroundPluginList`：通过 plugin_id 拉取 workflow 的详细信息，用于初次挂载时根据 store 中的 `workflow_id/plugin_id` 恢复本地 `workflow` 对象。
  - `useReportTti`：打点当前模块 TTI，`mode` 固定为 `'single-agent-workflow'`。
- 本地 state 与派生逻辑：
  - `workflow`：`WorkFlowItemType | undefined`，通过 `useSafeState` 管理，既用于渲染，又作为传递给 `useBotWorkFlowListModal` 和 `useWorkflowPublishedModel` 的上下文。
  - `onChange`：统一更新本地 `workflow` 与 `botSkillStore.layoutInfo`，是所有来源（弹窗选择、发布回调、删除按钮）的单一写入口。
  - `flowMode`：当前固定为 `WorkflowMode.ChatFlow`，用于约束选择和发布流程的工作流模式；如需支持 ImageFlow 等模式，应从上游或 props 传入而不是在组件内硬编码。
- 初始化与同步流程：
  - `useEffect` 监听 `workflowId` / `pluginId` 与本地 `workflow` 对象的不一致；当 store 中已有 id 且本地无或不匹配时，通过 `PluginDevelopApi.GetPlaygroundPluginList` 查询并构造 `WorkFlowItemType`，写入本地 state；如果 store 中 id 被清空，则本地 `workflow` 重置为 `undefined`。
  - 如果后端查询不到 plugin，则抛出 `CustomError('normal_error', 'workflow_as_agent_workflow_not_found')`，上层错误边界应已负责展示通用异常。
- UI 行为：
  - 已选中 workflow 时：渲染 `WorkflowCard`，支持删除（调用 `onChange(undefined)`），并透传只读状态和 botId。
  - 未选中时：渲染一个「添加 Workflow」卡片，受只读控制；点击时调用 `open()` 打开 workflow 选择弹窗。
  - 底部说明文案 `I18n.t('wf_chatflow_132')` 提示 ChatFlow 能力用途。

### 2.2 useBotWorkFlowListModal（src/components/workflow-as-agent/workflow-config-area/use-agent-workflow-modal.tsx）

- 作用：包装 `@coze-workflow/components/workflow-modal`，为「Workflow 作为 Bot 能力」场景定制打开/关闭策略、跨页状态恢复、工作流选择后的行为。
- 关键参数与返回值：
  - 入参：`flowMode`（WorkflowMode）、`workflow`（当前选中项）、`setWorkflow`（更新选中项的回调）。
  - 返回：`{ node, open, close }`，其中 `node` 是要插入到 JSX 树中的 `WorkflowModalBase`，`open/close` 控制弹窗显隐。
- 可见性与跨页逻辑：
  - 使用 `useBotPageStore` 读取：
    - `tools.workflow.showModalDefault`：进入页面时是否默认展示 modal。
    - `bot.previousBotID`：用于判断当前是否为「同一 Bot 的返回」。
    - `setWorkflowState`：在 modal 打开后立即将 `showModalDefault` 置为 false，避免重复弹出。
  - 结合 `usePageJumpResponse(PageType.BOT)` 及 `SceneType` 判断：
    - `WORKFLOW_PUBLISHED__BACK__BOT`：从 workflow 发布页返回时不自动打开 modal。
    - `WORKFLOW__BACK__BOT`：校验返回时携带的 `flowMode` 与当前配置是否一致，不一致则不自动打开。
  - `getInitialVisible` 封装上述逻辑，只有在 botID 未变化、场景/模式匹配且 `showModalDefault` 为 true 时才默认打开。
- Modal 状态恢复：
  - 使用 `safeParse<WorkflowModalState>` 从 `jumpResponse.workflowModalState.statusStr` 读回上一次在 workflow 页面内保存的 modal 状态（如筛选、Tab 等）。
  - 通过 `initState={{ ...modalState, listFlowMode: flowMode }}` 传入 `WorkflowModalBase`，同时设置 `hiddenListFlowModeFilter` 确保列表模式与当前 flowMode 保持一致。
- 列表与交互：
  - `workflows`：将当前 `workflow` 包装为数组传入 `workFlowList`，`onWorkFlowListChange` 仅取首个元素并调用外部的 `setWorkflow`，意味着当前场景只支持单选。
  - `onItemClick`：
    - 如果为 `DataSourceType.Workflow`，使用 `useNavigateWorkflowEditPage` 跳转到 workflow 编辑页，并将当前 modal 状态序列化到 `statusStr`，供返回时恢复。 
    - 否则认为是 Store 中的 workflow，使用 `window.open('/store/workflow/...')` 在新标签页打开。
  - `onCreateSuccess`：新建 workflow 成功后直接跳转到编辑页。
  - `onAdd`：将 workflow 添加到列表成功后：
    - 关闭 modal。
    - 通过 `Toast.success` 提示，并在 isDup 场景下提供「继续编辑」按钮，打开 `/work_flow?space_id=...&workflow_id=...`。
  - `onRemove`：删除选中 workflow 后，仅展示成功 Toast，不直接改变 Bot 能力布局，真正的移除由上层通过 `onWorkFlowListChange` + `setWorkflow` 完成。

## 3. 构建、测试与开发流程

- 包管理与初始化：
  - 整体依赖由 Rush 管理，在仓库根目录执行 `rush update` 安装前端依赖。
- 本子包脚本（见 package.json）：
  - `build`: 当前实现为 `exit 0`，说明真实打包由上层应用/构建系统统一处理，本包只需保证 TS 类型与导出契约正确，不配置独立 bundler。
  - `lint`: `eslint ./ --cache`，配置来自本包的 `eslint.config.js`，基于 `@coze-arch/eslint-config` 的 web preset；修改代码后建议在包目录执行 `npm run lint`。
  - `test`: `vitest --run --passWithNoTests`，Vitest 配置见 `vitest.config.ts`，使用 `@coze-arch/vitest-config` 的 `web` 预设。
  - `test:cov`: `npm run test -- --coverage`，采集单测覆盖率。
- TypeScript 配置：
  - `tsconfig.build.json`：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，开启 `strictNullChecks`、`noImplicitAny`，`rootDir` 为 `src`，输出目录为 `dist`，启用增量构建信息 `dist/tsconfig.build.tsbuildinfo`。
    - `references` 列出大量内部包（bot-api、bot-env、bot-error、report-events、workflow/base、workflow/components 等）的 `tsconfig.build.json`，用于 TS project references 和增量编译；新增依赖包时，如果出现类型引用错误，需要同步在这里追加对应引用。
  - `tsconfig.json` / `tsconfig.misc.json`：分别覆盖 IDE 编辑体验与测试/配置文件的 TS 行为；测试类型包含 `vitest/globals`，无需在测试文件中手动引入。
- Storybook / 本地调试：
  - 项目包含 `.storybook/` 目录（模板保留），具体 Story 文件与命令请参考根仓或上层文档；本包主要通过集成到 Agent IDE 应用中调试，单独运行 Storybook 非必需。

## 4. 项目约定与代码风格

- 技术栈：
  - React 18 + TypeScript 函数组件，hooks 为主，不使用类组件。
  - 状态管理使用 `zustand`，在本包中只通过 selector 获取外部 store 状态，不在本地创建新的全局 store。
  - 辅助 hooks 与工具：`ahooks`（如 `useSafeState`）、`immer`（在其他包中广泛存在）、`lodash-es` 等。
- 样式：
  - 使用 Less + CSS Modules：组件样式集中在 `src/components/index.module.less` 中，局部类名（如 `.api-table`, `.tip-text`, `.icon-button-16` 等）通过 `classNames` 与 Tailwind 风格原子类组合使用。
  - 公共样式依赖 `@coze-common/assets/style/common.less` 和 `mixins.less`，部分全局类（如 `.semi-*`）通过 `:global` 做定制，修改这些样式需注意不会破坏其它包共享行为。
  - React 组件中常直接使用 Tailwind 风格的原子类（`coz-fg-plus`, `coz-mg-hglt`, `w-full h-[120px]` 等），保持与 Studio 全局视觉统一。
- 类型与错误处理：
  - 顶层通过 `src/typings.d.ts` 引入 `@coze-arch/bot-typings`，在使用相关类型时无需重复声明。
  - 对外接口调用错误使用 `CustomError` 包装成统一错误码（如 `workflow_as_agent_workflow_not_found`），交给上游通用错误处理逻辑展示。
  - 局部工具函数如 `safeParse<T>` 尽量保证失败时返回 `undefined` 而不是抛异常，以减少非关键路径的错误打断。
- 只读态与权限：
  - 场景中是否允许编辑全部由 `useBotDetailIsReadonly` 控制；组件内部只根据该值切换禁用样式与点击行为，不自行判断权限。

## 5. 与外部系统 / 包的集成要点

- `@coze-studio/bot-detail-store`：
  - `bot-info` store 提供当前 Bot 的基础信息（`botId`, `space_id` 等）。
  - `bot-skill` store 的 `layoutInfo` 保存当前 Bot 能力布局，其中 `workflow_id` / `plugin_id` 是本包读取和更新的核心字段，更新通过 `updateSkillLayoutInfo` 完成。
  - `useBotDetailIsReadonly` 提供页面只读态，用于防止在审核/查看模式下修改工作流。
- `@coze-agent-ide/space-bot`：
  - `useWorkflowPublishedModel` 在 workflow 发布后自动回填选择结果，`addedWorkflows` 入参需包含当前选中项列表；`onOk` 回调中建议统一调用 `onChange` 以保持状态来源一致。
  - `useBotPageStore` 管理页面级 UI 状态，如 `tools.workflow.showModalDefault`、`bot.previousBotID` 与 `setWorkflowState`，用于控制 modal 初始行为与跨页状态。
- `@coze-workflow/*`：
  - `@coze-workflow/components/workflow-modal` 暴露 `WorkflowModalBase`，本包将其固定在 `WorkflowModalFrom.WorkflowAgent` 场景下使用。
  - `WorkflowMode`（来自 `@coze-workflow/base/api` 或 `@coze-arch/idl/developer_api`）区分 Workflow、ChatFlow、ImageFlow 等模式；当前组件将 `flowMode` 固定为 ChatFlow，但 modal 的 `initState.listFlowMode` 等仍需保持一致。
- `@coze-arch/*`：
  - `bot-api` 的 `PluginDevelopApi` 用于根据 `plugin_id` 拉取 workflow 插件详情。
  - `bot-hooks` 的 `usePageJumpResponse`、`PageType`, `SceneType` 用来区分从哪些页面/场景跳转而来，确保只在合适场景下自动打开 modal 或恢复状态。
  - `coze-design` 提供 `Toast`、`Space`、`Typography.Text`、`Button` 等基础 UI 组件，用于弹窗反馈和文案展示。
  - `i18n` 的 `I18n.t(key)` 管理所有文案，新增文案时需在对应 i18n 包中补充词条，保持命名规范。
- `@coze-agent-ide/workflow-as-agent-adapter`：
  - 提供 `WorkflowCard` 组件，用于在配置区域中展示已选中的 workflow 信息和操作入口（删除/查看更多等）。本包只负责将 `botId`、`workflow`、`onRemove`、`isReadonly` 等信息透传，不关心卡片内部细节。

## 6. 项目流程与协作规范（AI 助手注意事项）

- 变更范围控制：
  - 优先在本包内做 UI 编排和 Glue Code 的扩展，不在此处修改 workflow 编辑器本身、Bot store 结构或导航逻辑的底层实现；如确需修改其它包，请遵循对应包的 copilot-instructions。
- 与入口包的关系：
  - 本包通常被 `@coze-agent-ide/entry` 的 `WorkflowMode` 或相关配置区域引用，作为「Workflow 能力配置块」存在。新增功能时应通过 props / hooks 与上游交互，而不是在此包中直接操作路由或全局布局。
- 测试约定：
  - 单测放在 `__tests__/` 目录，使用 Vitest + React Testing Library；如新增复杂逻辑（例如可见性策略、跨页状态恢复），建议补充针对 hooks 和组件的测试用例。

## 7. 本子包的特殊点与注意事项

- 构建无实际产物：`npm run build` 是 no-op，本包的 TS 编译与打包由上层应用统一处理，因此不要在这里增加额外的 bundler 或打包脚本，只需确保类型正确和导出稳定。
- 强依赖上游 store 状态：
  - `WorkflowConfigArea` 默认假设 bot-detail-store 和 space-bot 的上下文环境已经在页面上初始化，单独挂载本组件（在无 Provider 环境下）会导致运行时报错；AI 在创建 Story 或单独 demo 时，需要显式 mock 这些 store/hook。
- URL & 场景耦合：
  - `useBotWorkFlowListModal` 内部通过 `usePageJumpResponse` 和 `SceneType.WORKFLOW__BACK__BOT` / `SceneType.WORKFLOW_PUBLISHED__BACK__BOT` 等常量判断场景，这与后端/路由层约定紧密耦合。新增或变更 SceneType 枚举含义时，需要同步审查该 hook 的逻辑，否则可能在返回 Bot 页时错误地自动打开或不打开 modal。
- 单 workflow 模式：
  - 当前实现默认只支持「单个 Workflow 能力」绑定到 Bot（`workflows` 数组始终至多一个元素），如果未来要支持多选，应重点检查：
    - `onWorkFlowListChange` 如何回写多项；
    - `useBotSkillStore` 的 `layoutInfo` 数据结构是否支持多 workflow；
    - UI 是否需要展示列表而非单张卡片。
