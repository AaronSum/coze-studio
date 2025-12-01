# @coze-agent-ide/layout 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/layout）中安全、高效地协作开发。

## 1. 子包定位与全局架构角色

- 本包是 Agent IDE 机器人编辑页的布局与顶层框架，实现“Bot 详情 + 调试区 + 设置区”的整体编排。
- 入口文件为 src/index.tsx，对外默认导出 BotEditorInitLayout，并透出头部相关组件与类型：
  - 默认导出：BotEditorInitLayout / BotEditorInitLayoutProps / BotEditorLayoutSlot / CustomProviderProps
  - 头部组件：BotHeader、MoreMenuButton、DeployButton / DeployButtonUI 及相关 props
  - 状态展示：OriginStatus、renderWarningContent
- 主要数据流：
  - 通过 react-router-dom 的 useParams 读取路由上的 bot_id，并作为当前 Bot 的上下文主键。
  - 依赖 @coze-studio/bot-detail-store、@coze-studio/user-store、@coze-agent-ide/space-bot 等多个 store 包，使用 Zustand hooks 读取/更新运行时状态（bot 信息、运行模式、是否有未发布变更等）。
  - 调试对话相关能力通过 @coze-agent-ide/chat-area-provider-adapter 封装注入，布局只负责在合适的层级包裹 Provider 和渲染区域。
  - UI 基础组件与主题来自 @coze-arch/bot-semi、@coze-arch/coze-design、@coze-common/assets/style/common.less 等，样式集中在 src/index.module.less 和 src/components/header 下。
- 结构设计要点：
  - Layout 本身尽量保持“无业务逻辑 / 轻逻辑”，业务行为（发布、Bot 信息编辑、模式切换）通过外部 hooks、store 或服务注入（如 useDeployService、useUpdateAgent、BotDebugButton）。
  - 通过 Slot（BotEditorLayoutSlot）与可选 CustomProvider，使上层应用可以在不修改内部实现的前提下插入自定义头部、Provider 或包裹逻辑。

## 2. 目录结构与关键模块

根目录（frontend/packages/agent-ide/layout）：

- package.json：定义为 React 组件库子包，main 指向 src/index.tsx，build 脚本目前为占位（exit 0），测试使用 vitest。
- tsconfig.json / tsconfig.build.json / tsconfig.misc.json：统一使用 @coze-arch/ts-config 预设，preset=web，保证与其他前端子包一致的编译配置。
- eslint.config.js：使用 @coze-arch/eslint-config，preset=web；新增规则一般统一在根 preset，而不是本包单独扩展。
- vitest.config.ts：通过 @coze-arch/vitest-config.defineConfig({ dirname, preset: 'web' })，继承统一测试预设（包含 JSDOM 环境、别名等）。
- __tests__/：放置本包单元测试（结构沿用 vitest，测试文件通常以 *.test.tsx/ts 命名）。

src 目录：

- src/index.tsx
  - 聚合导出：从 ./layout 导出布局组件与类型，从 components/header 导出头部与按钮组件，同时 re-export BotEditorLayoutSlot / BotEditorLayoutProps / CustomProviderProps，供上层直接引入。
  - 默认导出：BotEditorInitLayout。
- src/layout.tsx
  - BotEditorInitLayout：面向上层页面的布局入口，负责：
    - 从路由参数中读取 bot_id（DynamicParams），校验存在性；不存在时抛出 CustomError('normal_error', 'failed to get bot_id')，由上层错误边界统一处理。
    - 包裹 BotEditorInitLayoutImpl，并透传 props。
  - BotEditorInitLayoutImpl：实际布局实现，职责包括：
    - 初始化逻辑：
      - 使用 usePageRuntimeStore(state => state.init) 读取页面运行态是否初始化完成。
      - 使用 useUpdateEffect 监控 init 变化，仅在首次加载完成时将 isFirstLoad 置为 false，避免切换 Bot 过程中反复认为是“初始加载”。
    - 权限与用户信息：通过 userStoreService.useUserInfo() 读取当前用户，用于调试区域 Provider。
    - 调试区域 Provider：使用 BotDebugChatAreaProviderAdapter 以 botId 和 userId 为 key 包裹内部内容，承载聊天 / 调试 UI。
    - 模式切换 Loading：使用 useBotPageStore(state => state.bot.modeSwitching) 控制最外层 Spin 的 loading 状态，配合样式类 spin-wrapper top-level 实现整页遮罩。
    - Layout Slot：根据 props 渲染 headerTop、header、headerBottom 以及 children，header 是否展示由 hasHeader 控制。
    - 样式：使用 s.wrapper 包裹整个区域，其余布局细节主要在 index.module.less 中实现。
- src/index.module.less
  - 负责整页布局结构，包括：外层 wrapper、左右区域（message-area / develop-area / setting-area）、Spin 效果、各种 header 高度与阴影、Playground 模式的 message-area 宽度调整等。
  - 使用 Tailwind 风格的 @apply 与全局 less 变量（来自 @coze-common/assets/style/common.less），注意不要随意修改公共样式名，避免影响其他包。
