# @coze-agent-ide/chat-area-provider-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-area-provider-adapter）中安全、高效地协作开发。

## 全局架构与职责边界
- 子包路径：frontend/packages/agent-ide/chat-area-provider-adapter，对应 npm 包名 `@coze-agent-ide/chat-area-provider-adapter`，属于 Agent IDE 领域下「调试聊天区」适配层。
- 主要职责：
  - 将 Agent IDE Bot 调试页面的上下文（bot 信息、技能配置、引导文案、背景图、埋点等）适配为通用聊天区 Provider 所需的参数与插件列表。
  - 对外只导出一个组件和其 props 类型：
    - `BotDebugChatAreaProviderAdapter`
    - `BotDebugChatAreaProviderAdapterProps`
- 依赖的核心上游能力：
  - `@coze-agent-ide/chat-area-provider`：真正负责渲染调试聊天区 UI 和核心行为的 Provider（下文简称 BaseProvider），本包只包装其 props。
  - `@coze-agent-ide/chat-area-plugin-debug-common`：调试通用插件（DebugCommonPlugin），提供调试工具条、任务列表刷新等能力。
  - 若干通用聊天插件：
    - `@coze-common/chat-area-plugin-resume`：会话「继续」插件。
    - `@coze-common/chat-area-plugin-message-grab`：消息抓取上传插件。
    - `@coze-common/chat-area-plugin-reasoning`：推理过程相关插件。
  - Bot 详情与技能相关 store：
    - `@coze-studio/bot-detail-store/page-runtime`：页面运行期信息（如 grabPluginId）。
    - `@coze-studio/bot-detail-store/bot-skill`：引导文案、背景图等技能配置。
    - `@coze-studio/bot-detail-store/bot-info`：Bot 基础信息（名称、头像等）。
  - 开发者 API：
    - `@coze-arch/bot-api/developer_api` + `DeveloperApi`：用于拉取草稿会话消息列表 `GetMessageList`，构造初始对话上下文。
  - 通用聊天能力与埋点：
    - `@coze-common/chat-core` 的 `Scene` 枚举（此处使用 `Scene.Playground`）。
    - `@coze-common/chat-area` 的类型 `MixInitResponse`、`SenderInfo` 作为初始化返回结构。
    - `@coze-common/chat-hooks` 提供的 `useEventCallback`，用于稳定的回调封装。
    - `@coze-arch/bot-hooks` 的 `useMessageReportEvent`，统一注册消息相关埋点。

## 关键组件与数据流

### 对外入口
- [src/index.ts](frontend/packages/agent-ide/chat-area-provider-adapter/src/index.ts) 仅做 re-export：
  - 从 `./provider` 导出 `BotDebugChatAreaProviderAdapter` 及其 props 类型。
  - 新增公共能力时，**必须先在 provider 内实现，再从 index.ts 统一导出**，避免消费方绕过适配层直接依赖内部实现文件。

### BotDebugChatAreaProviderAdapter
- 定义位置：[src/provider/index.tsx](frontend/packages/agent-ide/chat-area-provider-adapter/src/provider/index.tsx)。
- Props 定义：
  - `BotDebugChatAreaProviderAdapterProps`：
    - 继承自 `BotDebugChatAreaProviderProps` 的部分字段：仅保留 `botId`（通过 `Pick<..., 'botId'>`）。
    - 额外增加：`userId: string | undefined`。
  - 语义：
    - `botId`：当前调试的 Bot 标识，是所有 API 请求与 botInfoMap 的关键字段；调用方必须传入合法的 Bot ID。
    - `userId`：当前登录用户 ID；若为 `undefined`，组件直接返回 `null`，即不渲染聊天区，避免未登录状态误触发调试逻辑。

### 内部行为与数据流
- 调试通用插件注册：
  - 通过 `getDebugCommonPluginRegistry({ scene: Scene.Playground, botId, methods: { refreshTaskList: () => 0 } })` 获取 `DebugCommonPlugin`。
  - `scene` 固定为 `Scene.Playground`，说明该适配器只服务于「Playground/调试」场景；新增其他场景时需新增或扩展适配器。
  - `refreshTaskList` 当前为占位实现（直接返回 0），真实刷新逻辑需在后续以可注入方式扩展，而不是在此处写死。

- Grab 插件与页面运行期 Store：
  - `useCreateGrabPlugin()` 返回：
    - `GrabPlugin`：消息抓取插件实例，加入插件列表。
    - `grabEnableUpload`：是否允许上传，透传给 BaseProvider。
    - `grabPluginId`：插件实例 ID。
  - 使用 `usePageRuntimeStore(state => state.setPageRuntimeBotInfo)` 获取 setter，并在 `useEffect` 中：
    - 当 `grabPluginId` 存在时调用 `setPageRuntimeBotInfo({ grabPluginId })`，将插件信息写入 page-runtime store，便于其他区域（例如调试面板）复用。
  - **AI 修改时注意**：
    - `useEffect` 依赖列表仅包含 `grabPluginId`，保持现有行为：只有 ID 变化时才写入 store。
    - 不要在此处增加与 UI 强相关的副作用（如弹窗、路由跳转），保持纯粹的「上下文同步」。

