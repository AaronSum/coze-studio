# @coze-agent-ide/workflow-card-adapter · Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/workflow-card-adapter）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包是「Agent IDE 机器人详情页」里的工作流卡片适配层，负责把工作流列表、创建/导入弹窗、发布后更新等行为封装成一个可复用的 `WorkflowCard` 组件。
- 对外入口为 [src/index.ts](frontend/packages/agent-ide/workflow-card-adapter/src/index.ts)：
  - 导出 `WorkflowCard` 组件和其 props 类型 `IWorkflowCardProps`；
  - 透出 `WorkflowModalFrom` 枚举（复用自 `@coze-workflow/components`）。
- 内部核心实现集中在 [src/components/workflow-card/index.tsx](frontend/packages/agent-ide/workflow-card-adapter/src/components/workflow-card/index.tsx)：
  - 组合多个上游包能力（空间 store、Bot 技能 store、工作流创建/导入弹窗、工作流卡片渲染、工具区域容器等）；
  - 提供单一 UI 区块：「工作流工具块」，负责展示当前 Bot 已关联的工作流列表，并支持新增/导入、复制名称、删除等基础操作。

## 关键数据流与组件协作
- `WorkflowCard` 的 props：
  - `flowMode: WorkflowMode`：工作流模式，已标记为 deprecated，只是往下传给 `useBotWorkFlowListModal`；产品上 Imageflow 已合并到 workflow，新增代码不应再依赖此字段进行模式判断。
  - `from: WorkflowModalFrom`：调用来源场景（如 Agent IDE、Bot 编辑页等），会影响工作流弹窗内的文案/行为，应从上游按既有枚举传入。
  - 另外继承自 `ToolEntryCommonProps`（如 `title` 等），用于工具区块通用头部展示。
- 主要使用的上游能力：
  - Store 与运行态：
    - `usePageRuntimeStore`（@coze-studio/bot-detail-store/page-runtime）：提供 `pageFrom`，用于 `WorkFlowItemCozeDesign` 区分来源场景（例如详情页/编辑页）。
    - `useBotSkillStore`（@coze-studio/bot-detail-store/bot-skill）：读写当前 Bot 的 `workflows` 列表，并通过定制 `updateSkillWorkflows` updater 以最新 store 状态为准更新（避免闭包拿到旧值）。
    - `useBotDetailIsReadonly`：判断当前 Bot 是否为只读态，控制是否展示操作按钮（新增/删除/复制）。
    - `useSpaceStore`（@coze-arch/bot-studio-store）：读取当前空间 `spaceID`，用于创建 workflow 后跳转编辑页时拼接参数。
  - 工作流创建与导入：
    - `useCreateWorkflowModal`（@coze-workflow/components）：返回 `createWorkflowModal` 组件和 `openCreateModal` 方法；在本包中配置：
      - `from`: 传入的 `WorkflowModalFrom`；
      - `spaceId`: 当前 `spaceID`；
      - `hiddenTemplateEntry: true`：隐藏模版入口，仅允许从空白开始创建；
      - `onCreateSuccess`: 创建成功后调用 `useNavigateWorkflowEditPage` 跳转工作流编辑页。
    - `useBotWorkFlowListModal`（@coze-agent-ide/workflow-modal）：提供 `node`（导入工作流列表弹窗 ReactNode）与 `open()` 方法；用于从现有工作流中选择并绑定到当前 Bot。
  - 导航与发布：
    - `useNavigateWorkflowEditPage`（@coze-agent-ide/navigate）：根据 `spaceID` 和 `SceneType.BOT__VIEW__WORKFLOW` 生成跳转编辑页面的函数；`onCreateSuccess` 会通过它直接打开新建 workflow 的编辑界面。
    - `useWorkflowPublishedModel`（@coze-agent-ide/space-bot/hook）：监听工作流发布完成逻辑，展示发布成功弹窗并在 `onOk` 时把新增 workflow 追加进当前 Bot 的 `workflows` 列表。
      - 这里 `addedWorkflows` 传入的是当前 `workflows`，`onOk` 内部通过 `updateSkillWorkflows(prev => [...prev, newWorkflow])` 追加。
  - 工具区容器与行为：
    - `ToolContentBlock`（@coze-agent-ide/tool）：统一包裹工具区域 UI，提供：
      - 标题（`header={title}`）；
      - 埋点事件名 `blockEventName=OpenBlockEvent.WORKFLOW_BLOCK_OPEN`；
      - 展开/收起状态（`defaultExpand`）；
      - 右上角 `actionButton`（AddButton）。
    - `useToolValidData`：用于告知上层「该工具是否已配置好数据」，本包在 `useEffect` 中根据 `workflows.length` 设置；
    - `useToolContentBlockDefaultExpand`：根据 `configured: workflows.length > 0` 计算默认是否展开工具区块。
  - 工作流列表展示：
    - `WorkFlowItemCozeDesign`（@coze-agent-ide/workflow-item）：负责渲染工作流卡片列表，并支持删除、复制等操作；
    - `ToolItemActionCopy`（@coze-agent-ide/tool）：卡片操作区内的复制按钮，在 `renderActionSlot` 中被用于复制 workflow 名称。
