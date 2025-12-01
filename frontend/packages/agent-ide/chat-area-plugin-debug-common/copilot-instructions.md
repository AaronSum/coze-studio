# Coze Chat Area Debug Common 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-area-plugin-debug-common）中安全、高效地协作开发。

## 1. 全局架构与角色定位

- 本子包提供「调试通用插件（Debug Common Plugin）」能力，供聊天区域 Provider 组合使用，用于 Bot Playground 场景下的调试、打点与多 Agent 状态管理等增强逻辑。
- 上层主要使用方位于 frontend/packages/agent-ide/chat-area-provider-adapter/src/provider/index.tsx，通过 getDebugCommonPluginRegistry 注入到 BotDebugChatAreaProvider。
- 该包实现的是 @coze-common/chat-area 定义的插件协议：
  - 通过 src/index.ts 暴露 getDebugCommonPluginRegistry，返回 PluginRegistryEntry<PluginBizContext>。
  - 插件实体为 src/plugin.ts 中的 BizPlugin，继承 WriteableChatAreaPlugin<PluginBizContext>。
  - 生命周期服务由 src/services/life-cycle/index.ts 中的 bizLifeCycleServiceGenerator 汇总，按 app / message / command / render 四大类拆分。
- 业务上下文类型通过 src/types/biz-context.ts 统一定义，贯穿插件生命周期：包含 botId、Scene（聊天场景）以及 methods.refreshTaskList 等业务方法。
- 公共调试逻辑及与 Studio 其他子系统的集成封装在 src/utils/index.ts 中，对外暴露为一组纯函数工具，供生命周期实现或其他插件调用。

## 2. 代码结构总览

- src/index.ts
  - 暴露 getDebugCommonPluginRegistry(props: PluginBizContext)。
  - 创建 PluginRegistryEntry：
    - createPluginBizContext：将 props 透传为生命周期可访问的业务上下文。
    - Plugin：指定为 BizPlugin。
- src/plugin.ts
  - BizPlugin 继承 WriteableChatAreaPlugin<PluginBizContext>。
  - 固定配置：
    - pluginMode = PluginMode.Writeable（可写插件，允许修改消息流）。
    - pluginName = PluginName.DebugCommon（统一命名常量，供平台识别）。
  - lifeCycleServices = createWriteableLifeCycleServices(this, bizLifeCycleServiceGenerator)：
    - 使用 chat-area 提供的工厂方法，将当前插件与本包定义的生命周期生成器拼装。
- src/services/life-cycle/index.ts
  - 定义 bizLifeCycleServiceGenerator: WriteableLifeCycleServiceGenerator<PluginBizContext>。
  - 返回对象包含：appLifeCycleService / messageLifeCycleService / commandLifeCycleService / renderLifeCycleService。
  - 具体实现拆分在同目录 app.ts / message.ts / command.ts / render.ts（如需新增/修改逻辑，优先在这些文件中扩展，而不是直接改 BizPlugin）。
- src/types/biz-context.ts
  - PluginBizContext：
    - botId: string — 当前调试 Bot ID。
    - scene: Scene — 来自 @coze-common/chat-area 的场景枚举，常见为 Scene.Playground。
    - methods.refreshTaskList: () => void — 由上层注入，用于刷新任务列表等调试相关 UI。
- src/utils/index.ts
  - 与 Bot 调试和多 Agent 相关的公共工具：
    - getMockSetReqOptions(baseBotInfo: BotInfoStore)：根据 Bot 模式（Single/Multi）与 Space 信息拼装调试流量头部（rpc-persist-mock-*），用于后端 Mock 流量路由。
    - sendTeaEventOnBeforeSendMessage(...)：在消息发送前打点，按 from（inputAndSend / regenerate / suggestion）映射到 Tea 事件 EVENT_NAMES.click_send_message。
    - handleBotStateBeforeSendMessage(ctx, scene)：在 Playground 或 MultiMode 下注入空间、Agent 状态和 Mock header；返回新的 message/options 对象，供 beforeSend 生命周期使用。
    - isCreateTaskMessage(message)：根据 tool_response 文本内容判断是否为「Task created successfully」类消息。
    - reportReceiveEvent(message)：封装 messageReportEvent 上报逻辑，对 follow_up / answer 等不同类型区分处理。
    - updateAgentBeforeSendMessage(ctx)：处理多 Agent 场景下再生消息时的当前 Agent ID 修正。
    - getBotStateBeforeSendMessage()：从多个 Store 聚合出 MessageExtraInfoBotState，用于写入消息 extra_info.bot_state。

