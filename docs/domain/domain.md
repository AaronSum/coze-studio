# 领域知识：Agent IDE / Bot Studio（Coze Studio 前端子系统）

## 1. 文档目的与阅读建议

- 适用对象：前端开发者、架构师、产品与运维同学、以及新加入的贡献者，需要快速理解 Agent IDE / Bot Studio 的领域模型与代码归属。
- 阅读前提：熟悉 TypeScript + React、monorepo（Rush/pnpm）、基本的 Bot/Agent 与 LLM 概念。
- 阅读完你应该能够：
  - 理解系统职责边界与关键子系统；
  - 定位实现某项功能的包与目录（如模型配置、对话 UI、工作流、插件、变现、隐私）；
  - 理解主要业务流程、规则与常见陷阱，便于快速开发与审查变更。

## 2. 领域背景与业务目标

### 2.1 背景

Coze Studio 提供一个面向 Bot/Agent 的 IDE 与管理中台，支持 Bot 创建、模型配置、插件扩展、工作流编排、知识接入、对话运行与变现策略。
项目使用 Rush monorepo 管理（参见仓库根 `rush.json`），前端子包数量众多（本仓库扫描到 259 个 frontend 项目），通过大量 `*-adapter` / `*-shared` 包实现分层解耦与跨团队协作。

### 2.2 业务痛点

- 概念与实现分散导致学习曲线陡峭；
- 前端 store（草稿）与后端持久化需保证一致性；
- 插件/适配器体系需要稳定接口以支持多变的集成场景；
- 隐私与变现能力在 UI、Store 与后端间需要连贯的校验与反馈。

### 2.3 系统目标与非目标

- 目标：提供可扩展、模块化的 Agent IDE 前端平台，支持快速组合 Bot 能力与合规的发布流程。
- 非目标：不实现或维护模型推理后端（推理由后端服务承担）。

## 3. 核心领域概念（Glossary）

> 本节列出在代码与业务讨论中经常出现的核心概念、定义与代码映射，便于开发者建立一一对应的认知。

- **Bot / Agent**

  - 定义：面向最终用户的对话实体，包含模型配置、插件、权限与运行上下文。
  - 使用场景：创建/编辑/发布 Bot、运行对话、管理变现/隐私策略。
  - 代码映射：`frontend/packages/agent-ide/entry`、`frontend/packages/agent-ide/space-bot`、`frontend/packages/studio/stores/bot-detail`、`frontend/packages/agent-ide/bot-creator`。

- **Model（模型配置）**

  - 定义：描述 Bot 使用的 LLM 类型与运行参数（history、temperature、token 限制等）。
  - 使用场景：`ModelConfigView`、`SingleAgentModelView` 中的配置界面；影响对话上下文拼装。
  - 代码映射：`frontend/packages/agent-ide/model-manager`、`frontend/packages/agent-ide/bot-config-area`、`frontend/packages/arch/bot-typings`。

- **Workflow（工作流）**

  - 定义：以节点和变量串联的可执行编排，用于多步骤任务或复杂的对话控制流。
  - 使用场景：工作流编辑器、节点库、执行/调试。
  - 代码映射：`frontend/packages/workflow/*`（`nodes`、`render`、`playground`、`sdk` 等）。

- **Plugin（插件）**

  - 定义：可插拔的能力模块（审计、风险告警、mock、工具链等）。
  - 使用场景：在 Bot 或 IDE 中安装/启用以扩展能力。
  - 代码映射：`frontend/packages/agent-ide/bot-plugin/*`、`frontend/packages/studio/plugin-*`、`frontend/packages/studio/stores/bot-plugin`。

- **Store（状态管理）**

  - 定义：前端状态容器（主要使用 `zustand`），保存 UI 状态、草稿与缓存。
  - 使用场景：`bot-detail-store`、`model-store`、`monetize-store` 等。
  - 代码映射：`frontend/packages/studio/stores/*`、`frontend/packages/foundation/*-store`。

- **Monetization（变现）**

  - 定义：Bot 的付费/免费策略（是否开启、免费对话额度、刷新周期）。
  - 使用场景：`MonetizeConfigPanel` 编辑并通过后端接口保存草稿。
  - 代码映射：`frontend/packages/agent-ide/bot-config-area/src/monetize-config`、`frontend/packages/arch/bot-space-api`。

- **Query Collect（查询收集 / 隐私）**
  - 定义：是否收集用户查询与隐私政策链接的管理逻辑。
  - 使用场景：`QueryCollect` Modal 中的启用/生成/校验流程。
  - 代码映射：`frontend/packages/agent-ide/bot-config-area/src/query-collect`。

## 4. 领域边界与上下游关系

### 4.1 系统边界（负责 / 不负责）

- 负责：Bot 的 UI 管理、编辑器/工作流/插件的前端呈现、通过封装层与后端 API 交互（例如 `@coze-arch/bot-api`、`@coze-arch/bot-http`）。
- 不负责：模型推理、后端数据持久化策略、平台级资源调度。

### 4.2 上下游系统与交互

- 上游依赖：后端服务（认证、Bot 管理、空间/权限、计费/benefit 服务）。
- 下游影响：发布的 Bot 被 runtime/后端用于实际对话；插件可能与审计/监控系统对接。

