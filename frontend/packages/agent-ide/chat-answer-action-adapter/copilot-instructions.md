# @coze-agent-ide/chat-answer-action-adapter 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-answer-action-adapter）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包是 Agent IDE Chat 区域的「回答消息操作栏适配器」，为通用聊天区域组件提供 agent-ide 侧的消息底部操作栏实现。
- 入口 [src/index.ts](src/index.ts) 只导出一个组件：`MessageBoxActionBarAdapter`，供上层通过 `@coze-agent-ide/chat-answer-action-adapter` 引用。
- 主要 UI 与逻辑集中在 [src/components/message-box-action-bar/index.tsx](src/components/message-box-action-bar/index.tsx)：
  - 作为 `@coze-common/chat-area` 中 `ComponentTypesMap['messageActionBarFooter']` 的实现，用于定制消息气泡下方的操作栏。
  - 依赖 `@coze-common/chat-answer-action` 提供的具体操作按钮（复制、引用、重试、删除等），自身只负责布局和展示条件。
  - 从 `@coze-studio/bot-detail-store` 读取聊天背景模式，以决定按钮/文本的样式 class。
- 设计原则：本包不直接关心消息发送逻辑、会话状态管理或后端接口，而是作为 UI 适配层，桥接 chat-area 与 answer-action 两个通用子系统。

## 代码结构与关键模块
- [package.json](package.json)
  - `name`: `@coze-agent-ide/chat-answer-action-adapter`，版本 `0.0.1`，license 为 Apache-2.0。
  - `main`: `src/index.ts`，当前构建脚本 `build` 为 `exit 0`，表示实际打包由上层 monorepo 统一处理。
  - 运行脚本：
    - `lint`: `eslint ./ --cache`，规则继承 `@coze-arch/eslint-config`（web preset）。
    - `test`: `vitest --run --passWithNoTests`。
    - `test:cov`: `npm run test -- --coverage`。
- [vitest.config.ts](vitest.config.ts)
  - 使用 `@coze-arch/vitest-config.defineConfig`，`preset: 'web'`，无需额外自定义；新增测试时可直接使用标准 React/Vitest 写法。
- [src/index.ts](src/index.ts)
  - 仅 re-export：`export { MessageBoxActionBarAdapter } from './components/message-box-action-bar';`。
  - 新增对外能力时，需同时在这里导出，并在 `package.json`（如后续添加 `exports`/`typesVersions`）中维护路径。
- [src/components/message-box-action-bar/index.tsx](src/components/message-box-action-bar/index.tsx)
  - 工具常量：`LOG_ID_TIME_PREFIX_DIGITS = 14`；`isQueryWithinOneWeek(logId)` 用于根据 logId 前 14 位（`YYYYMMDDHHmmss`）判断是否在一周内，目前未在组件内部使用，但可能被其他包复用，可视为公共工具。
  - `ActionBarWithMultiActions`：
    - 从 `useMessageBoxContext()` 获取 `message` 与 `meta`：
      - `message.role`、`message.type` 用于区分用户消息还是系统/任务消息。
      - `message.extra_info.time_cost`、`message.extra_info.token` 显示耗时与 Token 消耗。
      - `meta.isFromLatestGroup` 表示是否为最近一组答案（影响操作按钮显示）。
    - 从 `useChatBackgroundState()` 获取：
      - `showBackground`：是否使用「图片背景」模式。
      - `backgroundModeClassName`：用于按钮的样式 class（例如图片模式下改变前景色）。
    - 左侧信息区：
      - 在非触发消息（非 `task_manual_trigger`）且 `time_cost` 非空时显示 `time_cost`s。
      - 对于触发类消息（`type === 'task_manual_trigger'`）用 `UITag` 显示 `platfrom_trigger_dialog_trigge_icon` 文案标签。
      - 若需展示 token，则显示 `<token> Tokens`；当 time_cost 与 token 同时存在，二者之间显示竖向分隔线 `VerticalDivider`。
    - 右侧操作区：
      - 当鼠标 hover、是最近一组答案 (`isLatestGroupAnswer`) 或用户消息 (`isUserMessage`) 时，展示一组操作按钮：
        - `CopyTextMessage`、`QuoteMessage`、`RegenerateMessage`、`DeleteMessage`（均来自 `@coze-common/chat-answer-action`）。
      - 所有按钮复用背景模式 class，用以统一视觉风格。
  - `ActionBarWithTitle`：
    - 用于显示「中间态消息」标题，主要场景为插件、工作流的中间调用状态。
    - 从 `message.extra_info.message_title` 取标题文本，结合背景模式渲染单行描述。
  - `MessageBoxActionBarAdapter`：
    - 类型为 `ComponentTypesMap['messageActionBarFooter']`，即 chat-area 框架中消息底部操作栏插槽的适配器。
    - 入参包含 `refreshContainerWidth`，组件通过 `useEffect` 在挂载时调用一次，确保外层容器宽度计算正确。
    - 判断逻辑：
      - 若 `meta.isGroupLastMessage` 为 true，则渲染 `ActionBarWithMultiActions`（主答案或用户消息底部操作栏）。
      - 否则若存在 `message.extra_info.message_title`，则渲染 `ActionBarWithTitle`，用于插件/工作流中间态。
      - 其余情况返回 `null`，不显示操作栏。
    - 设置 `displayName = 'MessageBoxActionBar'` 便于调试与 React DevTools 展示。

