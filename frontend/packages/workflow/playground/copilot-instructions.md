# @coze-workflow/playground Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/playground）中安全、高效地协作开发。

## 全局架构概览

- 本包提供「Workflow 画布 / Playground」页面，是 Coze Studio 中工作流编辑与调试的前端子系统。
- 入口导出位于 [src/index.tsx](src/index.tsx)，对外暴露 `WorkflowPlayground` 组件、全局状态实体 `WorkflowGlobalState`、若干 hooks（如 `useGlobalState`、`useAddNode`）、服务类（如 `WorkflowEditService`）、以及上下文 `WorkflowPlaygroundContext`。
- UI 入口组件为 [src/workflow-playground.tsx](src/workflow-playground.tsx) 中的 `WorkflowPlayground`：
  - 外层集成 `DndProvider`（react-dnd）、`QueryClientProvider`（@tanstack/react-query）、`WorkflowRenderProvider`（@coze-workflow/render）；
  - 通过 `containerModules` 注入工作流节点、页面容器、历史模块（`WorkflowNodesContainerModule`、`WorkflowPageContainerModule`、`WorkflowHistoryContainerModule`）；
  - 使用 `useSpaceStore`（@coze-arch/bot-studio-store）管理 spaceId、spaceList 等工作空间上下文；
  - 使用 `useWorkflowPreset` 根据 props 拼装画布 preset 传入 `WorkflowRenderProvider`；
  - 最终渲染 `WorkflowContainer`，该容器下挂载画布、侧边栏、Header、测试面板等。
- 画布逻辑依赖 `@coze-workflow/*` 系列包（base/render/nodes/history/test-run 等），本包主要负责集成与业务层 UI，而非底层图引擎实现。
- [src/nodes-v2](src/nodes-v2) 定义 V2 工作流节点的编排与贡献（如 `workflow-node-contribution.ts`、`workflow-nodes-v2-contribution.ts`），通过容器模块及 RenderProvider 注册到画布引擎。
- [src/container](src/container) 中的 `WorkflowPageContainerModule` / `workflow-page-contribution.ts` 等负责页面级容器模块注册（页面结构、路由/Tab、Header 等）。
- 其他关键目录：
  - [src/components](src/components)：工作流 Header、侧边栏、节点配置面板、测试面板等复合组件；
  - [src/services](src/services)：`WorkflowEditService`、`WorkflowCustomDragService` 等对外暴露的服务类，以及内部对 API / Render 层的封装；
  - [src/hooks](src/hooks)：围绕全局状态、Workflow JSON、节点操作等的 React hooks；
  - [src/entities](src/entities)：`WorkflowGlobalState` 等实体与全局状态建模；
  - [src/test-run-kit](src/test-run-kit)：工作流测试运行相关 UI 与逻辑；
  - [src/options](src/options)、[src/constants](src/constants)：常量、配置选项与枚举定义；
  - [src/ui-components](src/ui-components)：可复用的小型 UI 组件，如 `AddOperation`；
  - [src/node-registries](src/node-registries)：与节点仓库 / 插件详情相关的注册逻辑（如 `usePluginDetail`）。

## 关键数据流与服务边界

- 工作流画布核心数据（Workflow JSON、节点配置、连线关系）主要通过 `@coze-workflow/base`、`@coze-workflow/render`、`@coze-workflow/nodes` 提供的 API / hooks / store 进行读写，本包通过 hooks 与服务类进行编排。
- 全局状态：
  - `WorkflowGlobalState` 与 `WorkflowGlobalStateEntity` 定义在 [src/entities](src/entities) 与 [src/typing](src/typing) 下，对外通过 [src/index.tsx](src/index.tsx) 导出；
  - 使用 `zustand` 及其 `useShallow` 选择器精简订阅，避免不必要的重渲染。
- 空间（space）管理：
  - 由 `useSpaceStore`（@coze-arch/bot-studio-store）维护 `spaceList`、`setSpace`、`fetchSpaces`、`checkSpaceID` 等；
  - `WorkflowPlayground` 中通过 `useEffect` 在初始化时拉取并校验空间，再根据 `spaceId` 进行切换；
  - 若 `inited` 未完成则不渲染画布，防止空白或异常状态。
- DnD 与节点交互：
  - 使用 `react-dnd`，通过 `DndProvider` 提供 HTML5Backend；
  - 拖拽相关常量如 `DND_ACCEPT_KEY` 在 [src/constants](src/constants) 中定义并导出；
  - `WorkflowCustomDragService` 封装特定拖拽行为；
  - 节点新增操作通过 `useAddNode` hook 与 `useAddNodeVisibleStore` 协同。