- 内部子组件：
  - `AddButton`（[src/components/workflow-card/add-button.tsx](frontend/packages/agent-ide/workflow-card-adapter/src/components/workflow-card/add-button.tsx)）：
    - 基于 `BaseAddButton`（@coze-agent-ide/tool）封装；
    - `tooltips` 使用 I18n key `bot_edit_workflow_add_tooltip`；
    - `onClick` 始终调用 `onImport()`，即只打开导入弹窗；虽然 props 同时存在 `onCreate` 与 `onImport`，但当前 UI 设计未直接提供「一键创建」入口。

## 样式与表现层
- 样式文件为 [src/components/workflow-card/index.module.less](frontend/packages/agent-ide/workflow-card-adapter/src/components/workflow-card/index.module.less)：
  - 通过 `@coze-common/assets/style/common.less` 与 `mixins.less` 继承全局样式工具。
  - `.card-content` 内部可扩展头部样式；`.default-text` 用于在无 workflows 时展示灰色说明文案（`bot_edit_workflow_explain`）。
- `WorkflowCard` 中通过 import `s from './index.module.less'` 使用 CSS Modules：
  - 列表容器使用 `s.cardContent`；
  - 说明文案使用 `s['default-text']`。
- 修改样式时：
  - 保持色值、字号与现有变量/样式一致，优先使用 CSS 变量（如 `var(--light-usage-text-color-text-2, rgb(28 29 35 / 60%))`）；
  - 避免引入全局类名，继续使用 CSS Modules 模式。

## 构建、测试与 Lint 工作流
- 包管理：
  - 使用 Rush + PNPM workspace 管理依赖；首次开发需在仓库根目录执行 `rush update`。
- 本包 npm scripts（见 [package.json](frontend/packages/agent-ide/workflow-card-adapter/package.json)）：
  - `build`: `exit 0`，不产生独立构建产物；真实打包由上层应用/构建系统统一处理（如 rsbuild、Vite、Rspack 等）。
  - `lint`: `eslint ./ --cache`，配置来自 [eslint.config.js](frontend/packages/agent-ide/workflow-card-adapter/eslint.config.js) 中的 `@coze-arch/eslint-config`（preset: `web`）。
  - `test`: `vitest --run --passWithNoTests`；
  - `test:cov`: 在 test 基础上添加 `--coverage`。
- Vitest 配置：
  - [vitest.config.ts](frontend/packages/agent-ide/workflow-card-adapter/vitest.config.ts) 通过 `@coze-arch/vitest-config.defineConfig` 统一配置，`preset: 'web'`，适配 React/DOM 环境；
  - 当前仓库中未见该子包的具体测试用例（`__tests__` 仅有 `.gitkeep`），如新增测试，建议使用 Testing Library（已经在 devDependencies 中声明）。
