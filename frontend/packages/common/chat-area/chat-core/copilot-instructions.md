# @coze-common/chat-core 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/chat-core）中安全、高效地协作开发。

## 1. 全局架构与核心职责

- 本子包是前端聊天区域的「核心 SDK 层」，对外以 ChatCore/ChatSDK 为唯一入口暴露统一的聊天、历史消息、上传插件、请求管理等能力。
- 入口文件为 src/index.ts，集中 re-export 了 ChatCore 类、消息相关类型、请求场景枚举、上传插件相关类型与实现、错误类型以及一些共享常量工具。
- Chat SDK 主类定义在 src/chat-sdk/index.ts：
  - 负责生命周期管理（create/destroy）、实例去重（同一 bot_id 或 preset_bot 只创建一个实例）、事件总线（EventEmitter）、与服务层解耦。
  - 内部组合多个核心模块：
    - RequestManager（src/request-manager）统一管理 Axios 实例、请求/响应拦截器、请求场景配置。
    - HttpChunk（src/channel/http-chunk）负责流式 chunk 消息的收发，与 SendMessageService/HttpChunkService 协同。
    - MessageManager（src/message/message-manager.ts）负责历史消息拉取、删除、上下文清理等。
    - PreSendLocalMessageFactory + PreSendLocalMessageEventsManager（src/message/presend-local-message）负责本地预发送消息的构造与状态事件维护。
    - ChunkProcessor（src/message/chunk-processor.ts）负责将 HTTP/流式 chunk 转换为统一的 Message 结构。
    - PluginsService（src/chat-sdk/services/plugins-service.ts）负责插件注册/查询，目前核心是上传插件。
    - ReportLog & ReportEventsTracer（src/report-log, src/chat-sdk/events）统一打点和埋点上报。
- 网络请求层架构（src/request-manager）：
  - RequestManager 基于 axios.create() 封装，合并默认场景配置（getDefaultSceneConfig）与外部传入的 RequestManagerOptions。
  - RequestScene 枚举（SendMessage / ResumeMessage / GetMessage / ClearHistory / ClearMessageContext / DeleteMessage / BreakMessage / ReportMessage / ChatASR）+ 场景配置 SceneConfig（url/method/hooks）。
  - 全局 hooks：
    - useCsrfRequestHook：自动补齐 CSRF 所需 header（x-requested-with, content-type）及空 data。
    - useApiErrorResponseHook：后端返回 code != 0 时抛出 ApiError（src/request-manager/api-error.ts）。
  - 通过 RequestManager.getSceneConfig(scene) 暴露合并后的场景配置，供 Service 层使用。
- 上传插件架构（src/plugins/upload-plugin）：
  - ChatCoreUploadPlugin 封装 @coze-studio/uploader-adapter：
    - 首先通过 requestInstance.post(GET_AUTH_URL) 获取上传鉴权（sts token 等），然后用 getUploader 创建真正的上传器。
    - 内部维护 EventEmitter 作为事件总线，透出 on(eventName, callback) 接口，事件 payload 类型由 EventPayloadMaps 约束。
    - 支持 pause/cancel 操作，文件添加逻辑封装在 addFile 中（根据 file/type + stsToken）。
- 共享常量与文件类型（src/shared/const.ts）：
  - 定义 SDK 版本 CHAT_CORE_VERSION、环境 ENV、发布版本 DeployVersion、时间相关常量、WS 重试上限等。
  - 透传 @coze-studio/file-kit/logic 中的 FileTypeEnum/FileType/TFileTypeConfig/FILE_TYPE_CONFIG/getFileInfo，作为 ChatCore 文件处理统一入口。
- 对外 API（见 README.md 与 src/index.ts）：
  - 默认导出 ChatCore（实际是 ChatSDK 类），同时具名导出 ChatCore 别名和大量 message 类型、错误类型、上传插件类型及 RequestScene 等，用于上层应用按需 import。

## 2. 关键开发流程（构建 / 测试 / 调试）

