# @coze-arch/bot-hooks-base 开发指引

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-hooks-base）中安全、高效地协作开发。

## 1. 子包定位与角色
- 本包名称：`@coze-arch/bot-hooks-base`，位于 monorepo 前端子目录：frontend/packages/arch/bot-hooks-base。
- 包定位：为 Bot Studio / Bot 编辑器提供通用 React hooks 与布局/路由适配能力，属于 "arch" 层的基础能力库，被其他上层应用使用而非独立运行。
- 暴露形式：通过 src/index.ts 统一导出各类 hooks 与上下文，供其他包按需引用。

## 2. 全局架构与模块划分
- 入口导出
  - [src/index.ts](src/index.ts) 统一导出所有对外 API，包括：
    - 路由配置/响应式相关：`useRouteConfig`、`TRouteConfigGlobal`、`useIsResponsiveByRouteConfig`。
    - 登录/用户与埋点：`useLoggedIn`、`useUserSenderInfo`、`useMessageReportEvent`。
    - 页面与组件状态：`useComponentState`、`usePageState`（已标记 deprecated）、`useInitialValue`。
    - UI 交互：`useLineClamp`、`useExposure`、`useDragAndPasteUpload`、`useDefaultExPandCheck`、`useResetLocationState`。
    - 布局：`LayoutContext`、`useLayoutContext`、`PlacementEnum`（来自 editor-layout）。

- 路由与响应式
  - [src/use-route-config.ts](src/use-route-config.ts)
    - 基于 `react-router-dom` 的 `useMatches` 获取当前路由匹配栈，将 `handle` 与 `data` 中的配置合并为一个全局配置对象（`TRouteConfigGlobal`）。
    - 支持业务特定字段：`showAssistant`、`showAssistantGuideTip`、`hasSider`、`showMobileTips`、`requireAuth`、`loginFallbackPath` 等；这些字段在上层路由定义中通过 `handle` 或 loader 返回。
  - [src/use-responsive.ts](src/use-responsive.ts)
    - 利用 `@coze-arch/responsive-kit` 提供的 `useMediaQuery` 与 `ScreenRange`，根据 `useRouteConfig` 中的 `responsive` 字段判断当前是否应进入“响应式模式”（如移动端适配）。
    - `responsive: true` 等价于 `{ rangeMax: ScreenRange.LG, include: false }` 的默认行为；同时支持 `{ rangeMax, include }` 精细控制。

- 页面/组件状态管理
  - [src/use-page-state.ts](src/use-page-state.ts)
    - 对 React `useState` 的封装，提供 `setState`（支持部分更新与替换）、`resetState`，并在组件销毁时（可选）自动重置状态。
    - 已被注释为 `@deprecated`，建议在新能力中优先使用 `useComponentState`（定义于 [src/use-component-state.ts](src/use-component-state.ts)）。
  - [src/use-component-state.ts](src/use-component-state.ts)
    - 提供更通用的组件状态管理能力，通常配合 zustand 或自定义 store，设计上比 `usePageState` 更灵活、可复用。

- Bot 相关 hooks
  - 目录 [src/bot](src/bot) 中：
    - [src/bot/use-user-sender-info.ts](src/bot/use-user-sender-info.ts)：从 `@coze-studio/user-store` / `@coze-studio/bot-detail-store` 等 store 中组合出消息发送者信息，供聊天区组件或埋点使用。
    - [src/bot/use-message-report-event.ts](src/bot/use-message-report-event.ts)：对消息相关事件的埋点/上报封装，通常依赖 `@coze-arch/bot-api` 或 `@coze-arch/bot-utils` 中的上报工具。

- 布局与编辑器集成
  - 目录 [src/editor-layout](src/editor-layout) 提供：
    - `LayoutContext`、`useLayoutContext`、`PlacementEnum`：用于描述 Bot 编辑器/工作区内部布局（如左侧导航、右侧面板等）的上下文。
    - 其他 hooks 可通过 context 读取布局信息决定展示方式。

