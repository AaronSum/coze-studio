# Coze Foundation - space-ui-base Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/space-ui-base）中安全、高效地协作开发。

## 1. 子包定位与整体角色

- 本包名称：`@coze-foundation/space-ui-base`，位于 monorepo 前端工程的基础设施层（foundation）。
- 功能定位：围绕「空间（space）/工作区（workspace）」提供**通用 UI 组件与初始化逻辑**，主要负责：
  - 空间权限初始化与路由挂载（`SpaceIdLayout`）。
  - 空间列表拉取、默认空间/子菜单跳转逻辑（`useInitSpace`）。
- 上层典型调用方：各业务应用（如 `apps/coze-studio`）在路由配置和页面入口中复用本包，统一处理工作区初始化与权限校验。

## 2. 代码结构与主要模块

### 2.1 目录结构

- [src/index.tsx](src/index.tsx)
  - 包的主入口，导出对外 API：
    - `WorkspaceSubMenu`（来自 `components/workspace-sub-menu`，此目录内组件为 workspace 子菜单相关 UI）。
    - `SpaceIdLayout`（来自 `components/space-id-layout.tsx`）。
    - `useInitSpace`（来自 `hooks/use-init-space.ts`）。
- [src/components/space-id-layout.tsx](src/components/space-id-layout.tsx)
- [src/components/workspace-sub-menu](src/components/workspace-sub-menu)
  - 该目录内是工作区子菜单组件集合，对外通过 `components/workspace-sub-menu/index.tsx` 聚合导出（由上层通过 `WorkspaceSubMenu` 使用）。
- [src/hooks/use-init-space.ts](src/hooks/use-init-space.ts)
- 配置类文件：
  - [eslint.config.js](eslint.config.js)：使用 `@coze-arch/eslint-config` 的 `web` 预设。
  - [tsconfig.build.json](tsconfig.build.json)、[tsconfig.json](tsconfig.json)：TS 构建配置与工程引用。
  - [vitest.config.ts](vitest.config.ts)：使用 `@coze-arch/vitest-config` 进行统一测试配置。

### 2.2 SpaceIdLayout：空间级路由与权限初始化

- 文件： [src/components/space-id-layout.tsx](src/components/space-id-layout.tsx)
- 核心职责：
  - 依据路由参数中的 `space_id`，为该空间执行**权限初始化**，并在销毁时清理空间数据。
  - 仅在权限初始化完成后才渲染子路由（`<Outlet />`），确保所有后续页面均在权限已就绪的上下文中运行。
- 关键依赖：
  - `useParams`、`Outlet` 来自 `react-router-dom`，通过 `space_id` 参数识别当前空间。
  - `useDestorySpace` 来自 `@coze-common/auth`：在空间组件卸载时清空对应空间数据。
  - `useInitSpaceRole` 来自 `@coze-common/auth-adapter`：拉取并初始化空间权限数据，返回 `isCompleted` 表示是否就绪。
- 使用模式：
  - 典型路由结构示例：
    - 父路由 path: `/space/:space_id/*`，element: `<SpaceIdLayout />`。
    - 子路由在 `Outlet` 下渲染，访问时可确保空间权限数据已初始化。
  - 注意：`SpaceIdLayout` 外层不应再包一层额外依赖 `space_id` 的副作用，否则会在权限未完成时访问到不完整状态。

### 2.3 useInitSpace：空间初始化与默认跳转

- 文件： [src/hooks/use-init-space.ts](src/hooks/use-init-space.ts)
- 核心职责：
  - 管理空间列表拉取、默认空间选择、无权限/无空间的错误提示与埋点上报。
  - 当未明确指定 `spaceId` 时，从：
    1. `localStorageService` 中历史记录的 `workspace-spaceId` / `workspace-subMenu`；
    2. 个人空间 `getPersonalSpaceID()`；
    3. 空间列表首项；
    依次选出 fallback 空间，并跳转到 `/space/{spaceId}/{subMenu}`。
  - 当指定 `spaceId` 时：
    - 通过外部传入的 `fetchSpacesWithSpaceId` 拉取与该空间相关的列表。
    - 使用 `useSpaceStore.getState().checkSpaceID(spaceId)` 校验是否有访问权限。
    - 根据结果更新 store 或抛出 `CustomError` 触发全局错误 UI。