## 3. 与外部模块的关键集成

- @coze-common/chat-area
  - 提供 PluginRegistryEntry、WriteableChatAreaPlugin、WriteableLifeCycleServiceGenerator、OnBeforeSendMessageContext、Scene、ContentType、Message、getBotState、MessageExtraInfoBotState 等核心类型与工具。
  - 所有插件必须遵守该模块的生命周期与命名约定，尤其是 pluginName（PluginName.DebugCommon）和生命周期服务结构。
- @coze-studio/bot-detail-store
  - usePageRuntimeStore / useMultiAgentStore / useBotInfoStore / useManuallySwitchAgentStore 等 Zustand Store：
    - 管理 Bot 基本信息、当前 Agent、是否自有 Bot 等运行时状态。
    - utils.index.ts 中的大部分逻辑通过这些 Store 获取上下文，以此拼装请求或上报数据。
- @coze-arch/bot-api
  - BotMode（Single/Multi）、TrafficScene（CozeMultiAgentDebug / CozeSingleAgentDebug）：
    - 用于决定 Mock 头部值与调试流量场景。
- @coze-arch/bot-utils
  - messageReportEvent：统一的消息上报入口；
  - safeJSONParse：解析 tool_response 文本内容时使用，避免异常。
- @coze-arch/bot-tea
  - EVENT_NAMES、ParamsTypeDefine、sendTeaEvent：埋点事件定义与发送函数，sendTeaEventOnBeforeSendMessage 使用它们构造 click_send_message 事件。
- @coze-arch/bot-studio-store
  - useSpaceStore：提供当前 Space ID，handleBotStateBeforeSendMessage 在 Playground 场景为 extendFiled 注入 space_id。

## 4. 典型调用链与数据流

- Playground 中 Debug Common 插件注册过程（自上而下）：
  - chat-area-provider-adapter/src/provider/index.tsx：
    - 构造 DebugCommonPlugin = getDebugCommonPluginRegistry({ scene: Scene.Playground, botId, methods: { refreshTaskList: () => 0 } })。
    - 将 DebugCommonPlugin 统一放入 pluginRegistryList，与 Resume / Grab / ChatBackground / Reasoning 等插件共同传入 BotDebugChatAreaProvider。
  - BotDebugChatAreaProvider 在内部根据 PluginRegistryEntry：
    - 调用 createPluginBizContext 注入 PluginBizContext。
    - 实例化 BizPlugin，挂载到聊天区域生命周期中。
- 发送消息前的数据注入（handleBotStateBeforeSendMessage）：
  - 由 chat-area 生命周期（通常是 onBeforeSendMessage 之类）调用。
  - 在特定场景（Playground 或 MultiMode）下：
    - 克隆并 merge 请求 options，追加 extendFiled.space_id、extendFiled.extra.bot_state。
    - merge Mock 流量头部（getMockSetReqOptions 返回的 headers）。
  - 返回新的 { message, options } 给上游发送流程，保证后端能按调试场景解析。
- 消息打点与任务识别：
  - sendTeaEventOnBeforeSendMessage：根据 from 字段映射 Tea 埋点，记录发送消息入口（手动输入/再生/建议）。
  - reportReceiveEvent：对 follow_up 消息和 answer 完成事件进行上报，确保消息闭环统计。
  - isCreateTaskMessage：用于在工具响应中识别「创建任务成功」场景，后续可结合 methods.refreshTaskList 做任务列表刷新（当前上层默认实现为 noop，可按业务需要扩展）。

## 5. 开发、构建与测试流程