- 路由工具
  - [src/router/use-reset-location-state.ts](src/router/use-reset-location-state.ts)
    - 为路由 location state 提供统一的重置行为，避免在页面间跳转时遗留状态。

整体结构遵循“按能力/领域划分 hooks 文件 + 在 index.ts 聚合导出”的设计，避免在上层应用中直接耦合到内部实现文件路径。

## 3. 依赖与外部集成
- 内部 workspace 依赖
  - 本包大量依赖同一 monorepo 内其他包，所有版本号均为 `workspace:*`：
    - `@coze-arch/bot-api`：Bot 相关 API 调用封装。
    - `@coze-arch/bot-semi`、`@coze-arch/bot-tea`：UI 组件或主题体系。
    - `@coze-arch/bot-utils`：Bot 领域工具函数（例如埋点、格式化等）。
    - `@coze-arch/responsive-kit`：媒体查询、断点常量等响应式工具，是 `useIsResponsiveByRouteConfig` 的核心依赖。
    - `@coze-common/chat-area`：聊天区域组件，通常配合 `useUserSenderInfo` 和埋点 hook 使用。
    - `@coze-studio/bot-detail-store` / `@coze-studio/user-store`：基于 zustand 的全局 store，提供 Bot 信息和用户信息。

- 第三方依赖
  - `react` / `react-dom`：通过 peerDependencies 声明，要求宿主项目提供 React 18+ 环境。
  - `zustand`：轻量状态管理库，用于 store 与 hooks 之间的连接。
  - `ahooks`：高阶 hooks 工具库，部分业务 hooks 可能基于其实现（如节流/防抖、生命周期开关等）。
  - `lodash-es`：仅在需要时引入特定工具函数，注意 tree-shaking（使用按需导入）。

- 测试与构建工具
  - `vitest` + `@coze-arch/vitest-config`：统一测试配置，preset 为 `web`，覆盖范围为 `src` 目录，默认排除 `src/index.ts`、`src/global.d.ts` 以及 `src/page-jump/config.ts`。
  - TypeScript 配置来自 `@coze-arch/ts-config`，在 [tsconfig.json](tsconfig.json) 中扩展；构建配置可能依托仓库统一的 rsbuild / webpack 配置。

## 4. 开发与测试工作流
- 初始化
  - 在 monorepo 根目录执行：`rush update`（由 README 说明），安装/对齐所有依赖。

- 本子包常用命令（在 frontend/packages/arch/bot-hooks-base 内执行）
  - `npm test` / `pnpm test`：调用 `vitest --run --passWithNoTests`，运行单元测试。
  - `npm run test:cov`：运行测试并输出覆盖率，依赖 `@vitest/coverage-v8`。
  - `npm run lint`：使用项目统一的 eslint 配置 [eslint.config.js](eslint.config.js) 校验 TypeScript/React 代码（带缓存）。
  - `npm run build`：当前实现为 `exit 0`，即构建逻辑由上层统一 pipeline 负责，该子包自身不执行本地构建；开发时不需要在此包单独打包。

- 调试与集成方式
  - 推荐在引用此包的应用（如 Bot Studio 前端 app）中运行开发服务器，通过实际路由/界面验证 hooks 行为。
  - 当修改 hooks 时，建议同步编写/更新对应的 vitest 测试用例放置于 [__tests__](__tests__) 目录，并使用 `@testing-library/react`/`@testing-library/react-hooks` 验证交互逻辑。

## 5. 代码风格与约定
- TypeScript & React
  - 全面使用 TypeScript，类型定义集中在各 hook 文件顶部；公共类型如 `TRouteConfigGlobal` 由 index.ts 导出供外部使用。
  - 函数组件/自定义 hooks 命名以 `use` 前缀开头，返回值为对象或 tuple 时需保证向前兼容性。
  - 使用 React Hooks 标准实践：避免在条件语句内调用 hooks，不在非组件函数中直接调用 React hooks。

