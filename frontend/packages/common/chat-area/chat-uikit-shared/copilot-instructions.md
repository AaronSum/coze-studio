# @coze-common/chat-uikit-shared — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/chat-uikit-shared）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包是聊天 UI 套件的「共享类型与事件中心」层，主要为上层 chat 组件、聊天输入框、消息列表等提供**类型定义、常量与事件总线**，几乎不包含具体 UI 组件实现。
- 源码集中在 src/，按职责分为：
  - src/types：对外暴露的业务类型与接口定义（消息结构、内容结构、事件参数、文件信息、输入框配置等）。
  - src/context/event-center：UIKit 事件中心（上下文、Provider 与 hooks），用于在 chat UI 内分发统一事件。
  - src/constants/file.ts：文件上传相关常量（大小限制、默认值、可接受的后缀等）。
  - src/index.ts：统一导出入口，将前述类型、常量和上下文 API 暴露给使用方。
  - src/typings.d.ts：通过三斜线引用接入 @coze-arch/bot-typings 全局类型。
- 运行时代码体量极小，核心职责是**保证不同 chat 子系统在类型、事件与文件约束上的统一**，被视为低层「协议层」。

## 构建与测试工作流
- 包管理与构建：
  - 依赖通过 Rush + workspace:* 统一管理，首次开发需在仓库根目录执行 rush update。
  - package.json 中 build 脚本为占位实现："build": "exit 0"，实际打包由上层应用/工具链统一完成；本包主要提供 TS 源码与类型。
- 常用脚本（在 frontend/packages/common/chat-area/chat-uikit-shared 目录执行）：
  - lint：`npm run lint` → `eslint ./ --cache`，规则来自 @coze-arch/eslint-config 的 web 预设。
  - test：`npm run test` → `vitest --run --passWithNoTests`，测试配置由 @coze-arch/vitest-config 统一管理；当前包未提供具体用例时也不会报错。
  - test:cov：`npm run test:cov`，在上一步基础上增加覆盖率统计。
- TypeScript：
  - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，rootDir 为 src，outDir 为 dist，启用 JSX（react-jsx）与 ESNext 模块。
  - references 显式依赖 bot-md-box-adapter、bot-typings、chat-core 以及前端通用 config 包，保证 TS 项目引用顺序与增量构建正确。

