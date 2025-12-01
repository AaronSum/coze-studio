# Coze Chat Debug Area 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/chat-debug-area）中安全、高效地协作开发。

## 1. 子包定位与全局架构

- 本子包为「Agent IDE 调试面板 - Chat Debug Area」前端 UI/逻辑层，主要用于在 Bot 调试场景中展示和操作调试信息（例如请求/响应详情、工具调用、变量快照等）。
- 职责边界：
  - 负责将通用调试能力（例如来自 `@coze-agent-ide/chat-area-plugin-debug-common`、`@coze-devops/debug/debug-panel` 等）以 IDE 面板形式进行编排和展示；
  - 不直接调用后端接口，大多数数据通过上层 `chat-area` 插件或全局 store 注入；
  - 不管理 Bot 核心业务，只聚焦「调试视角」的信息呈现与交互。
- 在整体架构中的位置：
  - 所属域：Agent IDE / Playground 调试；
  - 与 `@coze-agent-ide/chat-background`、`@coze-agent-ide/chat-area-plugin-debug-common` 等一起，为调试态聊天区域提供增强体验；
  - 通过 Rush 管理，与 monorepo 其他前端包共享统一的 ESLint/Vitest/TsConfig 预设。

## 2. 代码结构与主要模块

> 目录以 `src/` 为主，下面只概述典型模式，具体文件名请直接查看本包源码。

- `src/index.ts(x)`
  - 通常作为对外入口，导出 Chat Debug Area 相关的 React 组件、Hook 或渲染函数；
  - 若需要被外部按需引用（例如在 IDE 容器中挂载 Debug 面板），新增导出应放在此处。
- `src/components/`（或同等结构）
  - 包含调试面板的布局组件，例如：请求列表、当前对话调试详情、变量视图、工具调用轨迹等；
  - 一般以「小颗粒组件 + 容器组件」方式组织：
    - 展示组件只依赖 props，不直接访问全局 store；
    - 容器组件负责从外部 store / 上层 props 取数并组装成展示层所需 props。
- `src/hooks/`
  - 封装与调试逻辑强相关的业务 Hook，例如：
    - useChatDebugStore / useCurrentSessionDebugInfo：获取当前会话的调试数据；
    - useFoldState 等 UI 状态管理 Hook；
  - 需要跨组件共享逻辑时，优先在此处抽取 Hook，而不是在多个组件中复制逻辑。
- `src/store/`（如果存在）
  - 若本子包定义了独立的 Zustand 或其他 store，则位于此处；
  - 通常用于缓存当前选中的调试条目、面板展开/折叠状态等 UI 级状态。
- `config/`
  - TypeScript、ESLint、Vitest 等配置引用 monorepo 公共预设：
    - `tsconfig.json` / `tsconfig.build.json` / `tsconfig.misc.json`；
    - `eslint.config.js` 使用 `@coze-arch/eslint-config` 的 `web` preset；
    - `vitest.config.ts` 通过 `@coze-arch/vitest-config.defineConfig` 设置。
- `__tests__/`
  - 存放 Vitest 测试文件，建议按「组件名 + .test.tsx」或「hook 名 + .test.ts」命名。

## 3. 与其他子包和外部依赖的集成

- 与 Chat Area 调试通用逻辑的分工：
  - `@coze-agent-ide/chat-area-plugin-debug-common`
    - 专注于聊天生命周期级别的调试逻辑（如消息前后处理、打点、Mock header 注入等）；
    - 本子包则在 UI 层消费这些调试信息：例如展示请求/响应内容、任务创建结果等。
- 可能的调试 UI/DevOps 集成：
  - `@coze-devops/debug/debug-panel` 与 DevOps 相关调试面板包：
    - 若本子包嵌入 Debug Panel 组件（如全局调试抽屉或右侧 Panel），需保持 props 结构与其 README 中约定一致；
    - 一般不直接管理调试数据源，而是透传由上层注入的数据与回调。
- 与全局 store 的协作：
  - 典型使用 `@coze-studio/bot-detail-store` 或其他 store 包暴露的 Hook：
    - 例如获取当前调试 Bot、空间信息、多 Agent 状态等；
  - 在本子包内部：
    - 只在容器层调用 store Hook；
    - 展示组件一律通过 props 接收数据，以便测试与复用。
- 与通用 UI 库的集成：
  - 使用 `@coze-arch/coze-design` / `@coze-arch/bot-semi` / `@coze-studio/components` 等统一 UI 组件库；
  - 遵循统一的调色板和 spacing 约定，尽量复用已有组件（例如折叠面板、表格、代码高亮视图）。