- src/typings.d.ts
  - 仅包含三方类型引用：/// <reference types='@coze-arch/bot-typings' />，为编译器提供全局 bot-typings 声明。

src/components/header：

- src/components/header/index.tsx（BotHeader）
  - 左侧：
    - BackButton：来自 @coze-foundation/layout，通过 useNavigate + useSpaceStore 组合，在 goBackToBotList 时导航到 `/space/${spaceID}/develop`。
    - BotInfoCard：展示 Bot 名称、头像等，同时支持点击进入编辑；可通过 isReadonly 控制是否允许编辑。
  - 中间：
    - 当前保留为“Bot 菜单区域”占位，后续如有需求通过 addonAfter 或专用 slot 扩展。
  - 右侧：
    - addonAfter：由上层决定渲染的额外内容（如状态标签、入口菜单等）。
    - updateBotModal：useUpdateAgent 返回的编辑弹窗组件，始终挂在 Header 内部根节点下。
  - 标题与页面状态：
    - 使用 Helmet + renderHtmlTitle 动态设置浏览器标签页标题，根据 pageFrom（BotPageFromEnum）区分“我的 Bot”与“探索 Bot”场景。
    - 使用 useBotDetailIsReadonly / usePageRuntimeStore / useDiffTaskStore 等多个 store 来控制 UI 状态与是否展示 ModeSelect。
- src/components/header/deploy-button/index.tsx
  - DeployButton：带业务逻辑的“发布/部署”按钮封装：
    - 使用 useDeployService() 注入发布逻辑（真正的网络请求与错误提示在 hooks/service 中实现）。
    - 使用 usePageRuntimeStore(s => s.hasUnpublishChange) 控制是否展示“有未发布变更”的提示点 showChangeTip。
  - DeployButtonUI：纯 UI 组件，接收按钮外观/文案/状态/tooltip 等参数，内部通过：
    - BotDebugButton（来自 @coze-agent-ide/space-bot/component）渲染实际按钮。
    - Tooltip / IconCozCheckMarkCircleFillPalette 等组成“有变更时小圆点 + Tooltip 提示”。
    - 若 disabled 为 true，再包裹一层 Tooltip 提示发布被禁用的原因。
  - useDeployService：从 hooks/service 导出，供其他场景复用统一发布逻辑。
- src/components/header/bot-status
  - index.ts：只导出 OriginStatus 与 renderWarningContent，内部实现位于 origin-status.tsx。
  - 用于展示 Bot 的“原始状态”和各种警告文案，通常以标签形式放在 Header 右侧。

## 3. 开发与运行流程

### 3.1 包内常用命令

- 安装依赖（在整个前端 monorepo 顶层执行）：
  - rush update
- 在本包目录下开发/调试（具体 dev 命令依赖上层应用，一般不在子包单独跑）：
  - layout 本身没有专门 dev 脚本，通常由上层 app（例如 frontend/apps/coze-studio）通过 rsbuild/vite 启动整体应用，再在该页面中联调布局组件。
- 构建：
  - 当前 package.json 中的 build 为占位：npm run build => exit 0
  - 真正的打包配置通常在公共 rsbuild/webpack 配置中由上层管控，子包只需保持 ts/样式/依赖正确。
- Lint：
  - npm run lint：使用 eslint.config.js 中的 @coze-arch/eslint-config preset=web。
- 单元测试：
  - npm test 或 npm run test：使用 vitest，配置见 vitest.config.ts。
  - npm run test:cov：在 test 基础上增加覆盖率统计。

### 3.2 与整体应用的集成

- Layout 组件不会独立跑“页面级 dev 服务器”，而是由上层应用（如 @coze-studio/app）在路由中渲染：
  - 典型用法：在某个 /space/:space_id/develop/:bot_id 路由下使用 BotEditorInitLayout 包裹 Bot 详情、配置区、调试区子组件。
  - 上层通过 header / headerTop / headerBottom slot 注入自定义头部与工具条，同时在 children 中渲染主工作区。
- 本包高度依赖上层提供的 store 包（user-store、bot-detail-store、space-store 等），因此在脱离整体应用单独渲染组件时，需要显式 mock 这些 Provider / hooks，否则会在运行期抛错或取到 undefined。

## 4. 项目特有约定与模式

### 4.1 状态管理与 Store 约定

- 统一使用 Zustand 及其派生 hooks（useSpaceStore、usePageRuntimeStore、useDiffTaskStore 等），配合 useShallow 控制订阅范围。
- 任何影响全局页面运行态或跨区域共享的数据，优先通过已有 store 读写，避免在布局组件内部新增本地状态副本。
- 对于异步操作（如发布、编辑 Bot 信息），统一抽象为 hooks（useDeployService、useUpdateAgent 等），由其他包集中实现业务逻辑，layout 只调用这些 hooks 暴露出来的接口。

### 4.2 路由与参数约定