- 重要依赖与数据流：
  - `useSpaceStore` 来自 `@coze-foundation/space-store`：Zustand 状态仓库，提供：
    - `space`, `spaceList`, `loading`（空间列表与当前空间信息）。
    - 行为：`fetchSpaces`, `getPersonalSpaceID`, `checkSpaceID`, `setSpace` 等。
  - `localStorageService` 来自 `@coze-foundation/local-storage`：提供 `getValueSync` 读取最近使用的空间与子菜单。
  - `I18n` 来自 `@coze-arch/i18n`：统一国际化 key，例如 `'enterprise_workspace_default_tips2_toast'`、`'workspace_no_permission_access'`。
  - `Toast` 来自 `@coze-arch/coze-design`：统一的 UI 提示组件。
  - `CustomError` + `useErrorHandler` + `reporter` 来自 `@coze-arch/bot-error` / `@coze-arch/logger` / `@coze-arch/report-events`：
    - 用于上报埋点 `ReportEventNames.errorPath` 与构造带 UI 配置的全局错误。
- Hook 调用约定：
  - 入参与默认值：
    - `spaceId?: string`：可选，通常从 `react-router` 的 params 传入。
    - `fetchSpacesWithSpaceId?: (spaceId: string) => Promise<unknown>`：提供业务自定义拉取逻辑；若未提供，会只依赖 `useSpaceStore.fetchSpaces`。
    - `isReady?: boolean`：控制初始化时机，例如在全局配置/用户信息加载完后再执行（避免重复请求）。
  - 返回值：`{ loading, isError, spaceListLoading, spaceList }`：
    - `loading`: 当前是否已有 `space.id`，常用于包裹 loading skeleton。
    - `isError`: 初始化过程中是否发生错误（已上报）。
    - `spaceListLoading`: 空间列表拉取状态，直接透传自 `useSpaceStore`。
    - `spaceList`: 当前空间列表。

### 2.4 WorkspaceSubMenu：工作区子菜单组件

- 目录： [src/components/workspace-sub-menu](src/components/workspace-sub-menu)
- 角色：封装空间内的子菜单 UI（如「开发」「设置」等），与 `useInitSpace` 中的 `workspace-subMenu` localStorage key 对应。
- 使用方式：
  - 从包入口引入：`import { WorkspaceSubMenu } from '@coze-foundation/space-ui-base';`。
  - 同步维护 subMenu 标识（如 `'develop'`）与本组件内部路由/高亮逻辑，确保 `getFallbackWorkspaceURL` 产生的 URL 与 UI 状态一致。

## 3. 构建、测试与开发工作流

### 3.1 包级脚本

- 位置： [package.json](package.json)
- 可用命令：
  - `npm run build`
    - 当前实现为 `exit 0`，即占位命令，实际产物构建通常由上层 Rsbuild/Rush 流程统一处理。
    - AI 助手在本包内修改源码后，一般只需依赖整个应用的构建脚本（如 `apps/coze-studio` 内的 build）。
  - `npm run lint`
    - 调用 `eslint ./ --cache`，通过 [eslint.config.js](eslint.config.js) 继承 `@coze-arch/eslint-config` 的 `web` 预设。
  - `npm run test`
    - 执行 `vitest --run --passWithNoTests`。
    - Vitest 统一配置在 [vitest.config.ts](vitest.config.ts)，`preset: 'web'` 来自 `@coze-arch/vitest-config`。
  - `npm run test:cov`
    - 在 `test` 基础上加 `--coverage`，启用覆盖率统计。

### 3.2 在 monorepo 中的工作方式

- 在仓库根目录：
  - `rush install` / `rush update`：安装/更新依赖，保证 workspace 版本一致。
- 在 frontend 工程层：
  - 主要应用的开发/构建命令在 [frontend/README.md](frontend/README.md) 中约定，例如：
    - `cd frontend/apps/coze-studio && rushx dev` / `rushx build`。
- 对于本包：
  - 通过 `rushx test --to @coze-foundation/space-ui-base`（在 monorepo 级别）可以只针对本包运行相关命令（根据 Rush 配置而定）。

## 4. 项目特有约定与模式

### 4.1 权限与空间数据初始化时序

