# chat-uikit 子包开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/chat-uikit）中安全、高效地协作开发。

## 全局架构与职责
- 本子包是聊天区域前端 UI 组件库，主要输出 React 组件、hooks、上下文和工具函数供上层应用复用。
- 入口在 src/index.ts，对外统一 re-export 组件（components）、工具（utils）、上下文（context）和 hooks，避免直接从深层路径引用。
- 组件层：
  - src/components/chat/：核心聊天视图、消息列表、输入区、录音等交互组件。
  - src/components/contents/：不同消息内容类型（文本、图片、文件等）的展示组件，以及文件卡片常量（如 SUCCESS_FILE_ICON_MAP）。
  - src/components/common/：通用基础 UI，例如 FullWidthAligner、MessageBox 相关类型与皮肤、LazyCozeMdBox 等。
  - src/components/md-box-slots/：Markdown 内容的插槽组件，比如 CozeImage、CozeLink 等，适配上层的 @coze-arch/bot-md-box-adapter。
- 状态与上下文：
  - src/context/custom-components/：UIKitCustomComponentsProvider、useUIKitCustomComponent 等，用于注入/覆盖某些 UI 组件，实现主题或样式自定义。
  - src/context/local-cache/：LocalCacheContext、useLocalCache 等，用于在聊天 UI 内读写本地缓存（localStorage）相关配置。
