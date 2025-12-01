# @coze-agent-ide/bot-creator 开发说明（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/entry）中安全、高效地协作开发。

## 1. 子包角色与全局架构

- 本包导出若干 React 组件 / hooks，供 Coze Agent IDE「Bot 创建与调试」界面作为入口使用，文件入口为 `src/index.tsx`。
- 对外主要导出：
  - `useInitToast(spaceId)`：根据 URL 查询参数，在进入页面时展示工作流拷贝成功等 Toast，并通过 `react-router-dom` 重写 URL 去除一次性参数。
  - `SingleMode` / `WorkflowMode`：两种 Bot 构建模式的页面容器组件，负责布局、工具区、调试区之间的协同。
  - `SkillsModal`：多 Tab 能力选择弹窗（工具 / Workflow / 数据集 / ImageFlow），聚合 workflow 能力、插件、数据集等模块。
- 数据与功能全部依赖上游 workspace 包（如 `@coze-agent-ide/tool`、`@coze-agent-ide/space-bot`、`@coze-studio/bot-detail-store` 等），本包自身不持久化数据，仅负责「编排 UI 与组合已有逻辑」。
- 样式集中在 `src/index.module.less`、`src/components/**/index.module.less`，大量复用全局样式工具（`@coze-common/assets/style/common.less`、tailwind 原子类和 CSS 变量）。

## 2. 关键组件与数据流

### 2.1 useInitToast（src/hooks/use-init-toast.tsx）

- 依赖：`query-string` 解析 `location.search`、`@coze-arch/i18n` 做多语言、`@coze-arch/coze-design` 的 `Toast` / `Space` / `Typography` / `Button`、`@coze-arch/bot-api` 中的 `ProductEntityType`，以及 `react-router-dom` 的 `useNavigate`。
- 行为：
  - 在 `spaceId` 有值时执行副作用，读取 `show_toast`, `entity_id`, `toast_entity_type` 等查询参数。
  - 当 `show_toast === 'workflow_copy_success'`：
    - 显示成功 Toast，内容包含：文案（区分 ImageFlow 与普通 Workflow）和「继续编辑」按钮。
    - 点击按钮时通过 `window.open` 打开 `/work_flow?space_id=...&workflow_id=...`。
    - 调用 `appendUrlParam` 将当前地址的 `show_toast` 参数清空，再用 `navigate(..., { replace: true })` 更新 URL，避免刷新重复弹 Toast。
- 使用约定：
  - 仅在顶层容器中调用一次，并从上层路由或 store 传入合法的 `spaceId`。
  - 不要在 Node 环境或 SSR 中直接调用该 hook（依赖 `window` / `location`），仅限浏览器端。

### 2.2 SingleMode（src/modes/single-mode/index.tsx）

- 作用：
  - 单模型 / 单 Bot 开发模式的主容器，左侧为配置、右侧为聊天调试区，底部挂载调试面板与可选右侧抽屉。
- 关键依赖：
  - `@coze-studio/bot-detail-store/page-runtime`：提供 `init`、`historyVisible`、`pageFrom` 以及 `botSkillBlockCollapsibleState`。
  - `@coze-arch/bot-api/developer_api` 的 `BotMode`, `TabStatus`。
  - `@coze-agent-ide/tool` 的 `AbilityAreaContainer` 和 `ContentView`：统一包裹「能力区域」，支持「隐藏工具区」模式，管理工具折叠状态等。
  - `@coze-agent-ide/space-bot/component` 的 `BotDebugPanel`、`ContentView` 等，负责统一的 IDE 外框与调试 bench。
  - `AgentConfigArea`、`AgentChatArea` 来自局部 `section-area`，是具体的配置与聊天模块实现；本包只在顶层组合它们。