- 访问任何依赖空间权限的页面，应满足时序：
  1. `SpaceIdLayout` 通过 `useInitSpaceRole` 完成权限初始化，`isCompleted === true`。
  2. 业务页面中若需要空间列表或当前空间信息，再通过 `useInitSpace` / `useSpaceStore` 获取。
- 推荐组合：
  - 路由维度使用 `SpaceIdLayout`，页面或布局层使用 `useInitSpace` 来进行「默认空间选择 + 跳转 + 列表管理」。

### 4.2 错误处理与埋点

- 所有「空间 id 非法或无权限」错误应遵循现有模式：
  - 抛出 `CustomError(ReportEventNames.errorPath, 'space id error', { customGlobalErrorConfig: { ... } })`。
  - 使用 `useErrorHandler()` 统一捕获并交由全局错误处理系统展示。
  - 同时通过 `reporter.error({ message: 'init_space_error', error })` 记录详细日志。
- AI 助手在新增逻辑时，应尽量复用上述模式，避免直接 `console.error` 或无埋点的 `throw`。

### 4.3 Zustand store 与 hook 的使用约定

- `useSpaceStore` 的使用模式在 `useInitSpace` 中已是标准范式：
  - 使用 `useShallow` 选择必要字段，避免不必要的重渲染。
  - 通过 `useSpaceStore.getState()` 访问 actions（如 `fetchSpaces`, `checkSpaceID`, `setSpace`）。
- 若新增 hook：
  - 建议延续该模式，即：
    - UI 组件内只关心展示与交互。
    - 数据拉取、权限校验、localStorage 交互等集中在 hooks 中。

### 4.4 国际化与提示文案

- 国际化：
  - 文案 key 统一由 `I18n.t('some_key')` 提供，不在组件中写死文本。
  - 如需新增文案，请在对应 i18n 包（`@coze-arch/i18n` 相关工程）中补充。
- 交互提示：
  - 优先使用 `Toast` 等 UI 基础库统一的组件，避免自造弹层。

## 5. 外部依赖与关键通信

- 关键 workspace 相关依赖：
  - `@coze-foundation/space-store`：空间状态与行为封装，是所有空间逻辑的单一真源。
  - `@coze-foundation/local-storage`：提供受控、可扩展的本地存储服务（而非直接 `window.localStorage`）。
- 权限与认证体系：
  - `@coze-common/auth` + `@coze-common/auth-adapter`：
    - 前者更多偏向状态与生命周期（如 `useDestorySpace`）。
    - 后者封装服务调用逻辑（如 `useInitSpaceRole`），屏蔽具体接口细节。
- 日志与上报：
  - `@coze-arch/logger`, `@coze-arch/report-events`, `@coze-arch/bot-error`：
    - 提供统一的 error 类型、自定义错误 UI、埋点事件名常量等。

## 6. 开发规范与协作注意事项

- 代码风格：
  - 使用 `@coze-arch/eslint-config` + `@coze-arch/ts-config`，保持与整个前端工程一致的风格与 TS 设定。
  - JSX 风格为 `react-jsx`，目标环境 `DOM + ESNext`，打包模块为 ESM。
- 测试：
  - 单元测试使用 Vitest + React Testing Library；优先为 hooks 与核心路由组件（如 `useInitSpace`, `SpaceIdLayout`）编写测试。
- 类型与引用：
  - 通过 `tsconfig.build.json` 的 `references` 引用其他 workspace 包，保证增量编译和类型检查性能。

## 7. AI 助手在本包常见任务建议

- 新增空间相关页面/功能时：
  - 首选在上层应用中复用本包导出的 `SpaceIdLayout` 与 `useInitSpace`，避免复制空间初始化与权限逻辑。
- 修改默认跳转逻辑（例如新增子菜单）：
  - 同步修改：
    - `getFallbackWorkspaceURL` 使用的默认 subMenu（当前为 `'develop'`）。
    - `WorkspaceSubMenu` 内的子菜单配置与对应路由。
- 调整权限异常处理时：
  - 保持 `CustomError + useErrorHandler + reporter` 三件套，且延续现有 `customGlobalErrorConfig` 结构。

以上内容应为 AI 编程助手在 `space-ui-base` 子包中进行日常开发提供足够上下文，可在需要时继续阅读被引用的外部包以获取更细节的实现。