# @coze-common/chat-area 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/chat-area）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是 Coze Studio 前端 monorepo 中的聊天区域「容器层」与「编排层」，负责把底层 chat-core、UI Kit、插件系统、上传/滚动/偏好等子系统组合为可复用的 ChatArea 组件与 Hook/上下文导出。
- 对外导出集中在 [src/index.tsx](src/index.tsx)：
  - 主组件：`ChatArea`（在 [src/chat-area-main/index.tsx](src/chat-area-main/index.tsx) 实现），负责布局和集成滚动区、消息列表、输入区、预览、拖拽上传等。
  - 各类 Context / Hook：`ChatAreaProvider`、`useChatArea`、`useWaiting`、`useMessagesOverview` 等，用于上层业务以「逻辑 + store + 事件」方式集成聊天能力。
  - Store 类型与状态：从 `store` 导出的 `MessageGroup`, `Message`, `Waiting`, `FileStatus` 等类型与工具函数。
  - 插件系统导出：可读/可写生命周期服务、插件注册类型、插件上下文、渲染/消息/指令生命周期钩子等，详见 `src/plugin/*`。
- 职责边界：
  - 本包不直接实现 LLM 调用、网络请求等「业务逻辑」，而是通过 `@coze-common/chat-core`、`@coze-arch/bot-api` 等进行抽象集成。
  - 本包定义 ChatArea 的「状态机 + 布局 + 插件扩展点」，并使用 `zustand` 等管理状态，通过 Context/Hook 暴露能力。
- 主要数据流（简化）：
  - 外部 App 通过 `ChatArea` 组件、Provider 和导出的 Hook，初始化聊天上下文（会话 ID、用户/机器人信息、偏好等）。
  - `store` 层维护消息组、等待状态、选择状态、文件状态等；Hooks（`hooks/messages`, `hooks/public`, `hooks/context` 等）读写 store 并驱动 UI。
  - `components`（消息列表、预览、输入区等）通过 context/store 与 hooks 联动，响应用户输入与消息流。
  - `plugin` 层在多种生命周期节点（发送前后、接收前后、渲染前后、指令交互等）插入扩展逻辑。

## 关键模块与结构概览

- ChatArea 主视图：
  - [src/chat-area-main/index.tsx](src/chat-area-main/index.tsx)
    - `ChatAreaMain`：内部组件，负责：
      - 组合 `MessageGroupList`、`ChatInputIntegration`、`Preview`、`DragUploadArea` 等核心子组件；
      - 挂载 `UIKitEventProvider`、`UIKitCustomComponentsProvider`，与 `@coze-common/chat-uikit(-shared)` 配合；
      - 构造并提供 `ScrollViewProvider`，封装滚动控制器 `ScrollViewController`；
      - 通过 `usePluginCustomComponents` 注入插件自定义浮动组件（`MessageListFloatSlot`、`ShareMessage` 等）。
    - `ChatArea`（对外导出）：
      - 接受 UI/行为偏好（`PreferenceContextInterface`）、文案（`CopywritingContextInterface`）、UIKit 自定义组件（`UIKitCustomComponents`）以及 ChatArea 自定义组件（`ChatAreaCustomComponents`）。
      - 通过 `PreferenceProvider` 整理并注入上述配置，同时合并 `useProviderPassThoughContext` 的全局偏好。
      - 暴露 `ChatAreaRef`，允许外部通过 `useImperativeHandle` 获取滚动视图和输入框 Ref 控制权。
- Context 子系统：[src/context](src/context)
  - `chat-area-context`：定义 ChatArea 的核心上下文（生命周期事件、回调、初始化配置等）。
  - `preference`：封装 ChatArea 的展示与交互偏好（是否可选择、是否展示 Onboarding、布局 PC/Mobile、按钮状态等）。
  - `copywriting`：管理聊天区域内的文案（占位、提示、清空上下文提示等），支持上层自定义。
  - `drag-upload`, `upload-controller-context`：管理拖拽上传、文件上传行为与状态。
  - `scroll-view-context.tsx`、`scroll-view-size`：聚合消息列表滚动区域的能力。
