# @coze-project-ide/client 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/client）中安全、高效地协作开发。

## 全局架构概览
- 本包提供 Project IDE 在浏览器中的「客户端集成层」，主要负责把 core 运行时封装到具体前端应用中（TIP/IDE 页等），对外暴露统一入口：通常为 [src/index.ts](frontend/packages/project-ide/client/src/index.ts) 或同级聚合导出文件。
- 典型结构（以当前仓库约定推断，实际请结合 src 目录确认）：
  - api/：封装与后端（tinker-studio backend）交互的 HTTP/WebSocket 客户端，复用仓库统一的请求封装。
  - env/ 或 config/：环境探测（本地/云端）、多租户/工作区 ID、路由前缀等运行时配置适配。
  - ide/ 或 app/：集成 core 包提供的 Application/IDEProvider，拼装具体「项目 IDE」应用 Shell。
  - hooks/、components/：基于 core renderer 和服务的 React Hook + UI 组件封装，对上层应用暴露更易用的接口。
- 设计理念：
  - 将「无 UI 的 IDE 运行时」(@coze-project-ide/core) 与「具体产品形态」(client) 解耦：core 只关注服务/插件体系，client 负责把这些能力绑定到实际业务（项目、工作区、后端 API）。
  - client 避免自行实现通用基础能力（事件、DI、资源、命令等），而是引用 core/common 与 monorepo 公共包，在此基础上组合特定场景逻辑。

## 代码结构与主要文件
- 根级配置
  - [package.json](frontend/packages/project-ide/client/package.json)：定义本包名称 `@coze-project-ide/client`、依赖 core/infra/config 等包，以及构建、测试、Lint 脚本；通常由 tsup/vite/rollup 输出浏览器可用的 bundle 或 ESM。
  - tsconfig.*：继承 frontend 统一 tsconfig，声明 src 为根目录、输出目录（如 lib-ts 或 dist）以及对其他子包的 references。
  - vite.config.ts / webpack.config.ts（若存在）：定义开发/预览环境（dev server、别名 alias、proxy 到 backend 等）。
