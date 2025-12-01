# biz-workflow 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/biz-workflow）中安全、高效地协作开发。

## 1. 全局架构概览

- 子包定位：本包提供 Project IDE 中“自动化 Workflow”编辑与运行时能力，是对 @coze-workflow/
  系列（base/components/playground）的业务侧封装和 IDE 集成层。
- 对外导出：见 src/index.tsx，整体更像一个“Bridge/Adapter 包”，主要职责是：
  - 直接再导出 @coze-workflow/playground 中的通用能力（ResourceRefTooltip、usePluginDetail、LinkNode、navigateResource）。
  - 暴露 WorkflowWidgetRegistry、ConversationRegistry 作为 IDE 内部注册点。
  - 提供 useWorkflowResource、WorkflowTooltip、WorkflowWidgetIcon、WORKFLOW_SUB_TYPE_ICON_MAP 等 UI/资源层封装。
- 运行时入口：src/main.tsx 的默认导出组件 Main，是 IDE Widget 的实际渲染入口：
  - 内部渲染 <WorkflowPlayground />（来自 @coze-workflow/playground）。
  - 通过 @coze-project-ide/framework 提供的 hooks（useSpaceId/useProjectId/useCommitVersion/useCurrentWidgetContext/useCurrentWidget/useWsListener）
    将 WorkflowPlayground 嵌入到 Project IDE Widget 体系中。
  - 通过 @coze-project-ide/biz-components（usePrimarySidebarStore、CustomResourceFolderShortcutService）与左侧资源树联动。
  - 通过 @coze-arch/bot-flags 提供的特性开关控制 WebSocket 多 Tab 行为。
- 数据流与边界：
  - 上游：Project IDE（framework + biz-components + user-store + open-chat 等）提供空间/项目/Widget 上下文、消息事件和侧边栏资源能力。
  - 中间层：本包负责把这些上游信息组装成 WorkflowPlayground 所需的 props + 事件回调（spaceId、workflowId、projectCommitVersion、getProjectApi 等）。
  - 下游：WorkflowPlayground 负责绘图、节点编辑、执行等核心逻辑，并通过 ref（WorkflowPlaygroundRef）暴露行为（onResourceChange、triggerFitView、loadGlobalVariables 等）。
  - 会话扩展：src/conversation 模块用 ConversationRegistry 将 Workflow 会话纳入到统一聊天区域；与 @coze-workflow/components、@coze-studio/open-chat 形成联动。

## 2. 源码结构与职责划分

