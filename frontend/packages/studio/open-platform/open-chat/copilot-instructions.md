# open-chat 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/open-platform/open-chat）中安全、高效地协作开发。

## 总体架构与职责
- 本包是 Coze Web ChatApp SDK 的一部分，定位为「开放场景下可复用的聊天 UI & 能力封装」，在开放平台和 WebSDK 中提供统一的聊天体验。
- 核心导出集中在 src/index.ts：
	- BuilderChat / BuilderChatRef：用于 Studio/开放平台内的可配置聊天组件；
	- WebSdkChat：面向外部 WebSDK 的嵌入式聊天组件；
	- isAuthError / OpenApiError / postErrorMessage / ChatSdkErrorType / ChatSDKErrorData：统一错误判断与向父窗口上报的工具。
- 高层次模块划分：
	- chat/*：具体聊天场景封装（builder-chat、web-sdk），负责将下层 chat-core/chat-area 等通用组件组装成最终聊天体验；
	- components/studio-open-chat/*：开放平台/Studio 里的 UI 组合组件（布局、头部、侧边栏、错误态等）；
	- helper/*：与本 SDK 业务强绑定的辅助逻辑（消息历史、本地存储、上传能力、上报埋点等）；
	- util/*：环境、错误、存储、连接等通用工具，尽量无 UI 依赖；
	- types/* & exports/*：对外暴露的类型和二次导出，用于保证外部接入方 API 稳定。
- 数据与依赖流转：
	- 上层应用通过 BuilderChat/WebSdkChat 传入 botId、会话配置、环境信息等；
	- 组件内部依赖 @coze-common/chat-core、@coze-common/chat-area、@coze-common/chat-uikit 以及 @coze-studio/open-env-adapter 等包，向 Coze OpenAPI 发送请求并渲染消息流；
	- 本包的 helper 与 util 层封装上传、错误处理、本地消息缓存等跨组件复用能力。

## 源码结构总览
- src/index.ts
	- 对外唯一入口，集中导出 chat 层组件和 util/error 中的错误相关能力；
	- 新增公共导出时应优先在此聚合，确保 package.json exports/ typesVersions 与之保持一致。
- src/chat/builder-chat/*
	- 提供开放平台/Studio 内使用的主聊天组件 BuilderChat；
	- 典型结构：
		- index.tsx：组件入口，接收 IBuilderChatProps，内部挂 ref（BuilderChatRef）供外部控制（如滚动、重置等）；
		- context/hooks/services：封装与 chat-core / store / OpenAPI 的连接逻辑；
		- plugins：挂载 chat-area 相关插件（背景、reasoning、快捷指令等）。
- src/chat/web-sdk/*
	- 提供 WebSdkChat 组件，对外 Web SDK 封装层；
	- 通常通过 iframe 或嵌入式容器集成到第三方页面，内部依赖 util/env 与 util/error 做环境适配和错误上报。
- src/components/studio-open-chat/*
	- area / components / hooks / provider / store / plugin：围绕 Studio 场景的 UI 组件和状态逻辑；
	- 例如 conversation-list-sider、header、footer、error-fallback 等目录定义具体 UI 和交互形态；
	- 该层对 chat-*、helper/* 有强依赖，不建议在其它子包直接引用内部实现。
- src/helper/*
	- clear-local-message-history.ts / get-local-message-history.ts / get-local-message-history-key.ts：通过 key 规则管理本地消息历史的读写与清除；
	- coze-api-upload.ts：基于 @coze-studio/file-kit 和 @coze/api 等实现上传能力，并导出 createSDKUploadPluginClass 供 chat-area 或业务使用；
	- studio-open-client-reporter.ts：封装上报逻辑（依赖埋点/日志系统）；
	- is-show-feedback.ts：根据业务规则决定是否展示反馈入口。
- src/util/*
	- env.ts：透传 @coze-studio/open-env-adapter 中的 openApiHostByRegion / getOpenSDKUrl 等方法，用于根据 region/环境生成 API 和 SDK 访问地址；
	- error.ts：统一错误类型定义与工具，定义 SDKErrorCode / ChatSdkError / OpenApiError / isAuthError / postErrorMessage 等；
	- connector.ts / storage.ts / json-handle.ts / is-promise-like.ts：封装通用通信、存储和工具函数；
	- util 目录中的逻辑应保持与 UI 解耦，方便在不同聊天入口（BuilderChat/WebSdkChat）之间共享。
- src/exports/* 与 src/types/*
	- 对外暴露类型、常量、辅助方法，供外部 TS 项目引用；
	- 修改这里时要同步更新 package.json 中的 exports/typesVersions，避免 TS 分辨路径不一致。
- typings.d.ts
	- 声明本包用到的全局类型（如 window 下额外字段），避免在源码中频繁使用 any。

## 依赖与外部集成
- 关键外部依赖（仅列与本包强耦合的）：
	- @coze-arch/*：
		- bot-api / bot-semi / bot-utils：与 bot 能力、Semi 组件、工具函数相关；
		- i18n：通过 I18n.t() 实现多语言文案抽取（例如 util/error 中的 getServerError）；
		- logger：统一日志输出；
		- idl：与后端 IDL 定义保持一致的类型/接口；
	- @coze-common/*：
		- chat-core / chat-area / chat-uikit / chat-uikit-shared / chat-workflow-render：底层聊天引擎与 UI 套件，本包主要做场景组装与配置；
		- chat-answer-action、chat-area-plugin-*：在 BuilderChat/WebSdkChat 中作为插件挂载，用于快捷指令、reasoning 展示、消息抓取等高级能力；
	- @coze-studio/open-env-adapter：
		- 提供 openApiHostByRegion、openSdkPrefix 等方法，统一处理不同 region / 部署环境下的域名和路径；
		- open-chat 通过 src/util/env.ts 进行简单 re-export，避免业务代码直接依赖 adapter 包路径；
	- @coze-studio/file-kit：
		- 在 helper/coze-api-upload.ts 中作为文件上传适配层；
	- @coze/api：
		- 官方 OpenAPI SDK，配合 helper 与 util 进行包装；
	- react / react-dom / zustand / ahooks / axios / dayjs / lodash-es 等：
		- 作为通用技术栈，不在此展开；AI 助手按社区常规用法处理即可。

## 开发与测试工作流
- 安装依赖（在 monorepo 根目录）：
	- 首次：rush install；
	- 更新：rush update。
- 本包常用 npm script（在 frontend/packages/studio/open-platform/open-chat 下执行）：
	- 构建：npm run build
		- 当前实现为 exit 0，仅占位；打包通常由上层应用/脚手架统一处理，本包以源码形式（src/*）供 bundler 使用。
	- 测试：npm test
		- 实际调用 vitest --run --passWithNoTests；
		- 测试配置在 vitest.config.ts，preset 为 'web'，并使用 __tests__/setup.ts 进行环境初始化（如 jsdom、全局 mock 等）。
	- 覆盖率：npm run test:cov
		- 对应 vitest run --coverage，使用 @vitest/coverage-v8；
	- Lint：npm run lint
		- 使用 eslint.config.js + @coze-arch/eslint-config，自动带缓存；
- 测试组织：
	- __tests__/ 目录为主测试入口，当前仅有 setup.ts；
	- 新增模块时，更推荐在 __tests__ 下以功能维度组织测试，而不是散落在 src 内部。

## 项目内约定与常见模式
- 错误处理与上报：
	- 业务内部错误使用 SDKErrorCode + ChatSdkError 进行归类和包装；
	- 与后端返回码相关的错误通过 OpenApiError 与 isAuthError 封装；
	- 需要告知宿主页面的错误，统一通过 postErrorMessage 发送 window.parent.postMessage({ type: 'chat-sdk-error', data }, '*')；
	- AI 助手在新增错误场景时，应优先扩展 SDKErrorCode / ChatSdkErrorType，并通过 postErrorMessage 对外暴露。
- 本地消息历史：
	- 使用 helper/get-local-message-history-key.ts 根据 botId / 会话等信息生成存储 key；
	- helper/get-local-message-history.ts 和 clear-local-message-history.ts 负责读取与清理；
	- 该能力通常在 BuilderChat/WebSdkChat 初始化或销毁时调用，避免污染其它业务存储。
- 上传能力扩展：
	- helper/coze-api-upload.ts 暴露 createSDKUploadPluginClass，用于创建上传插件类；
	- 在需要新增上传类型或前处理逻辑时，建议扩展该插件类而不是在组件内部直接调用 @coze/api。
- 事件与上报：
	- studio-open-client-reporter 封装埋点/日志的上报逻辑，尽量在该层做事件名与字段约束，避免散落 magic string。
- 环境/域名适配：
	- 所有与 OpenAPI 域名、SDK js 地址相关的逻辑应集中使用 src/util/env.ts 中的封装，以保持多 region、多环境下行为一致。

## 团队流程与协作
- 版本与依赖：
	- package.json 中的依赖大量使用 workspace:*，升级这些依赖可能影响多个包；
	- 涉及 @coze-common/chat-* 或 @coze-studio/open-env-adapter 等核心包调整时，应在相关子包一并做回归测试。
- 分支与提交：
	- 遵循仓库根目录 CONTRIBUTING.md 与 CODE_OF_CONDUCT.md 的约定；
	- 在本包内修改时，尽量保持变更局部且向后兼容，避免破坏现有公开导出。
- 代码风格：
	- TypeScript + React 18，hooks 风格优先；
	- 样式通常使用 less（例如 chat/builder-chat/index.module.less），并通过设计系统 @coze-arch/coze-design 与 @douyinfe/semi-icons 统一 UI；
	- 不在业务代码中直接操作 DOM 或 window，除非像 postErrorMessage 这类必要的跨窗通信。

## AI 助手开发建议
- 在新增功能时，优先查找是否已有类似实现（例如其它 chat-* 或 components/studio-open-chat 下的组件），复用现有模式：
	- 使用 helper 与 util 抽象公共逻辑；
	- 遵循错误与上报的统一封装；
	- 避免在组件内嵌入环境、上报、存储细节。
- 任何会改变对外使用方式的改动（导出新增/修改、props 变化等），都需要同步更新：
	- README.md 中的说明；
	- 如有必要，更新 src/exports 与 types 目录中对应类型定义。

