# @coze-agent-ide/chat-components-adapter Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-components-adapter）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包是 Agent IDE 聊天区域的「组件适配层」，位于 frontend/packages/agent-ide/chat-components-adapter，对应 npm 包名 `@coze-agent-ide/chat-components-adapter`。
- 当前仅对外导出一个组件 ReceiveMessageBox（见 src/index.ts），用于替换/适配通用聊天组件库中的「机器人接收消息气泡」。
- ReceiveMessageBox 基于 @coze-common/chat-area 与 @coze-common/chat-uikit 提供的能力，包装了主题、背景、头像显示规则等 Agent IDE 特有逻辑；上层聊天域（如 chat-area-provider、chat-area）通过 ComponentTypesMap['receiveMessageBox'] 接入本适配组件。
- 包本身不负责消息列表管理、数据拉取或发送逻辑，只负责单条消息 UI 与部分渲染配置；与线程管理、输入框等能力解耦。

## 代码结构与模块说明
- 入口导出：
  - [src/index.ts](frontend/packages/agent-ide/chat-components-adapter/src/index.ts)
    - 仅一行导出：`export { ReceiveMessageBox } from './components/receive-message-box';`
    - 若未来增加其它适配组件（如 SendMessageBox、SystemMessageBox），建议同样在 components 子目录中实现并在此统一导出。
- 组件实现：
  - [src/components/receive-message-box/index.tsx](frontend/packages/agent-ide/chat-components-adapter/src/components/receive-message-box/index.tsx)
    - 定义 `export const ReceiveMessageBox: ComponentTypesMap['receiveMessageBox']`，即严格遵循 chat-area 中约定的组件签名（props 结构完全由上游定义）。
    - 内部使用 `React.memo` + `isEqual(prevProps, nextProps)` 做深比较，避免频繁重渲染：
      - AI 修改 props 或增加新 prop 时，要考虑该深比较是否仍然适用（大对象频繁变更可能影响性能）。
    - 关键依赖：
      - `useChatBackgroundState`（来自 @coze-studio/bot-detail-store）：读取 `showBackground` 配置，控制聊天区域是否展示背景图/底色。
      - `MessageBox`（重命名为 UIKitMessageBox，来自 @coze-common/chat-uikit）：真正的聊天气泡 UI 组件。
      - `useBotInfoWithSenderId`、`PluginAsyncQuote`、`getReceiveMessageBoxTheme`、`ComponentTypesMap`（来自 @coze-common/chat-area）：
        - useBotInfoWithSenderId：根据 message.sender_id 获取发送者（机器人）信息，用于头像/昵称显示。
        - PluginAsyncQuote：在消息内部渲染异步插件引用内容（如插件卡片、工具调用结果）。
        - getReceiveMessageBoxTheme：基于 message 内容与 bizTheme（此处固定为 'debug'）计算消息主题（颜色、布局等）。
    - 主要渲染逻辑：
      - 从 props 解构 message/meta/renderFooter/children 等字段。
      - 使用 `useChatBackgroundState` 获取 `showBackground`，并传给 UIKitMessageBox。
      - 通过 `useBotInfoWithSenderId(message.sender_id)` 获取 senderInfo，用于头像与昵称；找不到时退化为 `{ id: '' }`。
      - 计算 `isOnlyChildMessage`、`isMessageGroupFirstMessage`、`isMessageGroupLastMessage` 来控制 wrapper 的 className：
        - `wrapper-last`：消息组最后一条。
        - `wrapper-short-spacing`：中间消息，间距更紧凑。
        - `wrapper-only-one`：组内只有一条消息时的特殊样式。
      - `<UIKitMessageBox>` 关键 props：
        - `messageId`：优先用 `message.message_id`，否则回退 `message.extra_info.local_message_id`，保证本地/远端消息都能在 UI 层稳定区分。
        - `theme`：调用 `getReceiveMessageBoxTheme({ message, onParseReceiveMessageBoxTheme: undefined, bizTheme: 'debug' })` 计算；目前 onParseReceiveMessageBoxTheme 留空，未来如需注入自定义 theme 解析可在此接入。
        - `renderFooter`：透传父级传入的 footer 渲染函数，用于展示时间、操作按钮等。
        - `showUserInfo={!meta.hideAvatar}`：由上游 meta 控制是否展示头像/昵称。
        - `getBotInfo={() => undefined}`：在 IDE 调试场景下不再从气泡内部拉取 bot 信息，而是依赖事先注入的 senderInfo。
        - `showBackground={showBackground}`：与 IDE 右侧配置面板联动。
        - `enableImageAutoSize` / `imageAutoSizeContainerWidth`：控制图片消息自适应宽度（由上游 chat-area 提供容器宽度）。
        - `eventCallbacks`：透传事件回调（点击卡片、复制、二次分享等）。
        - `isCardDisabled={meta.cardDisabled}`：根据 meta 控制是否禁用卡片交互。
        - `isContentLoading={isContentLoading}`：用于展示消息加载态（如插件异步执行中）。
      - MessageBox children：
        - 先渲染 `<PluginAsyncQuote message={message} />`；
        - 再渲染 `children`，由上游决定具体 message 内容块（文本、图片、卡片等）。
  - 样式文件： [src/components/receive-message-box/index.module.less](frontend/packages/agent-ide/chat-components-adapter/src/components/receive-message-box/index.module.less)
    - 定义 wrapper、wrapper-last、wrapper-short-spacing、wrapper-only-one 等类，通过 classNames 组合使用。
    - 修改时需保持类名与 TSX 中使用的 key 一致，避免 class 未生效。
