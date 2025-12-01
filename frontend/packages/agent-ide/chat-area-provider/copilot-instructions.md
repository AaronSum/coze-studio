# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-area-provider）中安全、高效地协作开发。

## 全局架构概览

- 本包对应 npm 包 `@coze-agent-ide/chat-area-provider`，主要职责是为 Agent IDE 提供「聊天区域（Chat Area）」相关的 Provider 能力。
- 核心依赖包括：
  - `@coze-common/chat-area`：通用聊天区域 UI 与数据结构；
  - `@coze-common/chat-core`：聊天消息、会话、发送流程等核心逻辑；
  - `@coze-common/chat-area-plugin-chat-background`：聊天背景相关插件能力；
  - `@coze-arch/bot-hooks`、`@coze-arch/bot-studio-store`、`@coze-arch/bot-utils`、`@coze-arch/logger` 等：Studio 侧 hooks、全局状态与日志工具；
  - `@coze-studio/bot-detail-store`：Bot 详情及上下文状态。
- 典型数据/控制流（供推理时参考）：
  - Agent IDE 宿主页面 → 通过本包导出的 Provider 把「当前 Bot/会话/空间/用户」上下文注入到通用聊天区域；
  - 聊天区域内部通过 `@coze-common/chat-core` 完成消息加载、发送与状态更新；
  - Provider 负责把 IDE 的状态（例如当前选中的 Bot、当前工程）与 chat-core 需要的参数映射/同步。

> 注意：本文件只描述协作约定与宏观结构，不替代源码阅读。进行非机械性变更前，请配合实际源码确认具体行为。

## 关键开发工作流

- 包管理与构建：
  - 本包是前端 monorepo 的 workspace 子包，依赖通过 Rush/PNPM 统一管理。
  - `package.json` 中脚本：
    - `build`: 当前实现为 `exit 0`，表示 **不在此包内执行单独构建**，真实打包由上层应用/编译管线完成；
    - `lint`: `eslint ./ --cache`，使用 `@coze-arch/eslint-config` 的 `web` 预设；
    - `test`: `vitest --run --passWithNoTests`；
    - `test:cov`: 在 `test` 基础上添加 `--coverage` 统计。
  - 日常开发推荐在仓库根目录使用 Rush 脚本（如 `rushx lint`、`rushx test` 等），仅在需要局部验证时才在本目录直接运行 npm/pnpm 脚本。

- TypeScript/测试配置（习惯模式）：
  - `tsconfig.json` + `tsconfig.build.json` + `tsconfig.misc.json` 组合使用：
    - `tsconfig.build.json` 继承 `@coze-arch/ts-config/tsconfig.web.json`，以 `src` 为 `rootDir`，`dist` 为编译输出目录，并开启 `composite` 支持；
    - `tsconfig.misc.json` 通常覆盖测试、配置文件等非产出代码的 TS 行为；
    - Vitest 配置在 `vitest.config.ts`，经由 `@coze-arch/vitest-config` 统一管理，`preset: 'web'`。

## 项目特有约定与模式

- 职责边界：
  - 本包重点在「把 Agent IDE 环境中的上下文、状态和事件，适配到通用聊天区域能力」——不要在这里重新实现消息发送/会话管理等底层逻辑；
  - 与通用聊天能力交互时应优先使用 `@coze-common/chat-area` / `@coze-common/chat-core` 提供的 hooks、组件和类型，而不是复制内部实现。

- Provider/Hook 约定（推定模式）：
  - 典型模式是导出一个 `ChatAreaProvider` 组件及若干 hook（例如 `useChatAreaProps` 之类），将 IDE 内部的 store（`@coze-arch/bot-studio-store`、`@coze-studio/bot-detail-store` 等）中的 state 映射到 chat-area 所需的 props；
  - 新增/调整行为时，应：
    - 优先在 **映射层** 处理「Agent IDE 概念 → Chat 概念」的转换；
    - 避免在 Provider 内直接做复杂业务分支，尽量拆出专门的 util/hook（例如 `useCurrentBotChatConfig`）。

- 状态与副作用：
  - 跨页面/跨组件共享状态（例如当前 Bot、当前空间、用户信息）应通过已有 store：
    - `@coze-arch/bot-studio-store`；
    - `@coze-studio/bot-detail-store`；
  - Provider 内应只做「读取 + 订阅 + 映射」，不要在这里引入新的全局 store；
  - 需要副作用（例如初次加载会话、监听 IDE 中 tab 切换触发清空消息）时，优先用 React hooks（`useEffect`）配合已有 store/hook，而非在模块初始化阶段执行逻辑。

