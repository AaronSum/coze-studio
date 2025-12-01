# layout-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/layout-adapter）中安全、高效地协作开发。

## 总体架构与职责
- 本包是 Agent IDE 里“Bot 编辑器页面布局”的适配层，封装了路由、上下文 Provider、头部区域等通用结构，对上游应用暴露单一入口组件：BotEditorLayout（默认导出自 src/index.ts）。
- 上游（应用侧）只需在 React Router 中将某一路由 element 设置为 <BotEditorLayout />，即可获得标准的 Bot 编辑器外壳，内部主内容通过 <Outlet /> 渲染。
- 下游依赖：
  - @coze-agent-ide/layout：提供通用 Bot 编辑器布局容器、BotHeader、DeployButton、MoreMenuButton、OriginStatus 等 UI 组件。
  - @coze-agent-ide/space-bot：提供 useBotRouteConfig、BotEditorLoggerContextProvider 等空间/路由相关能力。
  - @coze-agent-ide/bot-creator-context：提供 BotCreatorProvider、BotCreatorScene 上下文，用于标识当前为“Bot 场景”。
  - @coze-studio/bot-detail-store：提供 bot 详情、运行态 store（usePageRuntimeStore、useBotInfoStore、useBotDetailIsReadonly）。
  - @coze-arch/i18n：统一国际化文案能力。
- 本包核心功能：
  - 统一在 Bot 页面注入上下文 Provider（BotCreatorProvider、BotEditorLoggerContextProvider 等）。
  - 根据路由配置（useBotRouteConfig）决定是否需要初始化 Bot，并在需要时包裹一层初始化布局 BotEditorInitLayoutAdapter。
  - 将 @coze-agent-ide/layout 中的通用布局与当前业务需求（头部按钮、模式切换、发布按钮等）进行适配，加强 Header 的业务逻辑。

## 源码结构与关键模块
- src/index.ts
  - 简单导出：从 ./layout 引入 BotEditorLayout 并作为默认导出，供外部直接使用。
- src/layout/index.tsx
  - 定义导出的 BotEditorLayout 组件，是路由挂载的顶层容器。
  - 核心逻辑：
    - 使用 useBotRouteConfig() 获取 requireBotEditorInit、pageName、hasHeader 等路由级配置。
    - 始终包裹：
      - <BotCreatorProvider value={{ scene: BotCreatorScene.Bot }}>：标识当前编辑场景为 Bot。
      - <BotEditorLoggerContextProvider>：统一日志/埋点上下文。
    - 当 requireBotEditorInit 为 true 时：
      - 通过 React.lazy 加载 ./base 中的 BotEditorInitLayoutAdapter，并传入 pageName、hasHeader；内部使用 <Outlet /> 渲染子路由。
    - 当 requireBotEditorInit 为 false 时：
      - 不加载额外布局，直接 Suspense + <Outlet />。
- src/layout/base.tsx
  - 定义 BotEditorInitLayoutAdapter 组件，是“需要初始化 Bot 编辑器”的布局适配器。
  - 关键行为：
    - 首先调用 useInitAgent()，在布局渲染前完成 Bot 初始化（如拉取配置、设置 store 等，具体逻辑在 hooks/use-init-agent.tsx）。
    - 从 usePageRuntimeStore 读取 isPreview，推导 isEditLocked 状态（预览模式下禁止编辑）。
    - 渲染 @coze-agent-ide/layout 中的 BotEditorLayout，并透传大部分 layoutProps。
    - 自定义 header：
      - 使用 BotHeader 组件，传入：
        - pageName：当前页面名（来自路由配置）。
        - isEditLocked：使用 isPreview 控制编辑锁定。
        - addonAfter：使用 HeaderAddonAfter 组件扩展右侧按钮区。
        - modeOptionList：来自 ../header/mode-list，控制模式切换选项。
        - deployButton：使用 DeployButton，文案由 I18n.t("bot_publish_ republish_btn") 提供，按钮样式高度固定为 38px。
    - children 作为布局主体内容传入 BotEditorLayout。
