# @coze-common/chat-area-plugin-resume 开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/chat-area/plugin-resume）中安全、高效地协作开发。

## 全局架构与职责

- 本包是 chat area 插件体系中的“中断续聊（resume）”插件，实现为一个可写插件，挂载在通用聊天 UI 容器上。
- 核心入口：
  - [src/plugin.ts](src/plugin.ts)：定义 `ResumePlugin`，继承 `WriteableChatAreaPlugin`，声明 `pluginMode = PluginMode.Writeable`、`pluginName = PluginName.Resume`，并组合消息/渲染两个生命周期服务。
  - [src/index.tsx](src/index.tsx)：导出 `ResumePluginRegistry`，满足 `PluginRegistryEntry` 协议，被上层如 `@coze-agent-ide/chat-area-provider-adapter` 以 `ResumePluginRegistry` 注册到 `pluginRegistryList` 中。
- 生命周期服务：
  - [src/life-cycle-service/message-life-cycle-service.ts](src/life-cycle-service/message-life-cycle-service.ts)：围绕消息流转（如插入、标记 resume 信息等）提供 hook，通常通过覆写父类接口与 chat-area 核心交互。
  - [src/life-cycle-service/render-life-cycle-service.ts](src/life-cycle-service/render-life-cycle-service.ts)：围绕消息渲染阶段（如插入 Resume Banner、浮层、快捷操作等）提供 UI 相关逻辑。
- UI 与交互：
  - [src/custom-components](src/custom-components)：封装 resume 相关的独立 React 组件（例如中断提示条、继续对话按钮等），供 render-life-cycle-service 挂载。
  - [src/hooks](src/hooks)：存放与 resume 场景相关的 React hooks（如定位插入位置、状态管理等）。
- 依赖关系：
  - 强依赖 `@coze-common/chat-area` / `@coze-common/chat-uikit` 提供的消息模型、插件协议和 UI 基座。
  - 与其他插件并列被注入，例如 debug、reasoning、grab、chat-background 等，整体由上层 `BotDebugChatAreaProvider` 统一调度。

## 关键数据流与交互

- 插件注册流程：
  - 本包暴露的 `ResumePluginRegistry` 被 [frontend/packages/agent-ide/chat-area-provider-adapter/src/provider/index.tsx](../agent-ide/chat-area-provider-adapter/src/provider/index.tsx) 以 `ResumePluginRegistry` 的形式加入 `pluginRegistryList`。
  - chat-area provider 启动时会遍历 `pluginRegistryList`，实例化每个 registry 的 `Plugin`，并在合适的生命周期调用其 service。
- 消息级数据流：
  - 上游通过 `requestToInit` 向后端拉取历史消息和会话信息，然后交给 chat-area 核心进行渲染。
  - Resume 插件通过 `ResumeMessageLifeCycleService` 对消息列表做增删改标记，例如：
    - 识别“中断点”消息（例如通过消息字段或自定义 tag）。
    - 在 resume 时注入系统提示、分隔符或额外 metadata。
- 渲染级数据流：
  - `ResumeRenderLifeCycleService` 在渲染阶段对某些消息节点或整体消息列表进行增强，例如：
    - 在最近的中断位置上方插入一个“继续对话” UI 组件。
    - 根据当前视口位置或用户操作，展示/隐藏 resume 相关浮层。

## 开发与运行流程

- 包定位：本子包根目录为 `frontend/packages/common/chat-area/plugin-resume`，遵循 Rush monorepo 管理。
- 依赖安装：
  - 在 monorepo 根目录执行：`rush update`（见 [README.md](README.md)）。
- 常用命令（在本包目录执行）：
  - 构建：`npm run build`（当前实现为占位 `exit 0`，仅用于通过 pipeline，不产生实际产物）。
  - Lint：`npm run lint` 使用 `eslint`，配置来自 [eslint.config.js](eslint.config.js) 和 `@coze-arch/eslint-config`，preset 为 `web`。
  - 单测：`npm run test` 使用 `vitest`，配置在 [vitest.config.ts](vitest.config.ts)，通过 `@coze-arch/vitest-config` 统一化 web 预设。
  - 覆盖率：`npm run test:cov`。
- Storybook/文档：
  - [stories](stories) 和 [.storybook](.storybook) 存放调试和演示用 story；如需新增 UI 能力，优先补 story 以便本地可视化联调。