- Store 子系统：[src/store](src/store)
  - `messages.ts`, `message-meta.ts`, `message-index.ts`：消息、消息组、索引和元信息的存储与操作工具。
  - `waiting.ts`：等待状态（机器人回复、处理中等）的状态机及订阅接口（导出 `Waiting`, `WaitingPhase` 等）。
  - `sender-info.ts`, `plugins.ts`, `onboarding.ts`, `suggestions.ts` 等：管理机器人与用户信息、插件数据、Onboarding 建议等。
  - `types.ts`：集中定义 store 层公共类型（如 `MessageGroup`, `Message`, `UserInfoMap`, `FileStatus` 等），多数已从 [src/index.tsx](src/index.tsx) 直接导出。
- Hooks 子系统：[src/hooks](src/hooks)
  - `context/`：如 `use-chat-area`, `use-init-status`, `use-conversation-id`, `use-chat-area-waiting-state`，封装对 context 与 store 的访问入口。
  - `messages/`：如 `use-send-message`, `use-stop-responding`, `use-clear-context`, `use-clear-history`, `use-latest-section-message`，是上层触发消息行为的主要手段。
  - `public/`：为业务侧公开的通用 Hook，如 `useWaiting`, `useMessagesOverview`, `useGetMessages`, `useHasMessageList`, `useIsOnboardingEmpty` 等。
  - `controller/`：如 `use-chat-area-controller`，封装 ChatArea 控制器，便于外部以更「命令式」方式驱动 ChatArea。
  - `file/`、`uikit/`、`plugins/`：分别与文件上传、UIKit 功能以及插件集成相关。
- 插件系统：[src/plugin](src/plugin)
  - `plugin-class/service/*`：四大生命周期服务：
    - `AppLifeCycleService`、`MessageLifeCycleService`、`CommandLifeCycleService`, `RenderLifeCycleService`，每个都提供 Readonly/Writeable 版本。
  - `types/plugin-class/*`：定义各生命周期回调上下文，如：
    - 消息生命周期：`OnBeforeSendMessageContext`, `OnAfterSendMessageContext`, `OnBeforeReceiveMessageContext`, `OnAfterProcessReceiveMessageContext` 等；
    - 命令生命周期：图片点击、清空上下文、选择 Onboarding 建议、停止回复、元素点击等；
    - 渲染生命周期：文本内容渲染、MessageBox 渲染等。
  - `types/plugin-component/*`：MessageBox、ContentBox、插槽组件类型定义（如 `CustomMessageInnerBottomSlot`, `CustomTextMessageInnerTopSlot`, `CustomShareMessage` 等）。
  - `hooks/use-plugin`, `hooks/use-plugin-public-methods`, `hooks/use-plugin-custom-components`, `hooks/use-limit-selector`：提供插件消费与注册、访问上下文、筛选可见范围等能力。
  - `utils/create-life-cycle-service`, `create-custom-component`：封装创建生命周期服务与自定义组件映射的工具；对应类型在 `types/utils/create-life-cycle-service` 中导出。
  - `constants/plugin.ts`：定义插件模式、名称等枚举（`PluginMode`, `PluginName`）。
- 其他重要模块：
  - `report-events/`：对接埋点事件（如 `getReportError`），统一错误/行为上报。
  - `components/`：ChatArea 内部 UI 模块（`message-group-list`, `chat-input`, `plugin-async-quote`, `drag-upload-area`, `preview` 等），与 chat-uikit 和插件系统密切协作。
  - `styles/`：Less 样式及 UIKit 样式覆盖（如 `styles/uikit.less`）。

## 构建、测试与调试流程

- 包管理 & 初始化：
  - 根目录统一使用 Rush：在 monorepo 根执行 `rush update` 安装/更新依赖（见 [README.md](README.md) 中的 init 说明）。
- 开发与 Storybook：
  - README 中声明 `dev: npm run dev`，具体 dev 脚本定义通常位于上层配置或 .storybook 目录配合（此包自身 package.json 未定义 dev，说明本包 dev 依赖 monorepo 级别命令或 Storybook 工程）。
  - Storybook 配置位于 [.storybook](.storybook) 目录，配合 `@storybook/react(-vite)` 用于本地调试 UI 组件与插件系统；业务开发时优先通过 Storybook 验证 UI 行为与交互。
- 构建：
  - package.json 中 `"build": "exit 0"`，表示**当前包自身不承担独立打包逻辑**，通常由上层 BFF/应用或统一打包配置（如 Rsbuild/Vite）消费源码进行打包。
  - README 中提到 `esm bundle` 与 `umd bundle`，但实现来自上游配置；在本包内无需维护构建脚本。