## 4. 典型数据流与交互模式

> 这里描述调试面板常见的一条使用链路，实际细节以源码为准。

- 1）上层 Chat 区域收集调试数据：
  - Chat Area 插件在消息发送前后，通过通用调试逻辑收集：请求 payload、响应 body、工具调用列表、扩展字段等信息；
  - 这些信息被写入某个全局 store 或通过 props 传入本子包。
- 2）Chat Debug Area 渲染：
  - 容器组件从 store / props 获取调试数据，按会话、请求或消息粒度做分组；
  - 展示组件负责渲染：
    - 请求/响应列表；
    - 选中项的详情视图（例如 JSON 展示、原始文本、错误栈）；
    - 关联信息（如任务创建状态、多 Agent 切换记录等）。
- 3）用户在 IDE 中交互：
  - 切换不同请求记录、过滤成功/失败、展开/折叠详情等 UI 行为；
  - 若交互会影响上游（例如「重新发送本条请求」），则通过回调通知上层，而不是在本包直接触发网络请求。

## 5. 开发、构建与测试流程

- 依赖与环境：
  - 本包由 Rush + PNPM 管理，位于 monorepo 中：
    - 安装依赖：在仓库根目录执行 `rush update`；
    - 不要在子包目录直接运行 `pnpm install`。
- 常用 npm 脚本（见本包 `package.json`）：
  - `npm run build`
    - 当前多为占位实现（`exit 0`），构建产物由上层 Rsbuild 管理；
    - 若需新增构建逻辑，优先接入仓库统一的构建配置，而不是单独使用 Vite/Webpack。
  - `npm run lint`
    - 使用统一 ESLint preset：`@coze-arch/eslint-config` 的 `web` 配置；
    - 新增代码需保证能够通过 lint。
  - `npm run test`
    - 使用 Vitest 运行单元测试，`vitest.config.ts` 通过 `@coze-arch/vitest-config` 统一设置；
    - 可在 `__tests__/` 目录新增测试用例覆盖关键交互。
  - `npm run test:cov`
    - 在单元测试基础上生成覆盖率报告。

## 6. 项目特有约定与实现注意点

- 职责清晰：
  - 本包聚焦「调试视图和交互」，不承担消息生命周期或网络请求责任；
  - 含有跨会话或跨模块的逻辑（例如多 Agent 状态处理）时，应优先在通用调试/Store 包中实现，当前包只做消费与展示。
- 组件与 Hook 分层：
  - 展示组件：无副作用、不访问全局 store，仅根据 props 渲染；
  - 业务 Hook / 容器组件：可访问 store、绑定事件、组装复杂 props；
  - 新功能开发时，应优先在 Hook 中拼装数据，再交给展示组件，便于测试和复用。
- 类型与接口：
  - 调试数据结构应与通用调试插件和后端约定保持一致；
  - 若新增字段（例如新的 trace id、耗时信息），请先在公共类型定义（通常在其他包）中扩展，而不是只在本包写 `any`。
- 样式与布局：
  - 遵循 monorepo 统一的 CSS Modules + 设计系统类名模式；
  - 避免在本包定义全局样式，尽量使用局部 `.module.less` 与已有 utility 类。

## 7. 分支、发布与协作流程

- 分支与发布：
  - 遵循整个 tinker-studio monorepo 的统一分支与发布策略；
  - 本包本身不维护单独的发布脚本，构建与发布由 CI/CD 统一处理。
- 与其他模块协作建议：
  - 涉及调试流量、埋点或多 Agent 状态等变更时，需要与：
    - 通用调试插件维护者（如 `chat-area-plugin-debug-common`）；
    - 后端调试接口 / 日志平台负责人；
    - 数据指标/埋点负责人；
    - 进行沟通确认字段含义和数据流。

## 8. 如何在本子包中使用 AI 助手

- 适合交给 AI 的任务：
  - 在现有模式下补充新的调试视图组件或小型 UI 交互；
  - 基于现有调试数据结构实现筛选/搜索/排序等纯前端逻辑；
  - 为现有组件或 Hook 编写 Vitest 单元测试。
- 人工需要特别关注的点：
  - 任何涉及后端字段、埋点或多 Agent 状态语义的调整；
  - 跨包类型变更（需要在公共类型/Store 包中修改，而不仅是本包）。