- 类型定义：
  - [src/typings.d.ts](frontend/packages/agent-ide/chat-components-adapter/src/typings.d.ts)
    - 用于扩展 TS 或声明全局类型（目前内容较少/基础），修改时需兼顾 tsconfig.include 配置和编辑器类型解析。

## 构建、测试与开发流程
- 包管理与脚本（见 package.json）：
  - `build`: `exit 0`
    - 当前仅作为 Rush pipeline 占位，本包不单独产出 JS bundle；真实打包通常由上层应用或统一构建系统处理。
  - `lint`: `eslint ./ --cache`
    - 使用 eslint.config.js 中的 @coze-arch/eslint-config `web` 预设。
  - `test`: `vitest --run --passWithNoTests`
    - 单测框架为 Vitest，配置来源于 vitest.config.ts，采用 @coze-arch/vitest-config `preset: 'web'`。
  - `test:cov`: `npm run test -- --coverage`
    - 用于生成覆盖率报告。
- TypeScript 配置：
  - [tsconfig.build.json](frontend/packages/agent-ide/chat-components-adapter/tsconfig.build.json)
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，`rootDir: src`，`outDir: dist`，`jsx: react-jsx`，`moduleResolution: bundler`，适配现代打包工具。
    - references 显式依赖：
      - `@coze-arch/bot-api`、`@coze-arch/bot-typings`
      - `@coze-common/chat-area`、`@coze-common/chat-core`、`@coze-common/chat-uikit`
      - 各种 config 包（eslint-config、stylelint-config、ts-config、vitest-config）
      - `@coze-studio/bot-detail-store`
    - 新增跨包类型依赖时，若出现 tsc project references 错误，需要同步在此文件中追加对应 tsconfig.build.json 引用。
  - [tsconfig.json](frontend/packages/agent-ide/chat-components-adapter/tsconfig.json)、[tsconfig.misc.json](frontend/packages/agent-ide/chat-components-adapter/tsconfig.misc.json)
    - 用于 IDE 编辑体验和测试/配置文件的 TS 行为，保持与 workspace 统一即可。
- Storybook / 本地开发：
  - README.md 来自通用「react component with storybook」模板，但本包自身未显式提供 dev/storybook 脚本；如需交互调试 ReceiveMessageBox，通常在上游 chat-area / IDE 应用中进行，而不是在本包单独起 Storybook。

## 项目约定与模式
- 技术栈：
  - React 18 函数组件 + TypeScript。
  - 较轻量，仅使用 `classnames` 与 `lodash-es/isEqual` 辅助，其他能力完全依赖上游 workspace 包。
- 组件签名约定：
  - ReceiveMessageBox 必须符合 `ComponentTypesMap['receiveMessageBox']` 的 props 结构：
    - 包括 message、meta、renderFooter、children、isMessageGroupFirstMessage、isMessageGroupLastMessage、enableImageAutoSize、imageAutoSizeContainerWidth、eventCallbacks、isContentLoading 等字段。
  - 修改或新增 props 时，应优先在 @coze-common/chat-area 中更新 ComponentTypesMap 定义，再在此处适配；避免只在本包单侧新增不被上游识别的字段。