- 日志与错误：
  - 使用 `@coze-arch/logger` 创建局部 logger（例如带 `namespace: 'agent-ide-chat-area'`）；
  - 对于无法恢复的错误，记录日志后应交给宿主（IDE 页面）决定如何展现（toast、error boundary 等），不要在 Provider 内直接 `alert` 或操作 DOM。

## 与其它模块/依赖的集成要点

- `@coze-common/chat-area` / `@coze-common/chat-core`：
  - 这是聊天能力的核心来源；当需要：
    - 新增聊天 UI 行为（比如额外的顶部栏按钮）——优先在 chat-area 中查找是否已有扩展点，若需 Agent IDE 特有行为，可以通过 props/slot 提供，而不是直接修改 chat-core 内部逻辑；
    - 变更消息/会话结构——确认 chat-core 定义的类型后，再在本包做映射层适配。

- `@coze-arch/bot-hooks` / `@coze-arch/bot-utils`：
  - 用于访问 Studio 通用 hooks（用户、空间、工程等）与通用工具；
  - 新增逻辑时，尽量通过这些已有 hooks/工具访问环境信息，不要在本包重新读取 URL/query/localStorage。

- `@coze-arch/bot-studio-store` / `@coze-studio/bot-detail-store`：
  - 提供 Bot/工程/空间相关的全局状态；
  - Provider 通常会从这些 store 中获取当前的 Bot 信息、空间 id 等，并注入到 chat-core 所需的上下文对象；
  - 修改/增加状态依赖前，需确认：
    - 该字段是否在相关 store 中已存在；
    - 是否会与其它模块共用（避免引入新的重复字段）。

- `classnames`：
  - 用于组合 CSS class；若本包有本地样式（`*.module.less`），保持用 `classnames` 做组合，避免直接字符串拼接，统一风格。

## 开发流程与协作规范

- 修改步骤建议：
  1. 在源码中定位实际导出的入口（通常是 `src/index.ts`），弄清楚对外暴露了哪些组件/hook/类型；
  2. 沿调用链向下阅读 Provider 实现，搞清楚它从哪些 store/hooks 读数据，向下游 chat-area 提供了什么；
  3. 若要改动行为，优先在映射/工具函数中扩展逻辑，保证 Provider 对外签名尽量稳定；
  4. 如涉及类型变更，先在类型定义位置更新，再逐个修复编译错误，避免在组件内“临时 any”。

- 提交前检查：
  - 通过 `npm run lint` 保证 ESLint 通过；
  - 如新增了逻辑分支或条件，建议在 `__tests__` 中补充对应单测（Vitest），尽量覆盖：
    - Provider 对关键上下文（空间/Bot/工程）的读取与 fallback；
    - 与 chat-core 的关键参数映射（例如 chat 会话 id、用户 id）。

## 本包的特殊点与注意事项

- 构建脚本为 no-op：
  - `npm run build` 不会产生独立构建结果，真实打包由上层工程完成；
  - 不要在本子包引入 webpack/vite 独立打包脚本，以免破坏 monorepo 一致性。

- 强依赖「通用聊天域」：
  - 本包只是 Agent IDE 与聊天域之间的一层薄封装；当你发现需要改动大量聊天行为时，很可能应该前往 `@coze-common/chat-area` / `@coze-common/chat-core` 对应子包去实现，然后在本包做轻量接入。

- 工作流/Studio 一致性：
  - Agent IDE 通常与 Studio 其它区域共享同一个用户/空间/Bot 概念；在本包中新增行为（例如自动切换会话、自动插入某类消息）时，要考虑是否会影响用户对其它页面体验的一致认知。

## 对 AI 编程助手的具体建议

- 在本包进行修改时优先遵守：
  - **不重复造轮子**：涉及聊天逻辑，先去查找 `@coze-common/chat-*` 是否已有实现；
  - **尊重 Provider 边界**：只做「上下文适配」，不要在这里添加完整业务流程；
  - **避免新全局状态**：尽量复用 `@coze-arch/bot-studio-store`、`@coze-studio/bot-detail-store` 等既有 store；
  - **接口尽量向后兼容**：调整导出的组件/方法参数时，先全局搜索引用点，评估影响并考虑通过新增可选参数实现需求。

- 不确定时的处理顺序：
  1. 阅读本包导出的类型/组件签名；
  2. 查找上下游依赖（Agent IDE 宿主、通用聊天包）；
  3. 尽量在小范围内添加 hook/util 解决问题；
  4. 仅在确认没有其它合理扩展点时，才考虑调整公共 API。