## 依赖与集成关系
- 上游 / 环境依赖（由宿主工程提供）：
  - React 18：通过 peerDependencies 声明（`react`、`react-dom` >= 18.2.0）。
  - 全局聊天上下文：
    - `@coze-common/chat-area`：提供 `useMessageBoxContext` 与 `ComponentTypesMap`，用于接入消息列表和气泡上下文；本包假设被包裹在 chat-area 渲染树中。
    - `@coze-studio/bot-detail-store`：提供 `useChatBackgroundState`，读出当前聊天背景模式与对应样式 class。
  - Answer 操作能力：
    - `@coze-common/chat-answer-action`：封装通用按钮组件 `CopyTextMessage`、`DeleteMessage`、`RegenerateMessage`、`QuoteMessage`，内部已对接具体逻辑（复制、删除、重试等）。本包只负责把这些按钮放到合适的布局位置。
  - 设计系统与基础组件：
    - `@coze-arch/bot-semi`：提供 `Space` 布局组件与 `UITag` 标签组件，风格与 Studio 其他页面保持一致。
    - `@coze-arch/i18n`：`I18n.t(key)` 用于获取文案，例如触发标签文案 `platfrom_trigger_dialog_trigge_icon`。
- 第三方依赖：
  - `dayjs`：仅在 `isQueryWithinOneWeek` 中使用，根据 logId 时间前缀判断是否在一周内；暂未在组件主流程中使用。
  - `ahooks`：`useHover` 用于监听 hover 状态，控制操作按钮显示。
  - `classnames`：用于组合 `className`（背景模式 class 与局部样式 class）。

## 开发与调试工作流
- 初始化与依赖：
  - 在 monorepo 根目录执行：`rush update`（或脚本 `scripts/setup_fe.sh`，以仓库根 README 为准），安装 workspace 依赖。
- 在本子包内常用命令（需在仓库根或通过 Rush 调用）：
  - 代码检查：
    - 子包目录执行：`npm run lint`，或在根目录通过 RushX：`rushx lint --to @coze-agent-ide/chat-answer-action-adapter`（具体命令以 frontend/rushx-config 为准）。
  - 单测：
    - `npm run test`：调用 Vitest，当前没有预置测试文件时也会成功退出。
    - `npm run test:cov`：在此基础上生成覆盖率报告。
  - 构建：
    - `npm run build` 当前为 no-op（`exit 0`），不产生独立构建产物；真实产物由上层应用构建流程统一产出。
- 调试集成方式：
  - 典型使用场景是在 Agent IDE 应用中，chat-area 渲染 `messageActionBarFooter` 插槽时，传入本包的 `MessageBoxActionBarAdapter`：
    - 修改本包后，通过启动上层应用（如 agent-ide app 或 coze-studio）来观察聊天区域底部操作栏的变化。

## 项目约定与编码规范
- 文件与导出：
  - 所有对外导出必须通过 [src/index.ts](src/index.ts) 暴露，避免从内部路径（如 `components/message-box-action-bar`）被消费者直接引用。
  - 若未来在本包新增其他适配组件，应放在 `src/components` 下，并在 index.ts 中统一导出。
- 组件风格：
  - 使用函数式组件与 React Hooks，不使用类组件。
  - 与 monorepo 其它子包一致，统一使用 `@coze-arch/bot-semi`/`@coze-arch/coze-design` 的 UI 组件与设计语言，避免直接操作原生 DOM 写复杂样式。
  - 背景模式样式统一从 `useChatBackgroundState` 读取 `backgroundModeClassName`，不要在本包内部重新计算与主题相关的颜色。
- 文案与 i18n：
  - 所有展示文案应通过 `I18n.t()` 调用现有 key，不在组件中写死字符串；新增文案时需在对应 i18n 包中补充 key，并在这里使用。
- 类型与安全性：
  - 使用 TypeScript 严格类型，组件实现中应假定 `message.extra_info` 字段可能为 `''` 或 `undefined`，通过简单布尔判断后再展示，当前代码已通过 `isEmptyTimeCost`/`isEmptyToken` 显式处理。
  - `meta` 与 `message` 来自 chat-area 上下文，新增依赖字段时需检查上游是否始终存在，以免在某些消息类型下为 `undefined` 导致运行时异常。

## 非常规点与对 AI 助手的提示
- `isQueryWithinOneWeek` 当前在本包中未被组件使用，可能为预留或被其他包按路径引用；若需要删除或调整逻辑，建议先在仓库中全局搜索调用点，确保不破坏外部依赖。
- 由于本包是 adapter 性质，行为边界较清晰：
  - 不要在这里修改消息发送、重试、删除的业务逻辑；相关行为应通过 `@coze-common/chat-answer-action` 或上层 store/service 控制。
  - 可以安全地调整布局（Space 排列、分隔符、hover 行为）或增加/减少展示字段（例如新增额外统计信息），但要注意在非 hover、非最新答案且非用户消息时不应显示操作按钮，以避免 UI 过于拥挤。
- 如果将来需要增加新的操作按钮（如「收藏」「反馈」等）：
  - 优先在 `@coze-common/chat-answer-action` 中新增对应按钮组件与逻辑，然后在本包的 `ActionBarWithMultiActions` 中引入并参与布局，而非在本包直接实现业务逻辑。