- Lint & 类型检查：
  - ESLint：`npm run lint` → `eslint ./ --cache`，配置在 [eslint.config.js](eslint.config.js)，使用 `@coze-arch/eslint-config` 的 `preset: 'web'`。
  - TS 类型检查：`npm run lint:type` → `tsc -p tsconfig.json --noEmit`，确保公共导出 API 类型安全。
  - TS 配置采用工程引用：
    - [tsconfig.json](tsconfig.json) 引用 `tsconfig.build.json` 与 `tsconfig.misc.json`，具体编译选项遵循 monorepo 统一 TS 配置。
- 测试：
  - `npm test` → `vitest --run --passWithNoTests`。
  - 覆盖率：`npm run test:cov` → `npm run test -- --coverage`。
  - Vitest 配置在 [vitest.config.ts](vitest.config.ts)：
    - 使用 `@coze-arch/vitest-config`，`preset: 'web'`；
    - `coverage.all = true`，`include = ['src']`，`exclude = ['src/index.ts', 'src/typings.d.ts']`，说明测试重点在内部实现而非纯导出聚合文件。

## 项目特有约定与模式

- 导出策略：
  - 默认入口 [src/index.tsx](src/index.tsx) 负责「聚合导出」，对外暴露：
    - 组件（`ChatArea`, `ChatInput`, `ChatInputArea` 等）、
    - Hook（`useChatArea`, `useWaiting`, `useGetMessages`, `useInitStatus` 等）、
    - Store 类型与工具（`MessageGroup`, `Waiting`, `proxyFreeze` 等）、
    - 插件系统类型与服务（`ReadonlyMessageLifeCycleService`, `WriteableChatAreaPlugin`, `RegisterPlugin` 等）。
  - package.json `exports` 将 hooks/context/service/store/types 子路径透出，方便上游按需引用内部模块。
- 状态管理与不可变约定：
  - 使用 `zustand`、`immer` 等实现 store（细节在 `store` 内），对外暴露的状态经常通过 Hook 封装，而非直接暴露 store 实例。
  - 提供 `proxyFreeze` 工具（在 `utils/proxy-freeze` 并从 index 导出），用于冻结对象以避免非预期的可变写入（尤其在插件系统和渲染生命周期中）。
- 插件系统设计模式：
  - Readonly/Writeable 双接口：对于生命周期服务与生成器，基本都提供只读与可写两个版本，约束插件对内部状态的修改能力。
  - LifeCycle Service + Generator：
    - Service 类持有生命周期回调方法；
    - Generator 工具（如 `WriteableMessageLifeCycleServiceGenerator`）用于创建具备标准签名的服务实例；
    - 插件通过注册接口将这些服务注入 ChatArea 的处理流程中。
  - 插槽组件：
    - 某些 UI 区域（如 MessageBox 内部、消息列表浮动区域）通过插件组件类型（`CustomMessageInnerBottomSlot`, `MessageListFloatSlot`, `CustomContentBox` 等）实现高度可插拔。
- UI 与样式约定：
  - 使用 `@coze-common/chat-uikit` 和 `@coze-common/chat-uikit-shared` 作为基础 UI 库，ChatArea 只关注「如何组合与扩展」而非单个控件实现。
  - 样式采用 Less 模块（如 [src/chat-area-main/index.modules.less](src/chat-area-main/index.modules.less)），配合 Tailwind、UIKit 样式覆盖实现。
- 兼容与废弃：
  - 某些 Hook 已标记为 `@Deprecated`（如 `useChatAreaContext`, `useChatAreaStoreSet`），仍在 [src/index.tsx](src/index.tsx) 中导出以兼容旧代码，新增逻辑时尽量使用新的公开 API。

## 外部依赖与集成细节

- Chat 基础能力：
  - `@coze-common/chat-core`：
    - 定义基础消息类型（`ContentType`, `Scene`, `ChatMessageMetaType`, `MessageSource` 等）、发送参数（`SendMessageOptions`）等。
    - ChatArea 在 store 类型和 Hook 中广泛使用这些类型，保持与核心聊天引擎一致。
- UI 与交互：
  - `@coze-common/chat-uikit`：
    - 提供 `MessageBox`, `SuggestionItem`, `UIKitCustomComponentsMap`, `useStateWithLocalCache`, `MessageBoxTheme` 等；
    - ChatArea 通过 `UIKitCustomComponentsProvider` 将自定义组件注入 UIKit 层，以实现品牌/场景定制。
  - `@coze-common/chat-uikit-shared`：
    - 提供 `UIKitEventProvider`, `Layout` 等，上层通过 `layout` props 控制 PC/Mobile 等布局变体。
  - `@coze-common/scroll-view`：
    - 暴露 `ScrollViewController`，配合 `ScrollViewProvider` 统一控制消息列表滚动行为（滚动到底部、滚动至特定 message 等）。