- src/header/index.tsx
  - 定义 HeaderAddonAfter 组件，用于填充 BotHeader 的 addonAfter 区域。
  - 逻辑结构：
    - 通过 useBotDetailIsReadonly()、usePageRuntimeStore、useBotInfoStore 计算：是否只读、当前是否可编辑、botId/botInfo 等。
    - 左侧状态区：在非只读时展示 OriginStatus（草稿/协作等状态）。
    - 当 editable 为 true 时，在状态区与按钮区之间插入纵向 Divider。
    - 右侧按钮区：
      - 若未 editLocked：
        - 功能按钮 MoreMenuButton。
        - 发布相关按钮区域：
          - editable 时展示 DeployButton；
          - 非 editable 且存在 botInfo、botId 时展示 DuplicateBot（可一键复制 Bot）。
          - 预留 <div id="diff-task-button-container" /> 作为差异任务按钮挂载点。
- src/header/mode-list.tsx
  - 定义 modeOptionList（模式切换选项），作为 BotHeader 的 modeOptionList 输入，用于控制编辑/预览/其他模式标签；具体选项取决于当前 IDE 的交互设计。
- src/hooks/use-init-agent.tsx
  - 封装 Bot 初始化逻辑（例如：拉取 Bot 基础信息、鉴权、埋点初始化等）；BotEditorInitLayoutAdapter 只负责调用，不关心具体实现。
- src/typings.d.ts
  - 放置全局类型声明或模块补充声明（如非 TS 包类型定义补充），使本包 TS 编译通过。

## 开发与运行工作流
- 依赖安装（在仓库根目录）：
  - 使用 Rush 管理：rush install 或 rush update。
- 本子包常用脚本（在 frontend/packages/agent-ide/layout-adapter 下）：
  - lint：npm run lint
    - 使用 eslint.config.js 和 monorepo 通用规则（@coze-arch/eslint-config）；对 TS/React 进行检查，建议在提交前运行。
  - 单测：npm test
    - 实际执行 vitest --run --passWithNoTests，使用 @coze-arch/vitest-config 的 node/react 预设（见 vitest.config.ts）。
  - 覆盖率：npm run test:cov
    - 在 vitest 基础上增加 --coverage；rushx-config 中该包为 level-3，对覆盖率无强制要求，但推荐为关键逻辑补齐测试。
  - 构建：npm run build
    - 目前实现为 exit 0，仅占位；真实产物由上层 Rsbuild/应用构建流程生成，不依赖本地 build 输出。
  - Storybook：README 中声明支持 storybook，相关配置在 .storybook/main.js、.storybook/preview.js；如需本地调试组件，可参考其他包的 storybook 命令（通常为 npm run storybook 或 rushx storybook），本包脚本可按需补充。

## 项目约定与模式
- 布局适配分层：
  - @coze-agent-ide/layout 提供通用 UI 和基础布局；本包只做“适配”，包括：
    - 组装 Provider 与业务 store。
    - 根据业务路由配置（requireBotEditorInit、pageName、hasHeader）控制是否启用初始化布局。
    - 将 Header 的按钮、状态区与具体业务逻辑（只读/可编辑、复制、发布等）绑定。
- 路由与懒加载：
  - 通过 React.lazy + Suspense 延迟加载 base 布局组件，以减小首次加载体积；
  - 约定：被懒加载的组件要作为 default 导出或在动态 import 中做 default: res.BotEditorInitLayoutAdapter 映射。
- Zustand store 使用：
  - 一般使用 usePageRuntimeStore、useBotInfoStore 等 hook，并辅以 useShallow 优化选择器，减少重渲染。
  - 状态字段命名尽量与数据语义一致（如 isPreview、editable、botId）。
- Header 右侧区域扩展：
  - 通过 addonAfter 插槽接入更多功能按钮（MoreMenuButton、DeployButton、DuplicateBot、自定义 diff 按钮挂载点），保持 Header 组件本身的通用性。