- 路由配置约定
  - `TRouteConfigGlobal` 字段通过 React Router route 的 `handle`/`data` 注入，`useRouteConfig` 会按匹配顺序后覆盖前，允许上层路由覆盖下层配置。
  - 一旦为某 route 配置了 `responsive` 字段，`useIsResponsiveByRouteConfig` 会启用响应式逻辑；注意 `responsive: true` 的默认断点行为。

- 状态更新约定
  - `usePageState` 的 `setState` 支持整体替换与部分合并：
    - `setState(next, true)`：整体替换。
    - `setState(partial)`：基于上一次状态合并；使用时避免传入会破坏结构的不完整对象。
  - 新代码更推荐通过 `useComponentState` 或上游 `zustand` store 管理状态，保持状态 shape 单一来源。

- 废弃与兼容性
  - 代码中使用 JSDoc `@deprecated` 标注废弃 API（如 `usePageState`），但仍通过 index.ts 导出以保证兼容性。
  - 在新增 hooks 时，如替代旧 API，需在旧 API 上补充清晰的废弃说明和推荐替代方案。

- 代码风格工具
  - ESLint 配置继承自 `@coze-arch/eslint-config`，Stylelint 配置继承自 `@coze-arch/stylelint-config`，保持与 monorepo 其他前端包一致。
  - 提交前应确保通过 `npm run lint` 与对应工作区的统一 lint 任务。

## 6. 目录结构约定
- 顶层目录
  - [src](src)：核心源码目录，仅存放对外导出的 hooks、上下文与类型。
  - [__tests__](__tests__)：Vitest 单元测试，命名/分层应与 src 保持对应关系（如 `src/use-xxx.ts` 对应 `__tests__/use-xxx.test.ts`）。
  - [config](config)：测试、打包或运行时所需的本地配置（如 mock、示例配置），视现有文件内容而定。
  - [setup](setup)：`vitest` 的 setup 脚本目录，对全局测试环境（如 jsdom、全局变量、polyfill）做统一配置。

- src 下常见子目录
  - [src/bot](src/bot)：与 Bot 实体/会话相关的 hooks（用户信息、消息事件埋点等）。
  - [src/router](src/router)：与 React Router 相关的工具 hooks（如 `useResetLocationState`）。
  - [src/editor-layout](src/editor-layout)：编辑器布局上下文与相关工具。
  - 其他以 `use-xxx.ts` 命名的文件为独立能力 hooks，保持单一职责。

## 7. 项目流程与协作规范
- 版本与发布
  - 版本号由 monorepo 的 Rush / 版本管理策略统一控制，本包当前版本为 0.0.1，处于早期阶段。
  - 由于构建由上层 pipeline 负责，本包主要关注 API 设计与单元测试质量，发布通常与整体应用一同进行。

- 开发协作
  - 变更应保持向后兼容：
    - 不要随意修改 `src/index.ts` 的导出名称或删除已有导出；如必须破坏兼容性，应在上层应用完成迁移后再清理旧 API。
    - 新增 hooks 时请在 README 与本文件中同步补充用途与使用场景（如为 Bot 编辑器、聊天体验等）。
  - 由于本包标记为 `team-arch`、`level-3`，修改通常需要架构方向的评审；AI 助手在生成改动时应尽量保持变更范围小、语义清晰，避免无谓重构。

## 8. 使用与扩展建议（供 AI 助手遵循）
- 在新增 hook 时：
  - 放置于对应功能域目录或直接置于 src 根目录，并通过 [src/index.ts](src/index.ts) 导出。
  - 若依赖外部 store 或 service，优先复用已有 workspace 包（如 `@coze-studio/*`、`@coze-arch/*`），避免在本包内重复实现通用逻辑。

- 在修改现有 hooks 时：
  - 优先在 __tests__ 中为行为变更补充或更新测试用例，确保 `npm test` 通过。
  - 保持类型签名尽可能不变；如必须调整，先在调用侧完成迁移并保留兼容层。

- 在集成外部依赖时：
  - 如果是本 monorepo 已存在的包，请按 `workspace:*` 方式加入依赖；若是第三方库，需符合仓库整体依赖策略（通常先在上层讨论后引入）。