- 网络与 IO 抽象：
  - `@coze-arch/bot-api`, `@coze-arch/bot-http`, `@coze-arch/bot-utils`, `@coze-studio/uploader-adapter`, `@coze-common/websocket-manager-adapter` 等：
    - 提供与后台机器人服务、文件上传、WebSocket 会话等的集成功能；本包主要通过 service 与 hooks 层使用这些能力。
- 日志与监控：
  - `@coze-arch/logger`：
    - 在 report-events、service 层和插件生命周期中用于记录关键行为与错误（如 `getReportError`）。
- 其他基础库：
  - 状态与工具：`zustand`, `immer`, `lodash-es`, `eventemitter3`, `mitt`, `ahooks`；
  - UI/样式：`@coze-arch/coze-design`, `@douyinfe/semi-illustrations`, TailwindCSS；
  - 校验：`zod` 用于配置与数据结构校验。

## 项目流程与协作规范

- 分支与发布：
  - 本包遵循 monorepo 统一的分支与发布策略；版本号一般由 Rush/变更集工具统一管理，package.json 使用 `workspace:*` 对内部依赖对齐。
  - 在修改对外导出（尤其是 index.tsx 和 exports 子路径）时，应注意：
    - 保持向后兼容（新增类型/导出优先，不要轻易重命名移除）；
    - 若必须破坏兼容，应配合 monorepo 级别的 breaking change 说明与版本升级策略。
- 开发实践：
  - 功能通常拆分为：store 改动 + hooks 封装 + 组件使用 + 可选插件扩展点：
    - 先在 store 定义/调整状态与类型；
    - 通过 hooks 提供对 store 或 service 的访问；
    - 在 ChatArea 主视图或子组件中拼装 UI；
    - 如有横切关注点（埋点、调试、过滤逻辑），再通过 plugin system 注入。
  - 新增/修改 store 或 hook 时，尽量在 `__tests__` 目录补充对应单测，使用 Testing Library 与 Vitest。

## 开发注意事项与易踩坑点

- 避免直接操作内部 store：
  - 业务侧应通过导出的 Hook 与控制器（如 `useChatArea`, `useChatAreaController`, `useWaiting`, `useGetMessages` 等）操作聊天区域；
  - 直接从内部路径导入未暴露的 store/工具可能导致未来重构时难以兼容。
- 插件系统的边界：
  - 使用 Readonly* 服务时，不要试图修改内部状态；
  - Writeable* 服务用于允许插件变更状态，但要遵守类型约束，避免在生命周期中进行重入或复杂副作用（如重复发送消息）。
- 多层 Provider 组合：
  - ChatAreaMain 中 Provider 嵌套层级较深（UIKit、Preference、Copywriting、DragUpload、ScrollView 等），在新增上下文时要注意插入位置：
    - 与 UI 强相关的 Provider 建议靠近对应子组件；
    - 与行为/配置相关的 Provider 则更靠近 ChatArea 根部，以便 Hook 可复用。
- 移动/PC 布局：
  - `layout` prop 影响样式（PC/Mobile）以及部分组件行为（如 header、输入框高度、列表 padding 等），改动时注意在两个布局下分别验证。

## 面向 AI 助手的实践建议

- 在本包内新增特性时：
  - 优先考虑是否可作为插件能力实现（通过 `plugin` 生命周期与组件插槽），而不是直接改动核心消息流；
  - 若必须修改核心逻辑，应：
    - 在 `store` + `hooks` 层先抽象出能力；
    - 再在 `ChatAreaMain` 或子组件中消费这些 Hook。
- 在修改公共导出（index.tsx）时：
  - 保持导出顺序与分组清晰（基础组件/Hook/Store 类型/插件类型），避免重复导出或循环依赖；
  - 对新增公共类型，优先在 store/context/plugin 的 types 文件中集中管理，而不是散落在组件文件里。
- 在新增测试时：
  - 若测试涉及复杂交互，优先通过 Storybook 进行手工验证，再补自动化测试；
  - 覆盖关键路径：消息发送/接收流程、等待状态变化、插件生命周期触发、文件上传/拖拽、Onboarding 建议展示与选择等。