- src/index.tsx
  - 唯一导出点，负责编排外部暴露 API。
  - 修改导出时要考虑：是否属于 IDE 公共能力（优先挂在 @coze-workflow/* 下），还是只在 IDE 内部使用（放在本包并在此导出）。
- src/main.tsx
  - Main 组件是 IDE 中 Workflow Widget 的主视图：
    - 从 framework 获取 spaceId、projectId、commitVersion、当前 widget 上下文（uri、widget 实例）。
    - 通过 uri.displayName 解析 workflowId，注意：workflowId 为空时直接返回 null，不渲染任何内容。
    - 使用 useProjectApi 获取 workflow 相关服务调用方式，并传给 WorkflowPlayground。
    - 使用 usePrimarySidebarStore 拿到 refetchProjectResourceList，在 Workflow 资源变更后刷新左侧资源树。
    - 注册 uiWidget.onFocus 时的副作用：触发 triggerFitView 和 loadGlobalVariables，保证焦点恢复后视图与变量状态一致。
    - 通过 workflowRef（WorkflowPlaygroundRef）与 Playground 交互（onResourceChange、triggerFitView、loadGlobalVariables 等）。
  - 主扩展点：
    - 需要新增 WorkflowPlayground props / 行为时，优先在 @coze-workflow/playground 中扩展类型与能力，再在这里透传。
    - 需要和 IDE 其他面板联动时，通过 framework/biz-components 提供的 store 或 service 注入。
- src/components/
  - index.ts 聚合导出 WorkflowTooltip、WorkflowWidgetIcon 等 UI 组件。
  - workflow-tooltip.tsx / workflow-widget-icon.tsx + workflow-tooltip.module.less 定义视觉与交互样式。
  - 这些组件只关注“展示 & 交互”，不直接调用接口，数据由上层 props 传入。
- src/conversation/
  - registry.tsx：定义 ConversationRegistry，用于在统一聊天区域注册 Workflow 相关的会话视图或配置。
  - main.tsx：渲染 Workflow 与聊天面板结合的主视图，对话内容、历史记录等拆分在子目录：
    - chat-history/：历史列表与滚动逻辑。
    - conversation-content/：当前会话消息体展示。
    - dynamic-chat-list/、static-chat-list/：动态/静态列表渲染策略。
    - title-with-tooltip/：标题展示等细节组件。
  - conversation/hooks/：封装会话层逻辑，如消息订阅、视图滚动、选中态等（命名上通常体现 useXXX）。
- src/hooks/
  - index.ts：统一导出 hooks，供 main.tsx 或外部使用。
  - use-project-api.ts：将 workflow 相关的 REST/RPC 请求统一封装为 getProjectApi，传入 WorkflowPlayground，使后者与 IDE 通信解耦。
  - use-refresh.ts：
    - 监听来自 IDE 框架的刷新信号（例如 widget.refresh），通过 ref.current 触发 WorkflowPlayground 的重新拉取或视图更新。
  - use-listen-message-event.ts / use-change-flow-mode.ts / use-resource-operation.tsx / use-import-library-workflow.tsx 等：
    - 分别聚焦于事件监听、流程模式切换、资源操作（重命名、删除、复制）、导入库中 Workflow 等细节点。
  - debug.ts：开发环境下用于打印/调试 Workflow 状态，正式逻辑中谨慎依赖。
- src/constants.tsx
  - 暴露 WORKFLOW_SUB_TYPE_ICON_MAP 等常量，规范 Workflow 子类型 → 图标/样式 的映射。
  - 新增/修改子类型时，应在此维护映射，避免在组件中硬编码。
- type.ts / typings.d.ts
  - 在本包内定义的辅助类型、全局声明或第三方库类型补充。
  - 修改类型前关注对其他 workspace:* 包的影响，保持与 @coze-workflow/*、framework 类型的一致性。

## 3. 构建、调试与测试工作流

- 本包本地 scripts（package.json）
  - build: "exit 0"：本包自身不单独构建，实际构建由上层 Rush + rsbuild/webpack 在 app 层统一完成。
  - lint: "eslint ./ --cache --quiet"：本包主要校验方式是 Lint。
- 推荐的日常开发命令（在 monorepo 根目录）：
  - 安装依赖：rush update
  - 启动前端应用（示例，具体以 frontend/README.md 为准）：
    - scripts/start_fe.sh 或在 frontend 层执行 rushx <app-name>。
  - 仅对本包跑 Lint：
    - cd frontend/packages/project-ide/biz-workflow
    - rushx lint 或 pnpm lint（视 monorepo 脚本规范而定）。
- TypeScript 配置
  - tsconfig.json
    - 仅声明 references 到 tsconfig.build.json / tsconfig.misc.json，本身 exclude: ["**/*"]，避免被独立编译。
  - tsconfig.build.json
    - extends: @coze-arch/ts-config/tsconfig.web.json，统一了 React Web 环境配置。
    - compilerOptions：
      - baseUrl: ./，paths: { "@/*": ["./src/*"] }，可以使用 '@/xxx' 引用本包内部模块。
      - jsx: "react"，types: ["react", "react-dom"]。
      - strictNullChecks: true, strictPropertyInitialization: false，空值需显式处理，class 属性初始化可稍宽松。
      - rootDir: ./src, outDir: ./lib-ts, tsBuildInfoFile: ./lib-ts/tsconfig.build.tsbuildinfo。
    - references：指向大量上游包（bot-api/bot-error/bot-flags/bot-typings/i18n/report-events 等），保证 TS 增量编译顺序正确。
- 运行调试
  - Workflow 主视图实际由上层项目（如 @coze-studio/app）通过 framework 的 Widget 机制加载。
  - 若需要快速验证 UI/交互，建议：
    - 在 IDE 应用中创建/打开一个 Workflow 资源，使 Main 被加载。
    - 利用 debug.ts 或浏览器 devtools 观察 WorkflowPlaygroundRef 暴露的行为调用是否符合预期。

## 4. 项目特有约定与模式

- 统一通过 framework 获取上下文
  - 不直接从 URL 或全局变量解析 spaceId/projectId/workflowId，而是使用框架提供的 hooks：
    - useSpaceId、useProjectId、useCommitVersion、useCurrentWidgetContext、useCurrentWidget。
  - 这样可以保证嵌入式 IDE / 多 Tab / 嵌套容器下上下文一致性。
- Widget 生命周期与 UI 状态
  - UI 文案与状态（标题、图标、loading）一律通过 uiWidget / widget.context.widget 操作：
    - 在 handleInit 中根据 workflowState.info.name 设置标题，防止名称缺失时 UI 混乱。
    - 设置 uiWidget.setUIState('normal' | 'loading') 体现正在加载/正常状态。
    - setIconType(String(workflowState.flowMode)) 以 flowMode 为主键映射图标样式。
- WebSocket 与多 Tab 协调
  - 所有与 Workflow 资源变更相关的实时事件，均通过 useWsListener + WorkflowPlaygroundRef.onResourceChange 处理。
  - 必须在回调前检查特性开关 FLAGS['bot.automation.project_multi_tab']，以防在不支持多 Tab 的环境中误同步状态。