- 渲染容器与模块：
  - `WorkflowRenderProvider` 负责承载 containerModules 与 preset，统一 orchestrate 各种模块（节点、页面、历史、测试等）；
  - `WorkflowPageContainerModule` 则为工作流页面注入特定 UI 与行为；
  - `nodes-v2` 中的 contributions 文件通过 container module 注册节点类型及其编辑/展示组件。
- 错误边界与可观测性：
  - `PlayGroundErrorBoundary` 使用 `@coze-arch/logger` 的 `ErrorBoundary`；
  - `IS_BOT_OP` 场景下为了运维平台避免白屏，直接返回 children，不包裹 ErrorBoundary；
  - logger 使用 `logger.createLoggerWith({ ctx: { namespace: 'workflow-error' } })` 统一打点命名空间。

## 开发工作流（构建 / 测试 / 调试）

- 本包依赖上层 monorepo 的 Rush / Rspack / Vite 等配置，常见操作：
  - 安装依赖：在 monorepo 根目录执行 `rush update`；
  - 构建：本包 `package.json` 中的 `build` 脚本当前为 `exit 0`，真正的构建通常由上层应用或打包配置驱动（例如 Rspack/Vite 的 app 级入口）；
  - 单元测试：
    - 在本包目录下运行 `npm test` 或 `pnpm test`（实际由 Rush 代理，命令为 `vitest --run --passWithNoTests`）；
    - 覆盖率：`npm run test:cov`（传递 `--coverage`）；
    - Vitest 配置见 [vitest.config.ts](vitest.config.ts)，使用 `@coze-arch/vitest-config` 预设，`preset: 'web'`。
- Lint：
  - 本包提供 `lint` 脚本：`eslint ./ --cache`，规则继承自 `@coze-arch/eslint-config`，配置入口在 [eslint.config.js](eslint.config.js)。
- Storybook / UI 调试：
  - 存在 [.storybook](.storybook) 目录，说明支持本地 Storybook 调试；具体启动命令可能在 monorepo 顶层或本包 scripts 中定义（请从 [scripts](scripts) 或 root `rushx` 配置查找）。
- 运行环境假设：
  - React 18 + ReactDOM 18；
  - 浏览器端运行（`DndProvider` 使用 `context={window}`，以及 `WorkflowRenderProvider` 依赖 DOM）。

## 项目约定与编码规范

- 语言与框架：
  - TypeScript + React 18 函数组件，广泛使用 hooks；
  - 使用 `forwardRef` 为外部暴露组件实例能力，例如 `WorkflowPlaygroundRef`。
- 状态管理：
  - 统一使用 `zustand`（通过 `useShallow` 优化 selector）；
  - 复杂全局状态抽象为实体（`WorkflowGlobalState` 等），与 typing 中的实体类型保持一致；
  - 若需新增全局状态，优先在 [src/entities](src/entities) / [src/hooks](src/hooks) 下跟随现有模式实现。
- 依赖管理与跨包交互：
  - 大量依赖为 `workspace:*` 内部包（`@coze-workflow/*`、`@coze-arch/*`、`@coze-common/*` 等），新增/修改功能时优先复用这些包而非引入重复实现；
  - 与后端/服务的 HTTP 通信一般通过 `@coze-arch/bot-http`、`@coze-arch/bot-api` 等间接完成，本包内部 service 主要负责拼装参数与结果对齐前端状态；
  - `reflect-metadata` 和 `inversify` 表明部分模块可能采用依赖注入模式（由底层 workflow / framework 包控制），新增模块时需遵循既有 containerModule/DI 方式。
- UI 组件风格：
  - 以 `@douyinfe/semi-ui`、`@coze-arch/coze-design`、`@coze-studio/components` 为主；
  - 新增 UI 元素时优先复用上述组件库，使用统一的布局与主题；
  - 复杂交互通常封装在 [src/ui-components](src/ui-components) 或 [src/components](src/components) 中的组合组件内。
- 文件与目录命名：
  - 功能分域清晰：`nodes-v2` / `services` / `hooks` / `entities` / `test-run-kit` 等；
  - 组件文件使用小驼峰或中横线命名，目录名多为中横线（例如 `workflow-playground-context.ts`、`use-workflow-playground.tsx`）。

## 重要模块与集成细节

