# @coze-project-ide/framework Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/framework）中安全、高效地协作开发。

## 总体架构与角色定位

- 本包是 Coze Studio monorepo 中的「IDE framework SDK」，主要作为 `@coze-project-ide/client` 和一组基础 adapter/hooks/services 的聚合与增强层。
- 入口在 [src/index.ts](src/index.ts)，对外导出三大类能力：
  - 核心 IDE SDK：从 `@coze-project-ide/client` 透传的 `IDEClient`、`ReactWidget`、`ApplicationShell`、`ViewService`、`WidgetManager`、`CommandRegistry`、`ShortcutsService` 等。
  - 业务集成 hooks/context：`src/hooks`、`src/context`，负责在项目维度暴露 `spaceId`、`projectId`、IDE 路由、视图服务等封装后的能力。
  - 项目资源管理与插件能力：`src/components`、`src/plugins`、`src/services`、`src/widgets`，提供 Project IDE 客户端、资源树、上下文菜单插件、关闭确认插件，以及 Modal/Message/Error 等服务。
- 架构特点：
  - 严格「薄封装」：大量能力直接从其它 workspace 包（`@coze-project-ide/client`、`@coze-project-ide/base-adapter` 等）re-export；本包自身逻辑相对轻量，偏 glue code。
  - 明确的分层：
    - 视图/Widget 层：`ReactWidget`、`ProjectIDEWidget` 等。
    - 服务与 Store 层：`ProjectIDEServices`、`WidgetService`、Modal/Error/Message 服务，结合 `inversify` 容器 和全局 store。
    - Hook & Context 层：对上提供 React API，对下依赖 client/adapter/service。

## 目录结构与关键模块

- 根目录
  - [package.json](package.json)：声明为 library 包，`main` 与 `types` 指向 `src/index.ts`，`scripts.build` 为 no-op（`exit 0`），说明真正构建由 monorepo 顶层统一处理。
  - [README.md](README.md)：给出对外导出的大致 API 列表，可视作公开接口参考。
  - [tsconfig.json](tsconfig.json)：通过 `references` 指向 `tsconfig.build.json` / `tsconfig.misc.json`，声明为 composite 项目，参与 monorepo TS project references 构建。
- [src/index.ts](src/index.ts)
  - 对外统一出口：集中 re-export 内部 hooks/context/components/services 与外部 client/adapters。
  - 是理解「哪些功能算公开 API」的权威来源；新增/重构时，如果需要暴露给其他包使用，必须从这里导出。
- [src/hooks](src/hooks)
  - [index.ts](src/hooks/index.ts) 汇总导出：
    - `useSpaceId` / `useProjectId`：项目/空间标识访问。
    - `useProjectIDEServices` / `useIDEServiceInBiz`：访问 Project IDE 相关的 DI 服务集合。
    - `useCurrentWidgetContext` / `useActivateWidgetContext` / `useGetUIWidgetFromId`：围绕当前 Widget 上下文与 UI Widget 查询的封装。
    - `useIDENavigate` / `useIDELocation` / `useIDEParams`：IDE 内部路由与 location 查询。
    - `useCurrentModeType` / `useSplitScreenArea` / `useTitle`：IDE 运行模式、分屏区域、标题等 UI 状态。
    - `useShortcuts`：快捷键绑定相关能力。
    - `useCommitVersion`：版本信息 hook（在此包内再包装一层）。
    - `useWsListener` / `useSendMessageEvent` / `useListenMessageEvent` / `useViewService`：WebSocket/消息事件与视图服务监听。
  - 这些 hooks 普遍以「对 client/base-adapter 的组合封装」为主，遵循轻业务、重集成的风格。
- [src/context](src/context)
  - [index.ts](src/context/index.ts) 直接 re-export 自 `@coze-project-ide/base-adapter` 的：
    - `IDEGlobalProvider`, `useIDEGlobalContext`, `useIDEGlobalStore`。
  - 同时暴露本包定义的 `WidgetContext` 类型/上下文对象（见 [src/context/widget-context.ts](src/context/widget-context.ts)）。
  - 该目录是「全局状态与 DI 容器入口」的关键；在 React 应用中应使用 `IDEGlobalProvider` 作为顶层 Provider。