- 背景图插件与展示控制：
  - 通过 `useBotEditorChatBackground()` 获取：
    - `ChatBackgroundPlugin`：背景图渲染插件，加入插件列表。
    - `showBackground`：是否展示背景图的布尔控制，透传给 BaseProvider。

- 埋点注册：
  - 在组件体内直接调用 `useMessageReportEvent()` 注册消息相关事件上报，此 hook 不需要额外参数。
  - 该调用无返回值，作用是副作用式注册；如需扩展埋点，请在 bot-hooks 包中调整，而非在当前子包重复实现。

- 初始消息拉取与 requestToInit：
  - `getMessageList`：对 `DeveloperApi.GetMessageList` 的轻封装，参数类型为 `GetMessageListRequest`。
  - `requestToInit`：
    - 通过 `useEventCallback` 包裹 async 函数，返回 `Promise<MixInitResponse>`，传给 BaseProvider 作为初始化请求函数。
    - 内部逻辑：
      1. 从 `useBotSkillStore.getState()` 读取 `onboardingContent` 与 `backgroundImageInfoList`；从中取出 `prologue` 文案及首张背景图。
      2. 从 `useBotInfoStore.getState()` 读取 Bot 基本信息，获取 `name` 与 `icon_url`，用于构造 `botInfoMap`。
      3. 构造 `GetMessageListRequest`：
         - `bot_id`: `botId`（来自 props）。
         - `cursor`: `'0'`，从头开始拉取。
         - `count`: `15`，只取最近 15 条消息作为调试初始化上下文。
         - `draft_mode`: `true`，说明使用草稿态消息。
         - `scene`: `SceneFromIDL.Playground`，与聊天 Core 中的 Scene.Playground 对应。
      4. 调用 `getMessageList(params)`，得到 `dratMain`（注意命名中 typo，保留以兼容现有代码）。
      5. 按 `MixInitResponse` 要求返回：
         - `conversationId`: `dratMain.conversation_id`
         - `cursor`: `dratMain.cursor`
         - `hasMore`: `dratMain.hasmore`
         - `messageList`: `dratMain.message_list`
         - `lastSectionId`: `dratMain.last_section_id`
         - `prologue`: 上文获取的引导文案
         - `botInfoMap`: 以 `botId` 为 key 的映射，value 为 `SenderInfo`：
           - `nickname`: bot 名称（默认空字符串）
           - `url`: 头像地址（默认空字符串）
           - `id`: `botId`
           - `allowMention`: 固定为 `false`
         - `backgroundInfo`: `backgroundImageInfoList[0]`
         - `next_cursor`: `dratMain.next_cursor`
  - **异常与边界情况**：
    - 当前实现假设 `backgroundImageInfoList` 至少有一个元素，`botInfo` 可能为 null/undefined，因此在使用前做了可选链与默认值处理；新增逻辑时要避免对这些可选字段做未守卫的解构。
    - requestToInit 中未显式捕获异常，错误由 BaseProvider 或上游统一处理；若在此增加 try/catch，请务必保留错误上抛行为，并考虑埋点/日志上报位置。

- 插件列表与最终渲染：
  - `pluginRegistryList` 组装顺序：
    1. `DebugCommonPlugin`
    2. `ResumePluginRegistry`
    3. `GrabPlugin`
    4. `ChatBackgroundPlugin`
    5. `ReasoningPluginRegistry`
  - 若 `userId` 为空：直接 `return null`，不创建 BaseProvider，也不执行初始化请求；这是对未登录态的保护逻辑。
  - 否则渲染：
    ```tsx
    <BaseProvider
      requestToInit={requestToInit}
      botId={botId}
      pluginRegistryList={pluginRegistryList}
      showBackground={showBackground}
      grabEnableUpload={grabEnableUpload}
    >
      {children}
    </BaseProvider>
    ```

## 构建、测试与开发流程

- 包管理与依赖：
  - monorepo 使用 Rush + PNPM 管理，所有依赖以 `workspace:*` 形式声明；首次开发应在仓库根目录执行：`rush update`。
  - 本包依赖大量内部包（见 [package.json](frontend/packages/agent-ide/chat-area-provider-adapter/package.json)），包括 arch 层 API/Store、common 层 Chat 组件与 hooks、agent-ide 的基础 Provider 等；新增依赖时优先复用已有 workspace 包，避免引入重复库。