- 国际化：
  - 文案统一使用 I18n.t(key)；
  - 在本包中，尽量避免硬编码文案，业务文案 key 由上游 i18n 仓库维护。

## 外部依赖与集成细节
- @coze-agent-ide/layout
  - 提供 BotEditorLayout、BotHeader、DeployButton、MoreMenuButton、OriginStatus 等组件及 BotHeaderProps 类型。
  - 本包需要遵守其 props 约定：
    - BotHeader 必须传入 modeOptionList、deployButton 或 addonAfter 等关键属性，否则 UI 行为可能不完整。
  - 若在本包新增 Header 相关功能，优先通过 addonAfter 或现有 props 扩展，不应随意突破其公共 API 约束。
- @coze-agent-ide/space-bot
  - useBotRouteConfig: 返回 requireBotEditorInit、pageName、hasHeader 等信息，是本包判断是否启用初始化布局的唯一来源。
  - BotEditorLoggerContextProvider: 统一日志/调试上下文，不应在内部随意移除。
- @coze-agent-ide/bot-creator-context
  - BotCreatorProvider + BotCreatorScene：定义当前“Bot 创建/编辑场景”；其他依赖该上下文的组件会以此为前置条件。
- @coze-studio/bot-detail-store
  - page-runtime：提供 isPreview、editable 等运行态字段，用于控制 Header 行为（例如：预览模式禁编辑、非可编辑状态不显示 DeployButton 等）。
  - bot-info：提供 botId、botInfo，供 DuplicateBot 使用。
  - 顶层 store：提供 useBotDetailIsReadonly() 判断整体是否只读。
- @coze-studio/components/DuplicateBot
  - 复制 Bot 功能按钮；要求传入 botID（注意大小写为 botID）。
- @coze-arch/i18n
  - 用于翻译按钮文案等；需要确保 key 已在上游资源中配置，否则可能显示占位字符串。
- 第三方库
  - react-router-dom: 使用 Outlet、Suspense 等组合路由与懒加载。
  - zustand/react/shallow: useShallow 用于组合 selector 结果，提升性能。
  - @coze-arch/bot-semi/Divider: 用于 Header 分隔线，遵循内部组件库样式规范。

## 团队流程与协作规范
- 代码风格：
  - 统一使用 eslint.config.js 中配置的规则，包含 React/TS/导入顺序等约束；AI 助手在生成代码时应尽量遵守已有 import 风格和命名习惯。
  - 样式相关规范通过 .stylelintrc.js 与全局 stylelint 配置控制，即便本包目前样式较少，也要为未来扩展预留空间。
- 测试约定：
  - 测试框架为 Vitest + React Testing Library，配置在 vitest.config.ts 与 monorepo 统一 vitest-config 中。
  - 如为布局或 Header 新增复杂交互，推荐添加组件级单测（例如：根据 isPreview/isReadonly 切换按钮可见性）。
- Storybook 使用：
  - .storybook/main.js、preview.js 已准备好基础配置；若增加可视化组件（新 Header 区块、布局变种等），可以为其补充 Story 便于设计/产品联调。
- 分支与提交：
  - 遵循仓库根目录 CONTRIBUTING.md 中的通用要求；本包没有独立的分支策略。

## 开发注意事项与常见坑
- Bot 初始化：
  - 所有依赖 Bot 上下文或 store 的组件，都应确保挂在 requireBotEditorInit 逻辑之后；如果在非初始化路径使用这些组件，可能会因缺失数据导致异常。
- 编辑锁定逻辑：
  - isEditLocked 当前直接等于 isPreview；若未来编辑锁定条件发生变化，请集中修改 base.tsx 中的逻辑，保持行为一致。
- Header 扩展：
  - 请优先通过 HeaderAddonAfter 组件扩展功能，而不是直接修改 @coze-agent-ide/layout 的 BotHeader 组件，实现解耦。
- 懒加载错误处理：
  - 目前 Suspense 未自定义 fallback，默认无 loading UI；如需要增强体验，请在外层（应用级）加上 ErrorBoundary 和更丰富的 fallback，而不是在本包里硬编码。