- 性能与重渲染控制：
  - 使用 `React.memo` + `isEqual` 做 props 深比较，有利于减少消息列表滚动/刷新时的重复渲染。
  - 新增大型对象（尤其是函数/闭包）作为 props 时，要考虑：
    - 这些 props 是否每次 render 都会产生新引用，从而让 isEqual 频繁失败。
    - 若存在性能问题，可考虑将部分 props 抽象为稳定引用（例如通过 useCallback/useMemo 或从上游 store 中获取）。
- UI 行为约定：
  - `data-testid="bot.ide.chat_area.message_box"` 用于测试与埋点定位消息气泡元素；修改时需同步相关测试代码。
  - 头像显示规则：根据 meta.hideAvatar 决定是否展示，默认为展示（`showUserInfo={!meta.hideAvatar}`）。
  - 背景展示规则：完全由 useChatBackgroundState 控制，组件自身不持久化该状态。
  - theme 固定使用 bizTheme: 'debug'，表明该组件主要运行在 IDE 调试场景；如未来需要区分场景，可在 props 或上游 context 中增加 bizTheme 参数并传给 getReceiveMessageBoxTheme。

## 与外部包的集成关系
- @coze-common/chat-area：
  - 提供聊天域通用能力和类型：ComponentTypesMap、useBotInfoWithSenderId、PluginAsyncQuote、getReceiveMessageBoxTheme。
  - 本包应视其为「协议提供方」，不要在本包中复制或改写这些类型/逻辑；如需新增消息类型或主题规则，应在 chat-area 中实现，再在此处调用。
- @coze-common/chat-uikit：
  - MessageBox 是底层 UI 组件，本包只通过 props 控制其外观和交互，不应在本包中修改其内部行为；若需新增 UI 能力（如新的 footer 区域），建议先在 chat-uikit 中扩展，再在这里通过 props 开启。
- @coze-studio/bot-detail-store：
  - useChatBackgroundState 从 IDE 详情 store 中读取是否启用聊天背景；本包不关心该状态如何产生，只负责读取并传给 MessageBox。
- @coze-arch/bot-api / @coze-arch/bot-typings：
  - 间接决定 message 与 meta 的类型结构；如果这些类型发生变化，本包 ReceiveMessageBox 在编译期会感知，需要针对新字段做适配或移除对旧字段的依赖。

## 开发协作与注意事项（AI 助手）
- 新增/修改组件时：
  - 保持 src/index.ts 作为对外唯一入口；不要让调用方直接 import 深层路径（如 components/receive-message-box），以便未来内部重构不影响外部依赖。
  - 避免在本包中引入新的第三方依赖，除非与整个 frontend monorepo 的依赖策略一致，并在根层确认；本包定位为轻量适配层，应尽量保持单纯。
- 修改现有行为时：
  - 若调整 MessageBox 重要 props（如 messageId、theme、senderInfo、eventCallbacks），要评估对聊天历史加载、回放、调试等场景的影响；可在依赖本包的 IDE 聊天页面进行回归测试。
  - 改动样式类名时，需同步修改 index.module.less 与 TSX 内引用，保持一致。
- 测试与验证：
  - 目前 __tests__ 目录存在但可能用例不多，新增复杂行为时建议补充 React Testing Library + Vitest 用例：
    - 验证 messageId 选择逻辑（远端/本地消息）。
    - 验证 meta.hideAvatar、meta.cardDisabled、isMessageGroupFirstMessage/LastMessage 等对 UI 的影响。
    - 验证 isContentLoading、showBackground 等状态的透传。

## 本子包的特殊点
- 构建脚本为 no-op：`npm run build` 只 exit 0，本包所有实际构建与打包都依赖上层项目（如 apps 或整体 workflow）的构建流程；不要在 CI 中直接依赖本包的 dist 目录。
- 职责非常聚焦：目前仅封装一个 ReceiveMessageBox 组件，所有复杂逻辑（聊天消息结构、插件渲染、主题、背景配置等）都在其他 workspace 包中实现；在扩展时要持续保持「适配层」定位，而不是把聊天域的业务逻辑搬进来。