- 数据流要点：
  - 通过 `usePageRuntimeStore` 读取 `botSkillBlockCollapsibleState`，计算 `defaultAllHidden`，并用 `useState` 管理本地 `isAllToolHidden`。
  - `AbilityAreaContainer` 通过 `eventCallbacks.onAllToolHiddenStatusChange` 回调通知容器当前「所有工具是否隐藏」，SingleMode 将其同步到本地状态并在 `ContentView` 上加上样式类（`wrapper-single-with-tool-area-hidden`）调整布局。
  - 只读状态由 `useBotDetailIsReadonly()` 提供，传入 `AbilityAreaContainer`，禁止在只读场景中编辑。
- 扩展时注意：
  - 优先在 `AgentConfigArea`/`AgentChatArea` 中加业务，不要直接在 SingleMode 中塞零散逻辑，保持其作为「布局和编排层」。
  - 避免在 SingleMode 直接访问深层 store 字段，新状态应由上游 store 提供 selector。

### 2.3 WorkflowMode（src/modes/workflow-mode/index.tsx）

- 作用：
  - 提供工作流模式的主工作台，左侧为配置 + 工具区，右侧为调试聊天区，可根据背景图与 store 状态动态调整样式。
- 关键依赖：
  - 与 SingleMode 类似，依赖 `usePageRuntimeStore`、`useBotDetailIsReadonly`、`BotMode`, `TabStatus` 等。
  - 工具与配置：`@coze-agent-ide/workflow` 的 `WorkflowConfigArea`，`@coze-agent-ide/tool-config` 的 `ToolGroupKey`，`@coze-agent-ide/tool` 的 `GroupingContainer` / `ToolView` / `ToolKey`。
  - 工具项：
    - `DataMemory`（变量与记忆）、`ChatBackground`、`OnboardingMessage` 等，均来自 space-bot 或 onboarding 相关包。
  - 布局：`@coze-studio/components` 的 `ResizableLayout`，左右区通过拖拽调整宽度；`SheetView` 负责左右侧抽屉样式（左：构建区；右：调试区）。
- 布局结构：
  - `ResizableLayout` 内部两个子 div：
    - 左：`SheetView` 包裹 `toolArea`（WorkflowConfigArea + GroupingContainer 等）。
    - 右：`SheetView` 作为调试聊天面板，内部通过 `renderContent` 渲染 `BotDebugChatArea` 与可选 `chatSlot`。
- 样式控制：
  - 根据 `historyVisible`、`pageFrom` 等状态在根节点叠加 `container`、`playground-neat`、`store` 等类名，细节见 `src/index.module.less`。
  - 背景图片状态由 `useBotSkillStore` 提供，用于在右侧 SheetView 上增加 `bj-img-cover` 等类，实现透明背景与前景文字样式切换。

### 2.4 SkillsModal（src/components/shortcut-skills-modal/index.tsx）

- 作用：
  - 聚合「插件 / 工作流 / 数据集 / ImageFlow」等可复用技能，按 Tab 展示与选择。
- Props 约定：
  - `tabs`: 数组，枚举 `'plugin' | 'workflow' | 'datasets' | 'imageFlow'`，控制可见的 Tab。
  - `tabsConfig`: 提供每个 Tab 的 `list` 和 `onChange` 回调：
    - `plugin`: `PluginApi[]` 列表。
    - `workflow`/`imageFlow`: `WorkFlowItemType[]` 列表，imageFlow 还需将 `flowMode` 指定为 `WorkflowMode.Imageflow`。
    - `datasets`: `Dataset[]` 列表。
  - 额外继承 `PluginModalModeProps` 与部分 `ModalProps`，用于控制打开模式和基础弹窗行为。
- 实现要点：
  - `usePluginModalParts` 与 `useWorkflowModalParts` 提供 `sider` / `filter` / `content` 三个区域的 UI 部件，本组件只做分类与布局。
  - 数据集 Tab 复用 `KnowledgeListModalContent`，直接传入 `datasetList` 和 `onDatasetListChange`。
  - 使用 `UITabsModal` 渲染标签页弹窗，`tabs.tabsProps.defaultActiveKey` 可根据 `usePageJumpResponse` 的 `scene` 进行智能选中（如从工作流返回时自动切到 workflow Tab）。
  - `SceneType.WORKFLOW__BACK__BOT` 映射到 `'workflow'`，其它 Scene 使用默认 `'tools'`。