- [src/components](src/components)
  - [index.ts](src/components/index.ts) 导出：
    - `ProjectIDEClient`：面向 Project IDE 业务的客户端封装，负责结合 bot-api / workspace API 等构建项目级调用入口。
    - `resource-folder` 下的资源树组件与类型：`ResourceFolder`、`ResourceTypeEnum`、`mapResourceTree` 以及一系列 context/props 类型。
  - 该模块是「资源浏览与管理」的 UI+逻辑核心。
- [src/plugins](src/plugins)
  - [index.ts](src/plugins/index.ts) 导出：
    - `createPresetPlugin`：打包了一组预设插件（见 `create-preset-plugin` 子目录），用于完成 IDE 基础能力注册，例如 `ProjectIDEServices`、`WidgetService`。
    - `createContextMenuPlugin`：为 IDE 资源树/Widget 提供统一的右键菜单注册机制。
    - `createCloseConfirmPlugin`：统一处理关闭 IDE 时的确认逻辑，对外也暴露了 `CloseConfirmContribution`（见 [src/plugins/close-confirm-plugin/close-confirm-contribution.ts](src/plugins/close-confirm-plugin/close-confirm-contribution.ts)）。
  - 插件均遵循 `@coze-project-ide/client` 的 plugin/contribution 体系（`definePluginCreator`、`ViewContribution` 等）。
- [src/widgets](src/widgets)
  - [project-ide-widget.tsx](src/widgets/project-ide-widget.tsx)：
    - `ProjectIDEWidget` 继承 `ReactWidget`，封装 Project IDE 对应的 Widget；包含：
      - `context: WidgetContext` 与 `container: interfaces.Container`（inversify 容器），作为业务扩展的依赖注入入口。
      - 内部 `Emitter<void>` 暴露 `onRefresh` 事件与 `refresh()` 方法，用于统一触发界面刷新。
    - 当前 `render()` 返回 `null`，说明真实 UI 由子类或上层通过 contribution 注册 render 函数组装。
  - `primary-sidebar-widget` 子目录中定义了主侧边栏相关 Widget（若需要扩展 IDE 布局，优先参考）。
- [src/services](src/services)
  - [index.ts](src/services/index.ts) 汇总导出：
    - `ModalService`, `ModalType`, `OptionsService`, `ErrorService` 以及 `MessageEvent` 类型。
  - `modal-service.tsx`、`error-service.ts`、`message-event-service.ts` 中实现了：
    - 统一的 Modal 管理（支持不同 ModalType）、错误展示通道、基于事件总线的消息派发。
  - 这些服务通常通过 `ProjectIDEServices` 或 hooks 暴露给组件层。

## 开发与构建工作流

- 依赖管理
  - 本包依赖通过 Rush monorepo 管理：修改 `package.json` 后，需在仓库根目录执行 `rush update` 同步 lockfile。
  - 与其它内部包形成高度耦合：`@coze-project-ide/client`、`@coze-project-ide/base-adapter`、`@coze-arch/*` 等均为 workspace 依赖，不建议在本包内重复实现这些能力。
- 构建
  - 本包自身 `npm`/`pnpm` script：
    - `build`: `exit 0` —— 实际构建流程由上层 Rush/rsbuild 统一调度；在本包目录直接运行 `pnpm build` 不会产生产物，这是设计行为。
    - `lint`: `eslint ./ --cache --quiet` —— 用于本包范围 ESLint 检查。
  - 推荐的统一构建方式（在 monorepo 根目录）：
    - `rush build -t @coze-project-ide/framework`：增量构建当前包及其依赖。
    - 或执行对应 FE 构建脚本（参考根目录 [frontend/README.md](../../README.md) 和 [frontend/rushx-config.json](../../rushx-config.json)）。
- 开发/调试
  - 通常通过运行上层应用（如 `@coze-studio/app`）来间接加载本包：
    - 在 monorepo 根目录执行 `rushx dev --to @coze-studio/app` （具体命令以 FE 目录下 README/rushx-config 为准）。
    - 本包的组件、hooks、services 会在 IDE 页面加载时被触发。
  - 不建议单独运行本包作为独立应用；它被设计为纯库包。
- 测试
  - 目前在此子包目录下未发现专门的测试脚本/测试目录；如需新增测试，应遵循 monorepo 的统一规范，并挂到 Rush 对应 pipeline 上。

## 项目约定与编码风格

- 语言与栈
  - 使用 TypeScript + React 18，广泛使用函数式组件与 React hooks。
  - 依赖 `inversify` 实现 DI 容器，用于 Widget 与服务的生命周期管理。
  - 使用 `zustand` 作为状态管理基础，但在本包中更多通过 `@coze-project-ide/base-adapter` 暴露的 store 操作。