- 本包通过 workspace 方式集成在 Rush monorepo 中，但自身构建脚本极简：
  - package.json 中 build 目前为 "build": "exit 0"，真实构建通常由上层 Rush/打包流程驱动（比如使用 tsconfig.build.json）。
  - TypeScript 校验：
    - `npm run lint:type` 调用 `tsc -p tsconfig.json --noEmit`，tsconfig.json 只包含 references（tsconfig.build.json/tsconfig.misc.json）且 exclude **/*，由上层工程控制具体编译配置。
  - Lint：
    - `npm run lint` 使用根目录 eslint.config.js 与 @coze-arch/eslint-config，preset = 'web'，并附带统一的命名规范规则。
  - 单测与覆盖率：
    - `npm run test` -> `vitest --run --passWithNoTests`。
    - `npm run test:cov` -> `npm run test -- --coverage`，由 vitest.config.ts 统一配置 preset=node、setupFiles=__tests__/setup.ts。
- 建议在该子包下调试的方式：
  - 编写/扩展 __tests__ 下的单测文件（如 channel/chat-sdk/message/request-manager 等已有测试），通过 vitest 运行。
  - 对于 RequestManager/ChatSDK 流程相关修改，优先通过单测构造伪造 axios 响应及 event 流进行回归。
  - 若涉及上传插件逻辑（依赖真实浏览器 File 对象与网络请求），优先 mock requestInstance 与 getUploader，避免直接访问真实后端。

## 3. 项目特有约定与代码风格

- 命名与 ESLint 规范（见 eslint.config.js）：
  - class/interface/type 必须 PascalCase。
  - 变量、函数默认 camelCase，允许 UPPER_CASE/snake_case 作为特例，导出或全局变量可为 UPPER_CASE/camelCase。
  - 对象字面量属性、enum 成员、type 属性在命名上较宽松（允许 snake_case/PascalCase）。
  - import 标识符要求 camelCase/PascalCase/UPPER_CASE。
- 模块引入路径：
  - 内部模块大量使用 @ 别名（如 '@/request-manager/types'、'@/message/types'），这是由上层 tsconfig 路径映射定义的，新增文件时保持同一模式。
  - 相对路径通常用于跨「大模块」引用时的特殊场景（如 plugins/upload-plugin 内部 import '../../request-manager'），请优先保持当前写法。
- 错误处理约定：
  - HTTP 层统一由 ApiError 包装：当后端返回 data.code != 0 时，通过 useApiErrorResponseHook 抛出 ApiError，业务侧通常无需再手动检查 code 字段。
  - 上传插件内部异常通过 safeAsyncThrow 记录日志，但不会直接打断外层业务逻辑；AI 助手修改时应保留这一「不影响主流程」的特性。
  - ChatSDK.destroy() 中会确保：清理 HttpChunk 事件、清空 EventEmitter、清空 ChunkProcessor 缓存、销毁预发送事件管理器并从静态实例 map 中删除，避免内存泄漏。
- 多实例管理：
  - ChatSDK 通过静态 Map<string, ChatSDK> instances 与 getUniqueKey(props) 实现：同一 preset_bot 或 bot_id 复用实例，重复 create 会输出错误日志并返回已存在实例。
  - AI 助手在扩展构造/初始化逻辑时，不应绕过 create 静态方法直接 new ChatSDK，避免破坏实例复用约定。
- 事件总线与回调：
  - ChatSDK 内部使用 EventEmitter<SdkEventsEnum>；暴露 on/off/emit 接口，重复监听同一事件会被上报为错误（但不会抛出异常）。
  - HttpChunkService 会在 ChatSDK.initServices() 后调用 onHttpChunkEvents() 绑定事件；改动该服务时需注意初始化顺序。
- 时间与重试常量（shared/const.ts）：
  - 所有时间相关逻辑统一使用 MILLISECONDS_PER_MINUTE / BETWEEN_CHUNK_TIMEOUT / SEND_MESSAGE_TIMEOUT 等常量，AI 助手新增逻辑时不要硬编码毫秒值。

## 4. 核心组件与对外集成细节

### 4.1 ChatSDK / ChatCore

- 入口与导出：
  - src/chat-sdk/index.ts 定义 class ChatSDK；src/index.ts 将其默认导出并再次具名导出为 ChatCore，且透出类型别名与事件枚举。
- 创建与配置：
  - 通过 `ChatCore.create(props: CreateProps)` 创建实例；CreateProps 在 src/chat-sdk/types/interface.ts 中定义，包含：
    - bot_id / preset_bot（二选一或同时，preset_bot 优先用于唯一 key）。
    - conversation_id / user / scene / biz / env / deployVersion / bot_version / draft_mode / space_id 等业务字段。
    - tokenManager（可选，src/credential）：若存在则在 initTokenManager 中向 RequestManager 注入 onBeforeRequest hook，自动设置 Authorization 头。
    - requestManagerOptions（可选）：用于扩展 RequestManager 默认场景配置与 hooks。
- 消息相关 API：
  - createTextMessage / createImageMessage / createFileMessage / createTextAndFileMixMessage / createNormalizedPayloadMessage：
    - 实际委托给 CreateMessageService，内部会：
      - 使用 PreSendLocalMessageFactory 构造本地预发送消息；
      - 触发 PreSendLocalMessageEventsManager 事件以便 UI 同步状态；
      - 结合 pluginsService 将上传插件能力注入消息 payload（例如文件/图片消息）。
  - sendMessage / resumeMessage：
    - 委托给 SendMessageService，底层通过 HttpChunk + RequestManager 发起网络请求，并让 ChunkProcessor 解析流式返回。
  - getHistoryMessage / clearMessageContext / clearHistory / deleteMessage / reportMessage / breakMessage / chatASR：
    - 委托给 MessageManagerService，基于 RequestScene 映射到不同 API 路径；
    - chatASR 会在存在 space_id 时向 FormData 追加 space_id 字段。
- 事件订阅：
  - `sdk.on(SdkEventsEnum.SomeEvent, callback)` 用于订阅 SDK 内部抛出的各种事件（具体枚举见 src/chat-sdk/types/interface.ts）；
  - 返回的函数用于取消订阅；也可显式调用 off(event, callback)。

### 4.2 RequestManager 与请求场景

- RequestManager 初始化流程（src/request-manager/index.ts）：
  - 构造时会将 getDefaultSceneConfig() 与外部 options 通过 muteMergeWithArray 合并，生成 mergedBaseOptions。
  - createRequest() 基于 mergedBaseOptions 创建 axios 实例 request，并挂载 request/response 拦截器。
  - useRequestInterceptor：
    - 先执行全局 hooks.onBeforeRequest，再根据 url 匹配具体 scene 的 hooks.onBeforeRequest。
  - useResponseInterceptor：
    - 成功与失败场景都分别执行全局 + 场景级 hooks（onAfterResponse/onErrorResponse），以 AxiosResponse 为单位链式处理。
- getDefaultSceneConfig（src/request-manager/request-config.ts）：
  - 已预设所有聊天相关后端路由，默认 method 全为 POST，路径全部在 /api/conversation/* 与 /api/audio/transcriptions。
  - 添加新场景时建议扩展 RequestScene 枚举 + scenes 字段，而非在业务处直接写死 URL。

### 4.3 上传插件 ChatCoreUploadPlugin

- ChatCoreUploadPlugin（src/plugins/upload-plugin/index.ts）：
  - 构造参数 ChatCoreUploadPluginProps = Config & UploadPluginProps，其中：
    - Config 来自 @coze-studio/uploader-adapter，控制上传底层行为（schema/imageHost/serviceId/objectConfig 等）。
    - UploadPluginProps 来自本包 types（文件 File、FileType、额外业务参数等）。
  - 初始化流程：
    1. 通过 requestInstance.post(GET_AUTH_URL, { data: { scene: 'bot_task' } }) 获取 stsToken 等上传凭证；
    2. 使用 getUploader 创建 uploader：
       - imageHost 基于 upload_host 组装为 https://upload_host；
       - imageConfig/objectConfig 的 serviceId 均来自 service_id；
       - 其余配置合并传入的 uploaderConfig；
    3. 立即调用 addFile(file, type) 将文件加入队列，并绑定 complete/progress/error 事件，将其透传到自身 eventBus；
    4. 最后调用 uploader.start() 启动上传。
  - 外部使用：
    - 通过 ChatCoreUploadPlugin 实例上的 on('complete' | 'progress' | 'error', callback) 监听事件；
    - 调用 pause/cancel 控制上传生命周期。

### 4.4 共享常量 / 文件类型

- shared/const.ts：
  - CHAT_CORE_VERSION：当前 SDK 版本号，ChatSDK 初始化时会作为 meta.chatCoreVersion 透传到 ReportLog，用于日志聚合。
  - ENV / DeployVersion：强类型约束环境与部署版本，避免自由字符串。
  - 时间常量统一以「秒/毫秒/分钟」为单位命名，便于理解与复用。
  - 文件类型相关从 @coze-studio/file-kit/logic 透传，外部统一使用 FILE_TYPE_CONFIG/FileTypeEnum/FileType/TFileTypeConfig/getFileInfo 操作文件。

## 5. 项目流程、协作与提交规范（本子包范围）

- 依赖与版本：
  - 所有依赖版本统一由 monorepo 管理；本包 package.json 中 workspace:* 依赖（@coze-arch/*、@coze-common/*、@coze-studio/*）请勿随意改成固定版本。
  - debug@^4.3.4 在 devDependencies 中标注为“脚本自动补齐，请勿改动”，AI 助手不要删除或改版本。
- 分支与发布流程：
  - 该信息主要由 monorepo 顶层仓库维护，本子包内部无单独分支策略；AI 助手在修改时默认假设遵循主仓库标准（feature 分支 + 提交合并）。
- 提交前检查建议：
  - 至少保证通过：`npm run lint`、`npm run lint:type`、`npm run test`。
  - 若调整了 RequestScene/ChatSDK 行为，补充或更新 __tests__ 下对应测试文件。

## 6. 不常见 / 需要特别注意的点

- ChatSDK.instances 去重逻辑：
  - ChatSDK.create 会在同一 unique_key 下打印 console.error("duplicate chat core instance error") 并返回已存在实例；请不要基于「多实例」场景绕过这一约束，而应设计新的唯一键规则或额外维度。
- 事件监听重复检测：
  - ChatSDK.on 若发现同一 event 已在 eventBus.eventNames() 中存在，会通过 reportLog.slardarError 上报“重复监听事件”；这是一种软约束，用于帮助排查内存/行为问题。
- RequestManager 的场景 hooks 查找方式：
  - 通过 config.url 精确匹配 scenes 中的 url 字段来决定是否执行场景 hooks；因此修改默认 url 时，要同时检查所有依赖 RequestScene 的 Service 实现。
- 上传插件依赖全局 requestInstance：
  - ChatCoreUploadPlugin 使用的是独立的 axios 实例 requestInstance，而不是 ChatSDK 自身的 RequestManager.request，这意味着其默认不会自动应用 RequestManager 的 hooks（如 tokenManager 的 Authorization）；如需行为一致，需要显式调整。
- 时间/重试相关魔法数字：
  - 例如 BETWEEN_CHUNK_TIMEOUT = 5 * MILLISECONDS_PER_MINUTE、WS_MAX_RETRY_COUNT = 10；在实现新增重试/超时逻辑时，优先使用这些常量而非新建常量或硬编码。

## 7. AI 助手在本包中工作的实践建议

- 修改 ChatSDK 时：
  - 保持 initProps → initModules → initServices → onEvents 的初始化顺序，新增依赖模块尽量放在 initModules 中集中创建，再在 initServices 中注入。
  - 避免在构造函数中加入复杂业务逻辑；优先放到 Service 层或 Hook 中。
- 扩展网络调用：
  - 优先通过扩展 RequestScene + getDefaultSceneConfig + RequestManagerService（或新增 Service）来完成，而不是在任意文件中直接使用 axios。
- 扩展上传能力：
  - 建议在 plugins/upload-plugin/types 中定义新的事件或 payload 类型，再在 ChatCoreUploadPlugin 中透传，而不是绕过 uploader-adapter 自己实现上传流程。
- 引入新依赖：
  - 尽量优先复用 monorepo 内已有基础包（@coze-arch/*、@coze-common/* 等），并确保新增依赖符合浏览器/Node 环境的要求（本包 preset=node，主要跑在 Node 测试环境 + 浏览器运行环境）。