- TypeScript 配置：
  - [tsconfig.json](frontend/packages/agent-ide/workflow-card-adapter/tsconfig.json) 仅作 composite 入口并排除所有文件，真正编译配置在 [tsconfig.build.json](frontend/packages/agent-ide/workflow-card-adapter/tsconfig.build.json) 与 tsconfig.misc.json 中；
  - tsconfig.build.json：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`；
    - `rootDir: src`，`outDir: dist`；
    - 使用 `moduleResolution: bundler`，目标 `ES2020`，适配现代打包工具；
    - 通过 `references` 显式声明对 arch、common、workflow、agent-ide 相关子包的依赖，以支持 TS project references 与增量构建。

## 项目约定与模式
- 技术栈：
  - React 18 函数组件 + TypeScript；
  - 状态管理依赖上游 store（Zustand）和 hooks，本包自身不创建新的全局 store。
- 组件模式：
  - `WorkflowCard` 是**容器 + 适配组件**，其关注点：
    - 从各类 store/hooks 中收集数据和动作（workflows、空间、只读态、导航函数等）；
    - 把这些能力通过 `ToolContentBlock` 和 `WorkFlowItemCozeDesign` 组合成完整 UI；
    - 内部尽量保持无业务分支（除了少量 isReadonly、是否有 workflows 的 UI 分支）。
  - 因此：新增行为时，优先在上游 store/hooks 中扩展，再接入 `WorkflowCard`，避免在这里写一长串业务 if/else。
- 只读场景：
  - `isReadonly` 为 true 时：
    - 顶部 `AddButton` 不显示（赋值为 `null`）；
    - `WorkFlowItemCozeDesign` 也会接收 `isReadonly` props，内部控制编辑/删除行为。
  - 修改逻辑时须确保只读态不出现可变更入口。
- 工具区块与校验：
  - `useToolValidData(Boolean(workflows.length))` 用于告知上层「工作流工具是否已配置」：
    - workflows 为空 → 记为未配置，通常影响表单校验或引导提示；
    - 有 workflows → 记为已配置。
  - 修改 workflows 更新逻辑时，不要忘记这个校验依赖。

## 与其它子包的集成关系
- 上游/平级依赖（仅列关键，与本包逻辑直接相关）：
  - `@coze-workflow/base`：提供 WorkflowMode 类型等基础定义；
  - `@coze-workflow/components`：提供 `useCreateWorkflowModal`、`WorkflowModalFrom` 等工作流弹窗能力；
  - `@coze-studio/bot-detail-store`：提供 Bot 详情页运行时、技能、只读态等 store 与 hooks；
  - `@coze-arch/bot-studio-store`：空间 store（spaceId）；
  - `@coze-arch/bot-hooks`：PageType/SceneType 等枚举，用于导航和埋点；
  - `@coze-agent-ide/workflow-modal`、`@coze-agent-ide/workflow-item`、`@coze-agent-ide/tool`、`@coze-agent-ide/navigate`、`@coze-agent-ide/space-bot`：Agent IDE 相关工作流/工具区/导航封装；
  - `@coze-arch/i18n`、`@coze-arch/bot-utils`：国际化文本与埋点事件常量。
- 下游使用方：
  - 典型用法是在 Agent IDE / Bot 编辑页中，以工具区域子组件的形式引入 `WorkflowCard`，并传入 `title`、`flowMode`、`from`；
  - 调用方不需要关心内部如何管理 workflows 或弹窗，仅负责提供正确的上下文（空间、Bot、页面类型）与文案。

## 对 AI 助手的具体建议
- 如需修改 / 扩展对外 API：
  - 同时更新 [src/index.ts](frontend/packages/agent-ide/workflow-card-adapter/src/index.ts) 的导出；
  - 确认所有下游调用方是否依赖原有类型签名，尽量保持向后兼容（新增可选 props，而不是修改已有字段语义）。
- 如需扩展工作流卡片行为（例如新操作按钮、新状态展示）：
  - 优先考虑是否可通过 `WorkFlowItemCozeDesign` 的 `renderActionSlot` / 其它 props 实现；
  - 若需要在工具区块头部增加更多操作，考虑扩展 `ToolContentBlock` 的 `actionButton` 传入复合组件，而不是在 `WorkflowCard` 内部硬编码多个按钮。
- 如需调整创建/导入流程：
  - 与 `useCreateWorkflowModal` / `useBotWorkFlowListModal` 以及导航 hook 共同考虑；
  - 请不要在本包内直接发起新 HTTP 请求或绕过已有 hooks，保持「本包只做集成和 UI 适配」。
- 由于 `build` 是 no-op：
  - 不要指望在 CI 中直接依赖本包的 dist 输出；类型检查和打包都会通过上层 monorepo 构建链完成。