- 模块划分约定
  - **入口导出唯一权威**：所有希望对外暴露的能力，必须通过 [src/index.ts](src/index.ts) 导出，避免直接从子路径 import 内部实现。
  - **Hooks 命名**：`useXxx` 统一位于 `src/hooks`，并在 `src/hooks/index.ts` 汇总导出，保持树状结构清晰。
  - **插件规范**：插件以 `createXxxPlugin` 命名，位于 `src/plugins`，返回符合 client 插件体系的工厂函数；贡献类（Contribution）则命名为 `XxxContribution`。
  - **Widget 规范**：继承自 `ReactWidget` 的组件应以 `XxxWidget` 命名，并尽量保持 `render()` 轻量，把逻辑下沉到 services/hooks。
- 依赖使用约定
  - 对 IDE Shell/视图/命令等基础能力，优先通过 `@coze-project-ide/client` 以及其 re-export 能力获取；不要在本包重复定义类似接口。
  - 全局 context/state 统一依赖 `IDEGlobalProvider` 与 `useIDEGlobalStore`，避免私有全局单例。
  - 与 bot/后端交互相关能力统一下沉到 `@coze-arch/bot-api` 或上层 data/service 包，本包只负责装配与暴露接口。

## 与外部包/系统的集成要点

- 与 @coze-project-ide/client
  - 本包大量直接 re-export 其内容，视其为「内核 IDE SDK」。
  - 当需要扩展 IDE 行为（比如新增视图、命令、快捷键）时，应：
    - 基于 `definePluginCreator` 定义插件工厂；
    - 使用 `bindContributions` 绑定 `ViewContribution` / `LifecycleContribution` / `CommandContribution` / `ShortcutsContribution` 等；
    - 通过本包 `src/plugins` 提供的工厂进行组合与复用。
- 与 @coze-project-ide/base-adapter
  - 提供全局 Provider（`IDEGlobalProvider`）、全局 store hook 以及 commit 版本等公共功能。
  - 在任何 React 应用中，若需要使用本包 hooks（如 `useSpaceId`、`useProjectId`），必须保证上层已注入 `IDEGlobalProvider`。
- 与 @coze-arch/* 系列
  - `@coze-arch/bot-api`、`@coze-arch/bot-utils` 等作为「基础设施」包，本包不应该直接实现具体请求逻辑，而是通过这些包封装 API，再在本包中以服务形式对外暴露。
  - `@coze-arch/coze-design` 提供 UI 组件库，资源树与 Modal 等组件如果需要 UI 元素，优先基于此库实现。

## 流程与协作规范（从仓库现状推断）

- 分支与发布
  - 本包没有独立的发布脚本，遵循 monorepo 统一的版本/发布流程（通过 Rush + CI/CD 完成）。
  - 版本号在 [package.json](package.json) 中维护，但实际发布版本可能由顶层工具控制（例如使用 change log+版本自动提升）。
- 代码质量
  - 使用 `@coze-arch/eslint-config` 作为 ESLint 规则来源，在根目录可运行：
    - `rush lint -t @coze-project-ide/framework`（或类似命令）对本包进行静态检查。
  - 所有源码文件均带有 Apache-2.0 版权头，新增文件应保持一致。

## 在本包中编写/修改代码时的建议

- 新增对外能力时：
  - 优先在已有的目录层级中扩展（如新增 hook 放在 `src/hooks`），避免随意创建平行结构。
  - 把核心实现与对外导出解耦：实现文件可放在具体子目录，但要在 `src/index.ts` 中统一暴露。
- 扩展 Project IDE 功能时：
  - 若是 UI/交互扩展，优先考虑：
    - 通过现有 `ProjectIDEWidget`/侧边栏 Widget 接入；
    - 或通过插件 (`createPresetPlugin` 派生自定义插件) 注册新的 View/Command/Shortcut。
  - 若是服务/数据层扩展，则：
    - 在 `src/services` 下增加对应 service，并通过 `ProjectIDEServices` 或 hooks 暴露给上层。
- 集成其他内部包时：
  - 遵循「从 framework 取入口」的原则：如果某能力已经通过本包 re-export，优先从 `@coze-project-ide/framework` 引入；
  - 只有在确认不会被 framework 聚合、或存在循环依赖时，才直接从下层包（如 `@coze-project-ide/client`）引入。