## 类型与事件模型概览
- 核心类型入口在 src/index.ts，统一 re-export 了下列分组：
  - 通用 UI/文案配置（来自 src/types/common.ts）：
    - ICardEmptyConfig、ICopywritingConfig、ICardCopywritingConfig、IFileCopywritingConfig、IChatUploadCopywritingConfig 等：定义空状态、卡片、文件上传等在不同语言/场景下的文案形态。
    - IMessage：聊天消息的通用结构（通常包含 id、角色、内容数组等），是 chat-uikit 生态中消息渲染的基础类型。
    - IBaseContentProps、IContentConfig、IContentConfigs：描述单条内容块（text/image/file/functionCall 等）如何渲染与配置。
    - IconType、Layout：UI 图标类型与布局枚举，为 chat 组件布局/样式做抽象。
  - 内容相关类型（src/types/content.ts）：
    - IContent：统一的内容联合类型，封装 text/image/file/functionCall 等不同内容形态。
    - ISuggestionContent、IImageContent、IFileContent、IFunctionCallContent：不同内容类型的强类型结构，用于区分渲染逻辑与事件入口。
    - GetBotInfo：获取 Bot 信息的函数签名（通常由上层注入），便于内容渲染时读到 Bot 头像/名称等。
    - MdBoxProps、ContentBoxType：Markdown 容器与内容盒子类型，与 @coze-arch/bot-md-box-adapter 配合使用。
  - 文案配置类型（src/types/copywriting.ts）：
    - ISimpleFunctionContentCopywriting：针对 functionCall 内容的简化文案结构。
    - IChatInputCopywritingConfig：聊天输入框（占位符、发送按钮、文件上传提示等）文案配置。
  - 事件相关类型（src/types/event.ts）：
    - IEventCallbacksParams / IEventCallbacks：chat 组件间通用事件回调集合（链接点击、图片点击、上传取消/重试、卡片按钮点击、消息重试等）。
    - LinkEventData、IOnLinkClickParams、IOnImageClickParams 等：各类事件具体的参数结构。
    - MouseEventProps：封装常见鼠标事件属性，用于透传给上层业务。
  - 文件相关类型（src/types/file.ts）：
    - IFileInfo、IFileUploadInfo：描述文件基础信息与上传过程信息（状态、进度等）。
    - IFileAttributeKeys：文件属性 key 的枚举封装。
    - IFileCardTooltipsCopyWritingConfig：文件卡片上提示文案的配置结构。
  - 聊天输入相关类型（src/types/chat-input/*）：
    - MentionList、SendButtonProps、SendFileMessagePayload、SendTextMessagePayload、UiKitChatInputButtonConfig、UiKitChatInputButtonStatus、IChatInputProps、InputMode：统一 chat 输入框行为的参数与渲染配置。
    - AudioRecordProps / AudioRecordEvents / AudioRecordOptions：录音输入相关配置与事件类型。
    - InputNativeCallbacks / InputState / InputController / OnBeforeProcessKeyDown：原生输入行为（keydown 等）的扩展回调，用于在聊天输入中接管/增强键盘交互。

## 事件中心与上下文
- UIKit 事件中心位于 src/context/event-center：
  - 对外导出的 hooks 与上下文：
    - useUiKitEventCenter：获取当前作用域内的事件中心实例，通常在 chat 组件与工具组件中使用，用于派发/订阅统一事件。
    - UIKitEventContext / UIKitEventProvider：React Context 与 Provider 组件，用于在某个 chat 树中提供独立的事件域。
    - useObserveChatContainer：辅助 hook，一般用于在容器层观察/绑定与 chat 容器相关的事件（如滚动、可见性变化等）。
  - 事件类型定义（src/context/event-center/type.ts）：
    - UIKitEvents：枚举/联合类型，定义事件名集合（如 message:retry、upload:cancel 等）。
    - UIKitEventMap：事件名 → 事件 payload 类型的映射，总控事件总线的类型安全。
    - UIKitEventCenter：基于 mitt 的轻量事件中心接口封装，提供 on/off/emit 等方法。
    - UIKitEventProviderProps：Provider 组件的 props 类型（通常只包含 children 与可选初始配置）。
  - 实现细节（不在 index.ts 暴露）：
    - UIKitEventProvider 内部使用 mitt 实例作为事件总线，配合 React Context 在树内共享；AI 修改时应保持 mitt 的单实例/作用域设计，避免在多个组件中重复创建事件中心。

## 文件上传相关常量
- src/constants/file.ts 暴露上传约束与默认值：
  - UploadType：文件上传类型枚举（具体值请在源码中查看），指导上层区分图片/通用文件等不同通道。
  - MAX_FILE_MBYTE：最大文件大小（MB）上限，用于展示/校验提示。
  - DEFAULT_MAX_FILE_SIZE：默认最大文件大小（以字节为单位），便于在未显式配置时兜底。
  - ACCEPT_FILE_EXTENSION：默认允许的文件扩展名集合，供 input[type="file"] 或上传组件使用。
- 上层 chat 组件通常会在 UI/表单层结合这些常量做前置校验，AI 在修改这些常量时需注意潜在的跨包影响（如上传组件、后端约束、文案提示）。

## 工程与编码约定
- 语言与运行时：
  - TypeScript + React 18，仅在类型与上下文相关代码中使用 JSX；本包不直接渲染 UI，但类型中的 JSX 依赖需要 React 作为 devDependencies/peerDependencies。
  - 运行时代码少量依赖 mitt、ahooks、classnames 与 @douyinfe/semi-icons 等库，主要服务于事件中心与上层 UI 交互。
- 代码风格：
  - ESLint 配置使用 @coze-arch/eslint-config（preset: web），新增文件时应遵循已有 import 顺序、命名与类型显式化习惯。
  - 所有源码文件头部使用 Apache-2.0 版权声明，新增文件时需保持一致（参考现有 ts/tsx 文件）。
- 导出约定：
  - 仅通过 src/index.ts 暴露公共 API；新增类型/常量/上下文时优先在对应子目录创建文件，然后在 index.ts 中增加 re-export。
  - 避免从深层路径（如 src/types/chat-input/input-native-callbacks）在外部直接 import，以便将来内部结构调整时保持对外 API 稳定。

## 与其他子包和外部依赖的关系
- 依赖 @coze-common/chat-core：
  - chat-core 提供更上层 Chat 流程控制、状态管理与业务逻辑；本包只关心 UI 侧的类型/事件，不直接操作核心聊天状态。
- 依赖 @coze-arch/bot-md-box-adapter：
  - 为 Markdown 消息内容渲染提供 Adapter 与 props 类型（MdBoxProps 等），chat-uikit 组件可基于这些类型接入统一的 MD 渲染体系。
- 依赖 @coze-arch/bot-typings：
  - 通过 src/typings.d.ts 的三斜线指令注入，为消息/内容类型提供后端契约类型（如角色、附件结构等）；在修改 IMessage / IContent 等定义前，应先确认与 bot-typings 中类型的一致性。
- UI 相关依赖：
  - @douyinfe/semi-icons：icon 组件库，通常仅用于类型中声明 IconType 或在事件中心/上层组件中搭配使用。
  - ahooks：可用于事件中心 hook 的内部实现（如节流、监听 DOM），当前在本包中使用有限，扩展时要注意依赖体积与 SSR 兼容性。

## 对 AI 助手的使用建议
- 修改/新增类型时：
  - 优先在 src/types 中创建/修改对应文件，并通过 src/index.ts 统一导出，保证所有上层依赖都能通过包入口获取类型。
  - 避免随意改变现有公共类型字段的含义或必选性；如需扩展，优先通过新增可选字段或联合类型，而不是修改已有字段类型。
- 修改事件中心相关逻辑时：
  - 保持 UIKitEventMap 与 UIKitEvents 的一一对应，新增事件时同步更新 map、类型别名与可能使用的地方（如 useObserveChatContainer）。
  - 不在组件外暴露 mitt 实例，所有事件订阅与派发都应通过 useUiKitEventCenter 或 Context 进行，以保证作用域正确。
- 调整文件上传约束时：
  - 在 src/constants/file.ts 中修改常量前，先全局搜索 UploadType/MAX_FILE_MBYTE/DEFAULT_MAX_FILE_SIZE/ACCEPT_FILE_EXTENSION 的使用点，评估对上传 UI 与后端校验的影响。