- 必须从 useParams<DynamicParams>() 中取得 bot_id，缺失时直接抛 CustomError('normal_error', 'failed to get bot_id')。
- 任何新增依赖路由参数的逻辑，应沿用 DynamicParams 类型，而不是在 layout 内部自行解析 location.pathname。
- 导航回列表统一走 goBackToBotList => `/space/${spaceID}/develop`，避免在多个地方硬编码路径。

### 4.3 UI 与样式规范

- 基础视觉与交互组件：
  - 优先使用 @coze-arch/bot-semi / @coze-arch/coze-design / @coze-studio/components 中的现有组件，而不是在本包重复封装相同按钮/Tooltip/图标。
- 样式：
  - 使用 less + CSS Modules（*.module.less），类名在 TSX 中通过 import s from './xxx.module.less' 使用。
  - 可以使用 @apply 复用全局 tailwind-like 工具类（如 bg-background-1、coz-bg-primary 等），这些均由 @coze-common/assets/style/common.less 提供。
  - 禁止随意修改 .wrapper / .container / .message-area 等基础布局类的尺寸与层级（z-index），因为它们会影响其他调试/配置子模块的布局稳定性。

### 4.4 国际化与文案

- 所有展示给用户的文案需通过 I18n.t(key, params?) 获取（例如 I18n.t('bot_publish_button')、I18n.t('bot_has_changes_tip')）。
- 新增文案时，应在对应 i18n 包中维护 key，而不是在 layout 中写死字符串。

### 4.5 错误处理

- Layout 层只负责抛出结构性错误（例如缺少必需路由参数），具体提示和兜底 UI 由上层 ErrorBoundary 或全局错误处理负责。
- 业务错误（发布失败、权限不足等）由 useDeployService、useUpdateAgent 等 hook 内部处理，布局只根据其输出的 loading/disabled 信息调整 UI。

## 5. 关键依赖与集成说明

以下是对于 AI 助手理解与使用本包时特别重要的依赖与交互点：

- @coze-agent-ide/space-bot
  - 提供 BotDebugButton 与 ModeSelect 等组件，用于在 header 中切换 Bot 调试模式、触发调试相关动作。
  - 同时通过 useBotPageStore 暴露 botPage 的运行态（包括 modeSwitching 等）。
- @coze-agent-ide/chat-area-provider-adapter
  - BotDebugChatAreaProviderAdapter 将 BotId + UserId 绑定到调试聊天上下文，内部集成 chat-core、websocket 等复杂逻辑。
  - Layout 只负责在合适层级包裹 Provider，保证 children 内的聊天组件能够正常工作。
- @coze-studio/bot-detail-store
  - 提供 page-runtime、diff-task、bot-info 等多个 store：
    - page-runtime.init：初始数据加载状态。
    - page-runtime.hasUnpublishChange：是否有未发布变更，用于 DeployButton 显示小红点。
    - diff-task.diffTask：决定是否展示 ModeSelect 等控件。
  - 修改 store 逻辑时要注意：layout 对这些字段有依赖，变更字段名或语义需要同步调整。
- @coze-studio/user-store
  - userStoreService.useUserInfo() 提供当前用户 ID 等信息，作为聊天 Provider 的 userId。
- @coze-arch/bot-error
  - CustomError 用于在缺少必需参数（如 bot_id）时抛出标准化错误，被全局错误处理捕获。

## 6. 测试与调试建议（针对 AI 助手）

- 单元测试：
  - 新增/修改组件时，优先为核心交互（布局渲染、header 行为、按钮禁用/Loading 状态）编写 vitest + @testing-library/react 测试。
  - 测试文件建议放在 __tests__ 或与组件同级（如 src/components/header/__tests__），统一使用 describe/it + data-testid（例如 agent-ide.goto.publish-button）断言。
- 集成调试：
  - 若需要在运行中检查布局行为，建议在顶层 app（如 frontend/apps/coze-studio）中启动 dev（rushx 相关命令见 app 内 copilot-instructions），然后通过浏览器访问对应 Bot 编辑页进行联调。
  - 调试路由参数相关问题时，可以在测试中 mock useParams 或用 MemoryRouter 包裹组件。

## 7. 团队流程与注意事项

- 代码风格：
  - 遵循 @coze-arch/eslint-config 与 @coze-arch/stylelint-config 约定；新增规则应优先改动公共配置，而非在本包内写大量 override。
- 提交与分支：
  - 整个仓库的分支策略、Release 流程参考仓库根目录的 README / 贡献文档；本包不单独维护发布脚本。
- 变更边界：
  - 在本包内进行修改时，优先保持 API 稳定：
    - 不随意更改 BotEditorInitLayout、BotHeader、DeployButton 等对外导出的组件与 props；如确需调整，请先在调用侧搜索并同步更新。
  - 跨包联动修改（例如更换 store 字段、发布逻辑）时，务必在相关子包也更新测试与文档，避免出现运行时不兼容。

---

如果你是 AI 编程助手，在修改本包代码前，请优先：
- 确认是否需要调整其他依赖本包的子包（可通过全局搜索 BotEditorInitLayout / BotHeader / DeployButton 等符号）；
- 保持路由参数、store 字段与现有约定一致，避免破坏 Bot 编辑页整体体验。