- 扩展策略：
  - 新增 Tab 时：
    - 扩展 `SkillsModalProps['tabs']` 联合类型与 `tabsConfig` 定义。
    - 在组件内部新增对应的 `*TabPane`（含 `tabPaneProps` 与 `content`），并在 `tabs.map` 逻辑中处理新 key。
    - 样式可复用 `src/components/shortcut-skills-modal/index.module.less` 的结构（`main/sider/content`）。

### 2.5 ToolSheet（src/components/tool-sheet/index.tsx）

- 作用：
  - 包装 `SheetView` 的左侧工具栏版本，主要用于构建区统一样式与交互。
- Props：
  - `mode: BotMode`（Single / Workflow），会传到底层 `SheetView` 用于区分场景。
  - `titleNode`：左上角标题区域的自定义内容（通常为 Bot 配置块）。
  - `children`：主要内容区域，一般是工具或配置表单。
- 交互：
  - `slideProps` 固定了宽度（400）、位置（左侧）、开关按钮及文案。
  - 文案全部使用 `I18n`，在多语言环境下统一管理。

## 3. 构建、测试与开发流程

- 本包属于 Rush monorepo 中的一个 package，基础命令：
  - 安装依赖（整个前端）：在仓库根目录执行 `rush update`（或使用顶层脚本 `scripts/setup_fe.sh`）。
- 本子包 `package.json` 中的脚本：
  - `build`: 当前实现为 `exit 0`，表示实际打包由上层构建系统（如 rsbuild、统一应用打包配置）负责，本地无需单独执行。
  - `lint`: `eslint ./ --cache`，配置来自 `eslint.config.js`，通过 `@coze-arch/eslint-config` 的 `web` preset；AI 更新代码后可运行该命令检查风格与简单错误。
  - `test`: `vitest --run --passWithNoTests`，使用 `@coze-arch/vitest-config` 的 `web` 预设（见 `vitest.config.ts`）。如要新增测试，请放在 `__tests__` 目录，并确保 tsconfig.misc.json 已包含测试文件。
  - `test:cov`: 运行 `npm run test -- --coverage` 以收集覆盖率。
- TypeScript 配置：
  - `tsconfig.build.json`：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，启用 `strictNullChecks` 和 `noImplicitAny`，`rootDir` 为 `src`，输出到 `dist`。
    - `references` 指向大量 workspace 内共享包的 build tsconfig，以支持 TS project references 与增量构建；新增依赖包时，如出现类型引用问题，通常需要在此处追加对应引用路径。
  - `tsconfig.misc.json`：用于测试、配置文件等，`types` 包含 `vitest/globals`，避免在测试中重复引入。

## 4. 项目约定与代码风格

- 语言与类型：
  - 使用 React 18 + TypeScript，倾向使用函数组件与 hooks；严格启用 `strictNullChecks` / `noImplicitAny`，仅在个别地方使用 `any` 时会通过 ESLint 注释显式豁免。
  - 全局类型通过 `src/typings.d.ts` 引入 `@coze-arch/bot-typings`，AI 在使用这些类型时无需重复声明。
- 样式：
  - 组件级样式使用 CSS Modules（`*.module.less`），通过 `import s from './index.module.less';` 的方式引用，并使用 `classNames` 组合 class。
  - 公共布局类大量组合 tailwind 风格的原子类（如 `coz-bg-plus`, `coz-fg-secondary`, `overflow-hidden`, `h-full` 等），保持与整个 Studio 的统一视觉和主题变量。
  - 部分全局 class（如 `.semi-*`）通过 `:global` 选择器定制（见 `src/index.module.less` 的 `setting-area` 部分）。修改时注意不要破坏其它包共享的样式期望。