- WorkflowPlayground 组件（[src/workflow-playground.tsx](src/workflow-playground.tsx)）
  - 负责空间初始化、容器模块注册、错误边界与 Provider 组合，是嵌入上层应用的主要入口；
  - 接收 `WorkflowPlaygroundProps`（[src/typing](src/typing)）与可选 `parentContainer`，并通过 ref 暴露 `WorkflowPlaygroundRef` 能力给上层（如触发刷新、导出 JSON 等）。
- WorkflowGlobalState / Hooks（[src/entities](src/entities)、[src/hooks](src/hooks)、[src/index.tsx](src/index.tsx)）
  - 对外开放 `useGlobalState`、`useSpaceId`、`useLatestWorkflowJson`、`useGetWorkflowMode`、`useAddNode` 等；
  - 外部调用时请使用公开 hooks，而非直接修改 zustand store 或内部实体，以保持行为一致性和副作用统一管理。
- Services（[src/services](src/services)）
  - `WorkflowEditService`：封装画布编辑相关操作，如新增/删除节点、修改边、更新 workflow 元数据等；
  - `WorkflowCustomDragService`：自定义节点/组件拖拽逻辑，与 `DND_ACCEPT_KEY` 配合；
  - 这些服务被视为对外 API，可以由其他包注入或调用，修改时需保持向后兼容，避免破坏已有消费方。
- Nodes V2（[src/nodes-v2](src/nodes-v2)）
  - `workflow-node-contribution.ts` / `workflow-nodes-v2-contribution.ts` 是否包含节点注册、元信息定义、编辑器配置；
  - 通常与 `@coze-workflow/nodes` 配合，通过 container module 与 render provider 完成节点渲染和交互；
  - 新增节点时建议遵循既有 contribution 模式：定义节点 schema、UI、执行配置，并在相应 container module 中注册。
- Header / 资源导航（[src/components/workflow-header](src/components/workflow-header)）
  - 对外从 [src/index.tsx](src/index.tsx) 导出 `navigateResource`、`LinkNode`、`TooltipContent as ResourceRefTooltip`，用于从工作流跳转到资源详情（如 Prompt、Knowledge、Plugin 等）；
  - 若扩展资源类型或跳转模式，需保证这些导出 API 的签名稳定。
- Test Run / Playground 测试能力（[src/components/test-run](src/components/test-run)、[src/test-run-kit](src/test-run-kit)）
  - `TestFormDefaultValue` 从 [src/components/test-run/types](src/components/test-run/types) 导出，为测试面板提供默认参数结构；
  - 测试运行可能依赖 `@coze-workflow/test-run` / `@coze-workflow/test-run-next` 等包，注意与后端执行引擎 / mock 能力的一致性。

## 项目流程与协作规范

- 分支与提交：
  - 具体规则参考 monorepo 根目录的贡献文档（[CONTRIBUTING.md](../../../../CONTRIBUTING.md)）及团队内部约定；
  - 一般遵循 feature/bugfix 分支开发，通过 PR 合入主干；
  - 修改导出 API（特别是 [src/index.tsx](src/index.tsx) 中的导出）时，应检查下游依赖包（通过 Rush / TypeScript references）以避免破坏接口。
- 发布与集成：
  - 本包版本号遵循 monorepo 统一发布策略，`package.json` 中的 `version` 通常由自动化工具管理；
  - 与上层应用（如 Studio 主应用）通过 `@coze-workflow/playground` 作为依赖集成，实际路由 / 页面注册一般在 apps 级包中完成。

## 非常规 / 需要特别注意的点

- `build` 脚本当前是 no-op（`exit 0`），构建完全依赖 monorepo 顶层配置；AI 助手在修改 webpack/vite/rspack 配置时应从 apps 或根配置入手，而不是在本包新增独立构建逻辑。
- 错误处理在运维平台（`IS_BOT_OP` 场景）与普通场景有不同策略：前者避免 ErrorBoundary 導致的额外包装，修改 `PlayGroundErrorBoundary` 逻辑时需兼顾两种环境。
- 大部分核心业务逻辑存在于其他 workspace 包（`@coze-workflow/*`, `@coze-arch/*` 等），本包只做集成与 UI 编排；在实现新能力时，优先考虑：
  - 是否已有对应 lower-level 能力可复用；
  - 如果需要新增底层能力，应在对应子包中实现，再在本包接入，而非直接在本包实现「一段到底」的业务逻辑。
- 本包导出多个可供外部消费的 hooks / services / 组件，修改其行为或签名可能影响整个 Studio；对公共导出进行非兼容修改前需审查所有引用点。