## 5. 关键业务流程

### 5.1 创建并发布 Bot（高层流程）

1. 在 IDE 创建 Bot（表单提交到后端创建资源）。
2. 配置模型与对话策略（`ModelConfigView` / `DialogueConfigView`）。
3. 配置插件、变现、隐私；进行本地草稿保存（store）。
4. 调用发布 API 完成发布，后端负责部署/索引该 Bot 到运行环境。

### 5.2 对话执行与记忆管理（前端视角）

1. 前端通过 HTTP / WebSocket 将用户输入发送到后端对话服务（`websocket-manager-adapter` / `bot-api`）。
2. 后端返回模型输出；前端在 `chat-area` 中渲染结果。
3. 若启用检索/插件，前端或后端会在调用前进行知识检索并拼接上下文。
4. 记忆策略（ShortMemPolicy / history round）由模型配置驱动，影响发送给模型的上下文轮数。

## 6. 领域规则与不变式

### 6.1 针对对象的规则

- `botId` 一经创建不可变，所有对 bot 的配置变更应以相同 `botId` 为标识并进行草稿管理。
- 模型类型切换应提示用户潜在的会话不兼容或上下文丢失风险。

### 6.2 针对场景的规则

- 隐私策略 URL 由前端以 `https://` 规范化并调用后端校验；若后端返回校验不通过，应在 UI 层展示 `privacyErrMsg` 并阻止入库。
- 变现配置更新应通过 debounce（300ms 合并）以减少 API 负载并避免竞态。

## 7. 领域模型与代码结构映射

- 概念 → 代表包（示例）

  - Bot 管理：`frontend/packages/studio/stores/bot-detail`、`frontend/packages/agent-ide/space-bot`、`frontend/packages/agent-ide/entry`。
  - 模型配置视图：`frontend/packages/agent-ide/model-manager`、`frontend/packages/agent-ide/bot-config-area`。
  - 对话 UI：`frontend/packages/common/chat-area`、`frontend/packages/common/chat-area/chat-uikit`、`frontend/packages/studio/components`。
  - Workflow：`frontend/packages/workflow/*`（`nodes`、`render`、`playground`、`sdk`）。
  - 插件：`frontend/packages/agent-ide/bot-plugin/*`、`frontend/packages/studio/plugin-*`。

- 推荐的读代码路径（入门顺序）
  1. [frontend/packages/agent-ide/entry](frontend/packages/agent-ide/entry) → 平台入口与整体布局。
  2. [frontend/packages/agent-ide/commons](frontend/packages/agent-ide/commons) → 公共工具与布局组件。
  3. [frontend/packages/agent-ide/bot-config-area](frontend/packages/agent-ide/bot-config-area) → 模型/变现/隐私配置的典型实现。
  4. [frontend/packages/common/chat-area](frontend/packages/common/chat-area) → 对话渲染与交互逻辑。
  5. [frontend/packages/workflow/playground](frontend/packages/workflow/playground) → 工作流编辑与运行示例。

## 8. 典型场景示例

- 场景：开启 Bot 变现并设置免费额度

  - 入口：`MonetizeConfigButton` → `MonetizeConfigPanel`。
  - 关键逻辑：读取 `useMonetizeConfigStore`，更新本地状态，并通过 `debouncedSaveBotConfig` 调用 `benefitApi.PublicSaveBotDraftMonetizationConfig`。

- 场景：配置隐私策略并生成链接
  - 入口：`QueryCollect` Modal。
  - 关键逻辑：勾选收集后输入 hostname/path 或使用模板生成，前端校验并调用 `updateQueryCollect`，后端返回校验结果并设置 `privacyErrMsg`。

## 9. 版本演进与历史包袱

- 里程碑：从单体前端到 Rush monorepo；引入大量 `*-adapter` 与 `*-shared` 用于解耦与兼容；引入 `workflow` 子系统以支持复杂编排。
- Legacy 说明：若遇到重复实现或命名差异，优先查找 adapter/adapter-adapter 层以确定最新实现与调用路径。

## 10. 常见误解 & FAQ

- Q：前端 store 是最终数据源吗？

  - A：否，前端 store 保存 UI 草稿与缓存，最终持久化由后端负责。

- Q：Workflow 就是普通聊天吗？
  - A：不是，Workflow 用于节点/任务编排，普通聊天是基于上下文的对话流。

## 11. 后续维护与贡献指南

- 如何补充新概念：在本文件中新增条目并标注对应包路径和典型调用路径；新增包后请在 `rush.json` 中注册并在文档中补充映射。
- 如何更新规则变更：修改 UI 校验或业务规则时，务必同时更新对应 `store`、后端 API 约定并添加变更说明。
- 建议的贡献步骤：
  1. 在仓库根执行 `rush update` 同步依赖；
  2. 在对应包内修改并本地运行子包测试（`npm test` 或 `vitest`）；
  3. 若新增跨包类型，更新 `tsconfig.build.json` references；
  4. 添加/更新 `data-testid` 以便 E2E 测试；
  5. 提交 PR 并在描述中说明影响范围与迁移步骤（如有）。