- 资源树交互
  - 对项目资源（Workflow 文件夹/节点）的重命名操作统一委托给 CustomResourceFolderShortcutService：
    - renameProjectResource={(resourceId) => widget.container.get(CustomResourceFolderShortcutService).renameResource(resourceId)}。
  - 不直接在本包内实现命名弹窗或接口调用，避免与其他资源类型处理逻辑不一致。
- 会话与 Workflow 联动
  - 会话列表/内容渲染抽象在 src/conversation/* 下，禁止在 Workflow 主视图里直接拼接聊天 UI；
  - 若要新增 Workflow 相关的会话类型或消息渲染方式，应：
    - 先在 @coze-workflow/components 或相关 data 包中定义数据与组件；
    - 再通过 ConversationRegistry 将其注册到 IDE 聊天区域。
- hooks 模式
  - 所有涉及副作用、事件订阅、与外部服务交互的逻辑优先写在 src/hooks 或 conversation/hooks 中：
    - 主组件只负责组合 hooks + 组装 props。
    - hooks 命名统一 useXXX，单一职责，便于拆分测试与复用。

## 5. 重要依赖与交互方式

- @coze-workflow/playground
  - 提供 WorkflowPlayground 组件、WorkflowGlobalStateEntity、WorkflowPlaygroundRef 以及若干工具函数（ResourceRefTooltip、usePluginDetail、LinkNode、navigateResource）。
  - 本包主要以“容器 + Adapter”的方式使用：
    - 容器负责给 Playground 喂 spaceId / projectId / workflowId / projectCommitVersion / getProjectApi / refetchProjectResourceList 等。
    - Adapter 负责从 IDE framework 派生这些参数，以及把 Playground 的回调挂回 IDE（onInit、onResourceChange 等）。
- @coze-project-ide/framework
  - 提供 IDE 通用上下文：
    - 类型：WsMessageProps、ProjectIDEWidget。
    - hooks：useSpaceId/useProjectId/useCommitVersion/useCurrentWidgetContext/useCurrentWidget/useWsListener。
  - 所有 IDE 层交互（WebSocket、Widget 生命周期）应优先从该包引入，而不是自行实现。
- @coze-project-ide/biz-components
  - usePrimarySidebarStore：用于刷新左侧资源树列表（refetch）。
  - CustomResourceFolderShortcutService：提供统一的资源重命名等快捷操作能力。
- @coze-arch/bot-flags
  - useFlags：
    - 返回 [FLAGS]，可通过字符串 key 访问特性开关，如 'bot.automation.project_multi_tab'。
    - AI 在新增行为时，如会引入“可能改变现有用户体验”的逻辑，需考虑是否新增/使用对应 flag。
- 其他典型依赖（简要）：
  - ahooks：辅助高级 React hooks，使用前优先检查 monorepo 中既有模式。
  - zustand：轻量状态管理。如需在本包新增全局状态 store，需对照其他包的创建方式（如 user-store 或 workflow 相关包）。

## 6. 代码规范与风格

- ESLint
  - 基于 @coze-arch/eslint-config，preset: 'web'。
  - 在本包内特别关闭/调整的规则：
    - 'no-restricted-syntax': 'off'：允许使用 for-of 等语法，但仍需注意性能。
    - '@typescript-eslint/naming-convention': 'off'：不强制命名风格，沿用现有命名即可。
    - '@typescript-eslint/no-magic-numbers': 'off'：允许少量 magic number，但建议集中定义常量。
    - '@coze-arch/no-batch-import-or-export': 'off'：允许批量导入导出，本包多用于 re-export。
    - '@typescript-eslint/no-explicit-any': 'warn'：允许使用 any，但建议在关键类型上给出明确定义。
    - '@typescript-eslint/no-non-null-assertion': 'off'：当前代码中存在 uri! 等用法，新增时要确保逻辑上确实不为空。
- 样式
  - 使用 .module.less + className（如 project-ide-workflow-playground），保持与其他子包命名一致。
  - 避免在组件中写内联 style 对布局影响较大的逻辑，优先修改对应 less 文件。

## 7. 协作与变更建议

- 新增功能前的依赖优先级
  - 若是通用 Workflow 功能（与 IDE 无关），优先考虑在 @coze-workflow/base 或 @coze-workflow/components 中实现，再通过本包接入。
  - 若是 Project IDE 专用功能（例如与资源树/用户身份/权限强相关），适合在本包或 framework/biz-components 中新增。
- 修改 Main 或入口导出时的注意点
  - 确保不破坏 index.tsx 的对外 API 形状，特别是被其他 workspace:* 包直接引用的导出。
  - 修改 Main 传给 WorkflowPlayground 的 props 时，对照 @coze-workflow/playground 中的类型定义，避免传递不兼容数据。
  - 调整 WebSocket 或 flags 行为时，需要考虑多 Tab / 多实例运行场景。
- 兼容性思路
  - 由于本包挂在 monorepo 中，AI 在重构/调整类型时，应优先向下兼容：
    - 使用可选字段而不是删除既有字段。
    - 为新行为增加 feature flag，并默认保持原有行为。