## 代码风格与约定

- 语言与框架：React 18 + TypeScript，使用 tsconfig web 预设（见 [tsconfig.json](tsconfig.json)、[tsconfig.build.json](tsconfig.build.json)）。
- 插件协议约定：
  - 插件类继承 `WriteableChatAreaPlugin<TBizContext>`，并通过 `pluginMode` / `pluginName` 明确自身类型和枚举名称。
  - 对外导出一个 `PluginRegistryEntry` 对象（本包为 `ResumePluginRegistry`），包含：
    - `createPluginBizContext`：用于生成插件级业务上下文；当前未使用，返回 `undefined`，如需在 resume 插件中存放额外 state，请在此集中构造。
    - `Plugin`：插件类本身。
- 生命周期服务拆分：
  - 将“消息逻辑（message）”与“渲染逻辑（render）”解耦为两个 service 文件，便于分别演进，避免巨型类：
    - message-life-cycle-service 处理数据/状态、与后端字段约束相关逻辑。
    - render-life-cycle-service 处理 DOM/React 组件和滚动/布局等 UI 问题。
- 状态管理：
  - 全局状态优先复用上游 chat-area 提供的 store；在本包中，如需插件内部局部状态，可使用 `zustand` 或 React 内部 state，但要避免与全局 store 重复。
- 命名与文件结构：
  - 插件名严格与枚举 `PluginName.Resume` 对齐；如扩展新子功能，保持 `resume-*` 前缀。
  - hooks 以 `use-*.ts(x)` 命名，放在 [src/hooks](src/hooks) 下；可根据业务拆子目录（如 `interrupt-message`）。

## 与外部包的集成细节

- `@coze-common/chat-area`：
  - 提供 `WriteableChatAreaPlugin`、`PluginMode`、`PluginName`、`PluginRegistryEntry` 等核心类型。
  - 插件通过 `lifeCycleServices` 与 chat-area 通知机制交互（如 before/after render/message 事件）。
- `@coze-common/chat-uikit`：
  - 提供基础聊天 UI 组件（消息气泡、列表容器等）；render-life-cycle-service 中的自定义组件通常嵌入在这些容器中。
- `@coze-arch/bot-semi` / `@coze-arch/coze-design`：
  - 提供设计体系与 UI 库；本插件 UI 组件应使用这些组件库，保持与整体产品视觉一致。
- 与其他聊天插件的协作：
  - Resume 插件会与 debug、reasoning、grab、chat-background 等插件共同注册到 provider：
    - 注意不要修改全局消息结构（如删除字段），而应通过扩展字段或 metadata 进行增强。
    - 避免在滚动、消息排序上与其他插件产生冲突，渲染调整应尽量局部、可组合。

## 项目流程与协作规范

- 版本与依赖：
  - 本包遵循 monorepo 统一管理，`dependencies` 中大量为 `workspace:*`，升级这些依赖时需同时兼顾其他子包兼容性。
- 分支与提交（从仓库整体惯例推断）：
  - 遵循标准 Git 工作流：在 feature 分支开发，提交前运行本包的 `lint` 与 `test` 确保无错误。
  - 变更 resume 插件生命周期/对外行为时，建议在相关上层包（如 `chat-area-provider-adapter`）补充集成测试或故事，用于验证多插件协同场景。
- 发布与集成：
  - 本包不会单独发布到外部 npm，而是作为 Rush workspace 包被应用（`version` 以 0.x 开头）。
  - 与业务 API、场景（如 Playground 调试场景）强绑定，修改 resume 插件行为前需理解后端消息结构及上游场景约束。

## 不寻常 / 需注意的点

- `build` 脚本目前是 no-op（`exit 0`）：
  - 构建产物依托于上层构建链路（如 app 级 rsbuild/vite 等），本包仅提供源码与类型，不在自身目录内产出 bundle。
- `createPluginBizContext` 目前未使用：
  - 这是为未来扩展保留的扩展点，AI 辅助开发时如需新增业务上下文，优先在此集中注入，而非随意在插件类上增添散乱字段。
- Storybook 与测试目录可能相对空：
  - 这反映当前实现仍在早期阶段；在扩展 UI 功能时，优先补充 story / vitest + RTL 测试，以避免回归影响到 debug/Playground 场景。