- 工具与常量：
  - src/utils/：封装平台检测（is-apple-webkit、platform）、多模态与消息类型判断（multimodal、is-text 等）、文件名处理（file-name.ts）、本地缓存工具（local-cache/*）、埋点上报（report-event）等。
  - src/constants/：包括消息展示、布局宽度、提示 ID 等常量，例如 MESSAGE_TYPE_VALID_IN_TEXT_LIST、EXPECT_CONTEXT_WIDTH_MOBILE、NO_MESSAGE_ID_MARK。
- 类型与协议：
  - 部分类型直接从 @coze-common/chat-core 引入，例如 ContentType、消息等，这里只负责 UI 展示与交互逻辑，不负责业务数据结构的定义。

## 依赖与外部集成
- 设计体系：
  - 基于 @coze-arch/coze-design 与 @douyinfe/semi-ui/@douyinfe/semi-icons/@douyinfe/semi-illustrations 搭建界面，风格需与整体 Design System 保持一致。
- Chat 领域依赖：
  - @coze-common/chat-core 用于消息类型、会话结构等核心类型与逻辑；
  - @coze-common/chat-hooks、@coze-common/chat-area-utils、@coze-common/chat-uikit-shared 提供业务级 hooks 与工具，本包更多关注视图层；
  - @coze-arch/bot-md-box-adapter 为 Markdown 或富文本内容适配，相关组件放在 src/components/md-box-slots/ 中。
- 通用库：
  - 使用 react / react-dom 18；
  - 工具库包括 lodash-es、dayjs、class-variance-authority（样式变体）、classnames、mitt（事件总线）、bowser/平台检测、rc-textarea 等；
  - 内部事件/录音交互等通过 mitt、专用 hooks（如 use-audio-record-interaction）组织。
- 静态资源：
  - 文件类型图标等存放在 src/assets/file/ 下，统一在 src/index.ts 中导出（如 ZipIcon、DocxIcon 等），避免在业务层直接引用静态文件路径。

## 开发与构建流程
- 包级脚本（见 package.json）：
  - 开发调试：
    - npm run dev：使用 Rspack dev server 启动本地开发环境（基于 @rspack/cli 与 React Refresh），一般用于在独立环境里调试组件。
    - npm run dev:storybook：启动 Storybook（7.x），用于可视化调试组件和交互状态。
  - 代码检查：
    - npm run lint：调用 @coze-arch/eslint-config 预设（preset: web），本包关闭了一些限制深层路径的规则（no-deep-relative-import 等）。
    - npm run lint:type：tsc -p tsconfig.json --noEmit，仅做类型检查。
  - 测试：
    - npm test：使用 Vitest（配置见 vitest.config.ts，preset:"web"），--passWithNoTests 允许测试缺失时也通过。
    - npm run test:watch：Vitest 监听模式。
    - npm run test:cov：在 test 的基础上产出覆盖率报告（使用 @vitest/coverage-v8）。
  - 构建：
    - npm run build 当前实现为 exit 0，占位，真正产物通常由 workspace 顶层构建脚本（如 Rush/rollup）完成；AI 助手不要自行在此包内重写完整构建链，除非明确需求。
- 工作区集成：
  - 顶层通过 rush 管理所有包，首次开发前应执行 rush update（README 中的 init 流程）；
  - 本包导出 dist 与 README.md，主入口仍是 ESM（main 指向 src/index.ts），在统一构建后会被 rollup/Rspack 等打包。

## 源码结构与常见扩展点
- src/components：
  - chat/：聊天主区域、消息流、输入框、语音录制（audio-record）等，AudioStaticToast 及其 props 从此处 re-export；
  - contents/：
    - file-content/components/FileCard/constants.ts 暴露 SUCCESS_FILE_ICON_MAP 供外部消费；
    - 其他内容型组件按消息类型拆分，通常配合 ContentType 与 MESSAGE_TYPE_VALID_IN_TEXT_LIST 使用。
  - common/：
    - full-width-aligner：处理在不同容器宽度下的对齐问题；
    - coze-md-box：延迟加载（LazyCozeMdBox）用于渲染富内容；
    - message-box：负责消息气泡的布局、主题（MessageBoxTheme、MessageBoxProps）。
  - md-box-slots/：为 md-box 提供插槽组件，如 CozeImage、CozeImageWithPreview、CozeLink，关注单一渲染/交互需求。
- src/hooks：
  - use-state-with-local-cache：在 useState 的基础上封装 localStorage 持久化逻辑，已在 index.ts 对外导出，适合作为跨组件复用的状态工具。
  - use-event-callback、use-observe-card-container 等侧重性能和 DOM 观察；
  - use-audio-record-interaction：封装录音的状态机与交互细节，组件层只关注 UI 状态与回调。
- src/context：
  - custom-components：
    - UIKitCustomComponentsProvider：利用 React Context 提供组件覆盖能力；
    - UIKitCustomComponents / UIKitCustomComponentsMap 类型描述可被替换的组件集合；
    - useUIKitCustomComponent：在组件内按约定 key 读取覆盖后的实现。
  - local-cache：
    - LocalCacheContext & useLocalCache：提供统一的本地缓存读写入口，底层依赖 utils/local-cache 函数。
- src/utils：
  - 平台与环境：is-apple-webkit.ts、platform.ts、bowser 等，共同用于判断浏览器能力（如录音、预览兼容性）。
  - 内容判断：is-file / is-image / is-text / is-function-call / is-suggestion / multimodal.ts，用于推断消息内容类型并选择对应展示组件。
  - 本地缓存：utils/local-cache/* 与 getReadLocalStoreValue、getWriteLocalStoreValue 等，组合 localStorage 访问逻辑与兜底策略。
  - 其他工具：convert-bytes（大小格式化）、date-time（时间展示）、safe-json-parse 等。
- 样式与主题：
  - main.css、tailwind.config.ts、.stylelintrc.js 配合 @coze-arch/stylelint-config 使用；Tailwind 仅作为原子类/工具类补充，主要视觉规范仍以设计体系组件为主。

## 项目约定与编码风格
- 代码风格：
  - TypeScript + React 18 函数组件，静态类型约束由 @coze-arch/ts-config 提供；
  - import 顺序与风格由 @coze-arch/eslint-config 管控，本包关闭了一些跨包通用的“禁止深相对路径”规则，以兼容本地层级结构。
- 组件导出约定：
  - 公共 API 必须经由 src/index.ts 暴露，避免上层按深路径 import；新增对外功能时，请同时更新 index.ts。
  - 静态资源（svg 图标等）应集中在 assets/ 中，并在 index.ts 中 export * as NamedIcon 的形式暴露。
- 上下文/Provider 使用约定：
  - UIKitCustomComponentsProvider 应放在使用 chat-uikit 的应用树较外层，用来替换/扩展内部组件实现；
  - LocalCacheContext 只封装“与聊天 UI 强相关”的本地缓存键值，不在此扩展跨产品线的通用缓存。
- 国际化与文案：
  - 文案与多语言逻辑一般由 @coze-arch/i18n 或上层应用注入，本包内部应避免硬编码业务/地区相关文案，尽量通过 props 或 context 透传。

## 测试与调试约定
- 单元测试：
  - 测试文件位于 __tests__ 目录下（含 hooks/、utils/ 等子目录），采用 Vitest + @testing-library/react / @testing-library/jest-dom。
  - 新增 hooks 或 util 时，优先在 __tests__/hooks 或 __tests__/utils 下添加对应测试；若只做 UI 细节调整，可视情况仅依赖 Storybook 手动验证。
- Storybook：
  - stories/ 目录中包含各组件的 Story 文件，命名与组件路径基本对应；
  - 交互较复杂的组件（如录音、长消息流）建议通过 Storybook 添加“场景复现”的 story，便于回归和设计/产品评审。

## 流程、分支与发布
- 本子包归属于 monorepo（由 Rush 管理），具体分支策略与发布流程以仓库根目录的 CONTRIBUTING.md / README.md 为准；
- 一般流程：
  - 在 feature 分支进行开发；
  - 通过 rush test / rush lint 等顶层命令完成全仓检查；
  - 由统一发布脚本将 @coze-common/chat-uikit 打包并发布到内部/外部 npm 源。
- AI 助手在修改此包时，应保证：
  - 不随意调整 rush.json 中的包定义与版本；
  - 不擅自更改 build 流程的核心设定（如 rollup/rspack 配置），除非任务明确要求，并在说明中指出变更。

## 非常规/需要注意的特性
- 构建脚本占位：package.json 中的 build 仅为占位（exit 0），实际构建依赖顶层流水线；
- 深路径导出：部分内部模块（如 FileCard/constants、audio-record/audio-static-toast）会在 src/index.ts 中做“转发导出”，这是为了兼容历史调用路径，新增导出时请保持这一习惯；
- 浏览器与平台适配：
  - 多处依赖 is-apple-webkit、bowser 等进行 User-Agent 兼容判断，尤其在音频录制、图片预览等场景；
  - 若新增与底层能力相关的逻辑（录屏、拖拽上传等），请复用已有 platform 判断工具，避免重复实现；
- 本地缓存使用：
  - local-cache 工具与 LocalCacheContext 提供统一封装，避免在组件内直接调用 window.localStorage；
  - 读写时应考虑 JSON 解析失败、安全兜底等情况，优先使用 getReadLocalStoreValue/getWriteLocalStoreValue。

## AI 助手协作建议
- 在实现新功能前，先确认是否已有对应的“工具层/上下文层”能力（如已有 hooks 或 utils）可以复用；
- 所有对外能力从 src/index.ts 暴露，避免在调用侧 import 内部深层路径；
- 若需要新增公共配置或跨组件上下文：
  - 优先放入 src/context 或 src/utils，再由 index.ts 导出；
  - 保持与现有命名和类型风格一致（React.FC + 明确的 Props 类型）；
- 修改涉及 Chat 领域类型/协议时，请先在 @coze-common/chat-core（或更核心的包）确认类型定义，再在本包内更新 UI 使用方式，而不是在本包中“自造”消息结构。