- 源码目录（以 src/ 为例）
  - [src/index.ts](frontend/packages/project-ide/client/src/index.ts)：聚合导出本包对外 API，如：创建 IDE 实例的工厂函数、用于嵌入到业务页面的 React 组件等，是理解本包能力的入口。
  - src/ide/*：
    - 负责把 core 的 Application / IDEProvider 与具体业务场景绑定，例如：创建包含文件树、编辑器、终端等面板的 ProjectIDE 组件。
    - 可能定义 `createProjectIDE()` 或类似工厂，用于在任意 React 树中挂载 IDE。
  - src/api/*：
    - 封装项目/文件/会话等资源的后端接口调用，通常使用 monorepo 的统一 http client。
    - 与 core 的 ResourceService、ConversationService 等进行适配（例如通过自定义 ResourceHandler 调用后端保存文档）。
  - src/hooks/*：
    - 基于 core renderer 的 `useIDEService` / `useNavigation` 等 Hook，封装更上层的业务 Hook，如 `useCurrentProject()`, `useWorkspace()` 等。
  - src/components/*：
    - 提供可复用的 UI 组件，例如 ProjectIDE 容器、工具栏、状态栏、项目切换器等；内部主要依赖 core 的服务与 client 自己的 api/hook。

## 构建、测试与调试流程
- 构建
  - 推荐通过 Rush 在 monorepo 根目录统一构建：
    - `rush build -t @coze-project-ide/client`：构建本包及其依赖。
  - 子包单独构建（在 frontend/packages/project-ide/client 目录）：
    - `npm run build` 或 `npm run build:fast`（具体以 package.json 为准），通常使用 tsup/vite 将 src 编译为 ESM/CJS 包或浏览器 bundle。
    - 若存在 `npm run build:watch` / `npm run dev`：用于本地开发 watch / 启动开发服务器，可在浏览器直接访问嵌入 IDE 的 Demo 页面。
- 类型检查 & Lint
  - `npm run ts-check`（若定义）：调用 `tsc --noEmit` 并使用 tsconfig.build.json，对 src 进行严格类型检查。
  - `npm run lint`：使用 monorepo 统一 ESLint 配置（如 @coze-arch/eslint-config），约束 import 顺序、风格规则等。
- 测试
  - 若存在 [vitest.config.ts](frontend/packages/project-ide/client/vitest.config.ts)：
    - 通常使用 jsdom 环境以支持 React/DOM 单测；include 模式为 `**/?(*.){test,spec}.?(c|m)[jt]s?(x)`。
    - 建议在与实现同目录创建 *.spec.ts / *.test.ts 文件，覆盖关键 Hook/组件的行为。
  - 可以通过 Rush 统一运行：
    - `rushx test --from @coze-project-ide/client`（若在 monorepo 中配置对应 rushx 命令）。
- 调试
  - 若存在开发服务器脚本（如 `npm run dev`）：
    - 在 client 包目录执行后，通过浏览器访问本地 URL（通常是 http://localhost:xxxx）进行交互调试。
  - 对于与 core 交互的问题，建议同时打开 core 包源码，追踪 Application/Service 的调用链。

## 项目约定与代码风格
- 语言与运行环境
  - 使用 TypeScript + React（web 端），与 core 包保持一致的严格类型配置（开启 strictNullChecks）。
  - 不直接在 client 中引入 Node 专用 API，确保代码可以在浏览器环境运行；后端交互通过统一 http client/SDK 完成。
- 模块边界
  - 业务无关的 IDE能力（命令、资源、导航、样式等）由 @coze-project-ide/core 提供；client 主要负责：
    - 将这些能力映射到「项目」这一具体领域（如项目文件、运行日志、构建结果等）。
    - 管理与后端 tinker-studio 的交互（包括鉴权、工作区/项目上下文等）。
  - 避免在 client 中重新实现 core 已有的抽象（如 Resource/URI/Label/Command 等）；若需要扩展，应通过插件或服务扩展点实现。
- React 集成
  - 遵循 core renderer 约定：
    - 顶层使用 IDEProvider 包裹 React 组件树，传入经过容器配置的 IDEContainer。
    - 组件内部使用 `useIDEContainer` / `useIDEService` / `useNavigation` 等 Hook 访问服务，而不是直接 new Service 或创建新的容器实例。
  - 新增业务 Hook 时，优先调用 core/common 提供的服务 API，不要在 Hook 内部绕过服务直接访问底层实现。

## 重要集成与外部依赖
- 与 @coze-project-ide/core 的集成
  - client 强依赖 core：
    - 使用 core 的 Application / IDEContainerModule 初始化容器，装配命令、资源、导航、样式等插件。
    - 通过 core 的 ResourceService/CommandService 等，将具体业务（项目打开/保存、运行命令）映射为资源和命令。
  - 若需要新增 IDE 能力，通常步骤是：
    - 在 core 中增加对应插件/服务；
    - 在 client 中通过 Application 配置和 React 组件接入这些能力。
- 与 tinker-studio backend 的交互
  - 通过 monorepo 提供的统一 http client（位于 frontend/infra 或 apps 级别），封装成 api/* 模块：
    - 如 `getProjectDetail`、`listProjectFiles`、`saveFileContent` 等。
  - 在适配层将这些接口与 core 的 ResourceService / KnowledgeService / ConversationService 等服务对接。
- 其他典型依赖
  - UI 组件库：可能依赖内部 design system（如 @coze/ui 或内部组件包），用于实现 ProjectIDE 的视觉框架；在修改 UI 行为时需遵守该组件库的用法和设计约束。
  - 路由/状态管理：若存在 React Router/Zustand/Recoil 等，只用于 client 层路由与全局状态，不应侵入 core 的容器与服务体系。

## 开发流程与协作规范
- 分支与提交
  - 遵循 monorepo 统一的 Git 流程：
    - 一般通过 feature/xxx 或 fix/xxx 分支进行开发，完成后提交 PR 合入主干。
    - 提交信息和 PR 描述应明确指出影响的子包（包括 @coze-project-ide/client 与可能涉及的 core、apps）。
- 与其他子包协作
  - 修改 client 同时涉及 core / apps 时：
    - 优先在 core 中补充通用能力（Plugin/Service/Contribution），再在 client 中做最薄的一层对接；
    - 避免在多个子包中复制同样的逻辑，保证 IDE 行为的一致性。
  - 若引入新外部依赖，需遵守 Rush + PNPM 管理方式：
    - 在 monorepo 根目录维护 rush.json / common/config
    - 按现有包的做法声明依赖范围（dependencies/devDependencies/peerDependencies）。

## 非常规或需要特别注意的点
- core vs client 职责划分
  - core 是「无 UI 的 IDE 内核」，client 是「与具体产品耦合的 IDE 容器与集成层」。
  - 当你想新增某个通用 IDE 能力（例如：新的导航模式、通用的资源类型）时：
    - 先考虑是否应在 core 中实现，然后在 client 中仅通过组装与配置接入；
    - 不要直接在 client 中写死逻辑并让上层应用绕过 core 访问。
- 测试关注点
  - core 已提供大量与服务/插件相关的单测；在 client 中，测试的重点更多是：
    - React 组件与 Hook 是否正确消费服务（例如打开项目后是否发起正确的 API 调用并更新视图）。
    - 与后端交互的适配层是否正确处理错误/加载状态，并将结果反映到 core 的模型中。
- 文档与示例
  - 若需要理解 client 的整体使用方式，可以搜索 monorepo 中引用 `@coze-project-ide/client` 的应用（例如 frontend/apps 下的具体产品）：
    - 查看这些应用如何创建容器、如何在页面中挂载 ProjectIDE 组件、如何传入项目/用户上下文。
  - 在修改对外 API 时，务必同步检查这些上层应用，确保不破坏现有集成方式。