- 本子包为 Rush 管理的 workspace 包：
  - 安装依赖请在仓库根目录执行：
    - rush install 或 rush update。
- 包内 npm 脚本（见 package.json）：
  - build: `exit 0`
    - 当前构建命令为占位实现（直接退出 0），真正产物由上层 Rsbuild / Rush pipeline 统一产出。
    - 在本包新增构建产物时，优先考虑接入统一 Rsbuild 配置，而不是在此处手写 Vite/webpack 配置。
  - lint: `eslint ./ --cache`
    - 使用 @coze-arch/eslint-config（见 eslint.config.js）preset: 'web'，请遵循其规则（包括命名、import 顺序等）。
  - test: `vitest --run --passWithNoTests`
  - test:cov: `npm run test -- --coverage`
- Vitest 配置：
  - vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig({ dirname: __dirname, preset: 'web' })。
  - 测试文件建议放在 __tests__ 目录或同级 *.test.ts(x) 中。
- TypeScript 配置：
  - tsconfig.json 为组合项目配置，composite: true，引用 tsconfig.build.json 和 tsconfig.misc.json。
  - 默认 exclude: ["**/*"]，真正参与编译的文件由引用的 tsconfig.* 决定，请在对应文件中维护 include/files。

## 6. 项目特有的约定与模式

- 插件命名与模式：
  - pluginName 必须使用 @coze-common/chat-area 中定义的 PluginName 枚举（此处为 DebugCommon），不得随意 hardcode 字符串，避免与平台其他插件冲突。
  - pluginMode 对应插件是否可修改消息流；Debug Common 固定为 Writeable。
- 生命周期拆分：
  - 所有与 UI 渲染无关的业务逻辑，优先放入 life-cycle/* 中的对应 service：
    - appLifeCycleService：全局初始化、销毁、场景切换等。
    - messageLifeCycleService：消息发送/接收前后的处理，如 handleBotStateBeforeSendMessage、reportReceiveEvent 等。
    - commandLifeCycleService：与指令/命令相关的逻辑。
    - renderLifeCycleService：与渲染插件 UI 元素相关的逻辑。
- Store 使用约定：
  - 使用 useXXXStore.getState() 直接读取状态，而不是在工具函数中使用 React hooks；这些工具函数本身是与组件解耦的纯函数/静态逻辑。
  - 若需在组件中监听 Store 变化，请在上层 UI 包（如 chat-area-provider-adapter）中处理，不在本包补充 React 组件。
- 埋点与 Mock 头部：
  - 埋点事件必须使用 EVENT_NAMES 枚举和值对象 ParamsTypeDefine，对缺少字段或类型不符场景要提前在工具函数中处理。
  - Mock 相关 header key 为 rpc-persist-mock-* 前缀，新增字段时需与后端协商，并统一封装在 getMockSetReqOptions 中。

## 7. 协作与修改建议

- 在扩展 Debug Common 功能时，推荐步骤：
  - 在 src/types/biz-context.ts 增加新的业务上下文字段（如更多 methods 或配置），并在上层调用处（chat-area-provider-adapter）完成注入。
  - 在 src/utils/index.ts 中添加新的纯函数工具，保证可复用性与可测试性。
  - 在 src/services/life-cycle 下的对应 service 文件中调用这些工具函数，并保持单一职责。
- 添加新集成：
  - 若需接入新的外部依赖（例如新的统计 SDK 或 Bot API），优先在 utils 中封装薄层，生命周期 service 中只调用封装函数，避免耦合太多细节。
- 变更前后建议：
  - 对影响消息结构（extendFiled、extra.bot_state 等）的改动，务必在本包或上层应用中补充 Vitest 单元测试，验证请求 options 拼装的结果。

## 8. 分支、发布与其他注意事项

- 本仓库整体由 Rush + PNPM 管理，通常通过统一流水线构建、测试和发布；本子包本身不持有独立的发布脚本。
- 提交代码时需通过 lint / test，遵循统一 ESLint 规则和 Vitest 预设。
- 改动涉及调试流量或埋点逻辑时，务必与后端与数据侧确认字段和枚举值，避免线上统计异常。