- npm 脚本（在子包目录运行）：
  - `npm run build`：当前为占位实现（`exit 0`），真实打包由上层应用或构建系统统一处理；**不要**在此包内自行增加 bundler。
  - `npm run lint`：执行 ESLint 检查，配置来自 `@coze-arch/eslint-config`（web 预设），入口为 eslint.config.js。
  - `npm run test`：运行 Vitest 单测，命令为 `vitest --run --passWithNoTests`，允许暂无测试文件时直接通过。
  - `npm run test:cov`：在 test 基础上增加 `--coverage` 收集覆盖率。

- TypeScript 工程配置：
  - [tsconfig.build.json](frontend/packages/agent-ide/chat-area-provider-adapter/tsconfig.build.json) 继承 `@coze-arch/ts-config/tsconfig.web.json`，关键配置：
    - `rootDir: "src"`，`outDir: "dist"`，`jsx: "react-jsx"`。
    - `module: "ESNext"`，`moduleResolution: "bundler"`，`target: "ES2020"`，适配现代浏览器与打包器。
    - `references` 中显式声明了对 arch/common/agent-ide/studio 等多个子包的依赖，保证 TS project references 顺序正确。
  - 如需新增跨包类型依赖，需同步更新 `references`，否则在 `tsc --build` 时可能出现依赖顺序错误。

## 项目约定与开发注意事项

- 职责边界：
  - 本包仅作为「适配层」，负责：
    - 从各类 Store/API 中取出数据，拼装成 BaseProvider 所需的初始化参数和插件列表；
    - 不直接渲染消息列表/输入框，也不处理底层聊天逻辑，这些交由 `@coze-agent-ide/chat-area-provider` 与下游插件处理。
  - 扩展新功能时，优先：
    - 在插件包（如 debug-common / message-grab / resume / reasoning）中实现能力；
    - 在本包中仅注入或组合新的插件/参数，而不是增加复杂 UI。

- Store 使用规范：
  - 通过 `useXxxStore.getState()` 获取静态快照，用于一次性读取（如 requestToInit 中的 onboardingContent、botInfo 等）；
  - 通过 `useXxxStore(selector)` 获取响应式 slice，用于在 React 组件中订阅变更（例如 `usePageRuntimeStore`），必须传入 selector 以避免不必要重渲染。
  - 不要在 effect 之外直接在 render 过程中调用带副作用的 store 方法（如 setPageRuntimeBotInfo），保持 React 渲染纯函数特性。

- 插件列表顺序与依赖：
  - 当前插件数组的顺序对功能显示顺序可能有影响（例如工具条的排列），修改前建议在 Agent IDE 调试页面实际验证；
  - 新增插件时：
    - 保证其实现遵守 BaseProvider 要求的接口（「插件注册器」而非直接组件）；
    - 在 `pluginRegistryList` 中以稳定顺序插入，避免影响现有 UI 约定。

- userId 判空逻辑：
  - `!userId` 时直接返回 `null`，是安全兜底行为，防止匿名用户进入调试聊天区；
  - 如需支持匿名/游客调试，应在调用方显式决定行为并在改造后谨慎调整此逻辑，而不是简单删掉判空。

## 与其它子包的集成关系

- 与 `@coze-agent-ide/chat-area-provider`：
  - 本包唯一实际渲染由 BaseProvider 完成；任何对聊天区功能的修改若与 Provider 组件强相关，应优先在该包中调整，再在本包更新调用方式。

- 与 `@coze-studio/bot-detail-store`：
  - Bot 信息（名称、头像）、技能配置（onboardingContent、背景图）和 page-runtime 信息（grabPluginId）均来自该 Store 体系；
  - 若 Bot 详情域模型发生变化（字段名调整等），需要同步更新本包中的取数逻辑和 `MixInitResponse` 组装逻辑。

- 与 `@coze-arch/bot-api`：
  - 仅使用 developer_api 下的 `GetMessageList` 拉取草稿消息列表，不在本包构造其他 API；
  - 新增 API 交互时，应在 bot-api 包中定义/封装后再引入本包，而不是直接拼接 URL 或请求参数。

## 对 AI 助手的操作建议

- 新增/修改行为时：
  - 优先阅读 [src/provider/index.tsx](frontend/packages/agent-ide/chat-area-provider-adapter/src/provider/index.tsx) 中现有数据流，确保理解：
    - Bot 技能与信息从哪些 store 获取；
    - 初始化请求与插件列表如何组装；
    - BaseProvider 的关键 props 语义（requestToInit / pluginRegistryList / showBackground / grabEnableUpload）。
  - 修改前先在 monorepo 中搜索 `BotDebugChatAreaProviderAdapter` 的使用点，避免破坏下游消费方式。

- 不要在本包中做的事情：
  - 不要引入路由跳转、全局消息提示等与聊天区无直接关系的逻辑；这些属于更上层页面或应用。
  - 不要在此包直接操作 DOM 或使用 window/document（除非在极端必要场景并有充分理由）。
  - 不要改变 `requestToInit` 的返回结构字段名，否则会与 BaseProvider 及下游 Chat 组件协议不兼容。