- 组件职责边界：
  - 本子包中的顶层组件（`SingleMode`, `WorkflowMode`, `SkillsModal`, `ToolSheet`）只负责布局和「组合」其它包的能力，不负责实现底层业务逻辑（如真正的 workflow 配置、工具存储、聊天数据流）。
  - 当需要扩展具体功能（例如新增一个工具分组项），优先在相应的 adapter 包或下游组件中实现，然后在这里以“插槽/组合”的形式挂载。
- 国际化：
  - 使用 `@coze-arch/i18n` 的 `I18n.t(key)` 获取文案，key 名通常复用 Studio 通用命名；新增文案时保持命名规范并在对应 i18n 包中补充词条。

## 5. 与外部系统 / 包的集成要点

- `@coze-agent-ide/*` 系列：
  - `tool`, `tool-config`, `workflow`, `chat-debug-area`, `space-bot`, `model-manager` 等提供了具体的 IDE 工具、工作流编辑区、调试面板和上下文 store，本包通过 props 与 context 与它们交互，不直接操作网络或后端。
- `@coze-studio/bot-detail-store`：
  - 提供 Bot 详情页的核心运行时状态（`page-runtime`、`bot-skill` 等），包括只读状态、历史记录是否显示、来源渠道（Store/Workspace）等，是布局行为和入口交互的关键依赖。
- `@coze-data/knowledge-*`：
  - `knowledge-modal-adapter` / `knowledge-modal-base` 提供知识库选择、展示的 UI 与数据结构，SkillsModal 只是容器与调度者。
- `@coze-arch/*`：
  - `bot-api` / `developer_api`：定义 Bot 与工具、workflow 的接口与枚举，是本包中多数 TS 类型来源。
  - `bot-hooks`：提供页面跳转场景（`PageType`, `SceneType`, `usePageJumpResponse` 等），用于在 modal/页面之间联动（如从 workflow 编辑页回到 bot 页面后自动打开某个 Tab）。
  - `bot-semi`, `bot-icons`, `coze-design`：统一 UI 组件与图标库。

## 6. 开发流程与协作规范（AI 助手注意事项）

- 变更范围控制：
  - 优先在本包内进行布局 / 组合层的增量修改，如需改动到其它包（例如新增一个 workflow 配置组件），请保持接口兼容，并遵循目标包的 copilot-instructions 约定。
- 类型与引用：
  - 当新增对 workspace 内其它包的类型或模块引用时：
    - 在 `package.json` 中将依赖声明为 `workspace:*`。
    - 若 TS 提示找不到 project reference，对应在 `tsconfig.build.json` 的 `references` 数组中追加该包的 `tsconfig.build.json` 路径。
- 测试与验证：
  - 为新增逻辑（尤其是 hooks 与独立组件）编写 Vitest + React Testing Library 用例，放入 `__tests__` 目录；复用现有 vitest 配置（`preset: 'web'`）。
  - 修改后建议至少运行 `npm run lint` 和 `npm run test` 以回归。

## 7. 本子包的特殊点与注意事项

- `build` 脚本是 no-op：实际产物打包由上层应用（如 `@coze-studio/app` 的 rsbuild 配置）统一处理，因此不要在此包内增加独立的 bundler 配置（如单独配置 vite/webpack），而是通过类型、入口与导出保持对外契约的稳定。
- URL 参数 side-effect：
  - `useInitToast` 同时读取并修改 `location.href`（通过 `appendUrlParam` + `navigate`），在引入新 URL 参数协同时要注意不会与其它模块的约定冲突（例如新增 `show_toast` 的其它取值时，要在本 hook 中显式分支处理）。
- 样式耦合：
  - `src/index.module.less` 中许多类名被多个模式复用（SingleMode / WorkflowMode / ToolSheet 等），改动这些类时要充分评估所有使用点，避免破坏非当前视图。
- 依赖广泛：
  - 本包在 TS `references` 中引用了大量前端子包，可视为整个 Agent IDE 的「集散地」。新增或删除引用时需谨慎，避免引起构建拓扑错误或不必要的循环依赖。
