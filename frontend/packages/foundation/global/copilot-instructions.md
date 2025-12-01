# @coze-foundation/global 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/foundation/global）中安全、高效地协作开发。

## 1. 子包定位与整体角色

- 子包路径：frontend/packages/foundation/global，对应 npm 包名 `@coze-foundation/global`。
- 功能定位：聚焦「全局初始化与跨页面行为」，提供：
  - 全局加载态移除工具：removeGlobalLoading。
  - 应用初始化相关 Hooks：useAlertOnLogout（通过子路径 exports: use-app-init）。
  - 机器人 / 项目创建入口行为：useCreateBotAction。
- 使用方式：
  - 常规入口从 [frontend/packages/foundation/global/src/index.ts](frontend/packages/foundation/global/src/index.ts) 导入公共 API：
    - `import { removeGlobalLoading, useCreateBotAction } from '@coze-foundation/global';`
  - 专用初始化 Hook 从子路径导入：
    - `import { useAlertOnLogout } from '@coze-foundation/global/use-app-init';`

## 2. 全局架构与主要模块

- 入口与导出
  - [frontend/packages/foundation/global/src/index.ts](frontend/packages/foundation/global/src/index.ts)
    - 统一导出本包对外 API：removeGlobalLoading、useCreateBotAction。
    - 所有新增公共能力应通过该文件集中导出，避免散落子路径被直接引用。
- Hooks 模块
  - 目录：[frontend/packages/foundation/global/src/hooks](frontend/packages/foundation/global/src/hooks)
  - use-create-bot-action
    - 文件：[frontend/packages/foundation/global/src/hooks/use-create-bot-action.tsx](frontend/packages/foundation/global/src/hooks/use-create-bot-action.tsx)
    - 职责：封装「创建 Bot / 项目」行为，结合埋点、弹窗与新窗口跳转。
    - 依赖：
      - 事件埋点：`@coze-arch/bot-tea`（EVENT_NAMES、sendTeaEvent）。
      - 项目创建弹窗：`@coze-studio/project-entity-adapter`（useCreateProjectModal）。
      - 跨模块事件总线：`@coze-common/coze-mitt`（cozeMitt）。
    - 数据流：
      - 调用 useCreateProjectModal 获取 `createProject` 与 `modalContextHolder`，并配置一系列生命周期回调（onBeforeCreateBot、onCreateBotSuccess 等）。
      - 通过 `window.open()` 在新窗口中打开 Bot/Project 页面，成功后定向到 `/space/:spaceId/bot/:botId` 或 `/space/:spaceId/project-ide/:projectId` 等路由。
      - 自动创建（autoCreate=true）时，会在 effect 中直接调用 createProject。
  - use-app-init（子路径导出）
    - 目录：[frontend/packages/foundation/global/src/hooks/use-app-init](frontend/packages/foundation/global/src/hooks/use-app-init)
    - index.ts 仅转发：`export { useAlertOnLogout } from './use-alert-on-logout';`
    - use-alert-on-logout
      - 文件：[frontend/packages/foundation/global/src/hooks/use-app-init/use-alert-on-logout.ts](frontend/packages/foundation/global/src/hooks/use-app-init/use-alert-on-logout.ts)
      - 职责：在账号信息更新 / 需要重新登录时，弹出统一的刷新提示 Modal。
      - 依赖：
        - 国际化：`@coze-arch/i18n`（I18n.t）。
        - 设计系统组件：`@coze-arch/coze-design`（Modal.confirm）。
        - 账号适配：`@coze-foundation/account-adapter`（useAlterOnLogout 实现底层监听）。
      - 数据流：
        - 通过 useRef 防止重复弹窗。
        - 在 account-adapter 触发 logout 相关事件时调用 callback，弹出 Modal，并在点击确认后执行 `window.location.reload()`。
- 工具模块
  - 文件：[frontend/packages/foundation/global/src/utils/global-loading.ts](frontend/packages/foundation/global/src/utils/global-loading.ts)
  - 职责：统一移除全局启动 Loading DOM（#global-spin-wrapper）。
  - 实现要点：
    - 对于不支持 MutationObserver 的浏览器：直接隐藏 Loading DOM，避免阻塞页面显示。
    - 对于支持 MutationObserver 的浏览器：监听 `#root` 的 DOM 变更，一旦有任何变更则隐藏 Loading 并断开观察，以减少运行时开销。
- 类型声明
  - 文件：[frontend/packages/foundation/global/src/typings.d.ts](frontend/packages/foundation/global/src/typings.d.ts)
  - 功能：通过 `/// <reference types='@coze-arch/bot-typings' />` 引入全局 Bot 相关类型，避免在本包内重复声明。

## 3. 构建、测试与本地开发

- tsconfig 与项目引用
  - 构建配置：[frontend/packages/foundation/global/tsconfig.build.json](frontend/packages/foundation/global/tsconfig.build.json)
    - 继承仓库统一 web ts 配置：`@coze-arch/ts-config/tsconfig.web.json`。
    - outDir: dist，rootDir: src，module: ESNext，target: ES2020，moduleResolution: bundler。
    - references：显式依赖 account-adapter、account-ui-adapter、agent-ide/space-bot、bot-api、bot-tea、bot-typings、i18n、coze-mitt、user-store、project-entity-adapter 等包，保证 Rush 增量构建顺序正确。
- npm 脚本（以 [frontend/packages/foundation/global/package.json](frontend/packages/foundation/global/package.json) 为准）
  - `npm run build`
    - 当前实现为 `exit 0`，即占位脚本，不做实际打包；构建通常由上层工具链（如统一 bundler / app）处理。
  - `npm run lint`
    - 执行 `eslint ./ --cache`，使用本包下 [frontend/packages/foundation/global/eslint.config.js](frontend/packages/foundation/global/eslint.config.js) 及仓库共享配置。
  - `npm run test`
    - 执行 `vitest --run --passWithNoTests`。
    - Vitest 配置在 [frontend/packages/foundation/global/vitest.config.ts](frontend/packages/foundation/global/vitest.config.ts) 中，通过 `@coze-arch/vitest-config` 的 `defineConfig` 统一管理，preset 为 `web`。
  - `npm run test:cov`
    - 运行单测并生成覆盖率：`npm run test -- --coverage`。
- 仓库级 Rush 工作流（参考其他子包惯例）
  - 在仓库根目录：
    - 安装依赖：`rush update`。
    - 只构建本包及依赖：`rush build -t @coze-foundation/global`。
    - 只测试本包及依赖：`rush test -t @coze-foundation/global`（如果已在 monorepo 中配置）。

## 4. 项目特有的约定与模式

- 导出与子路径约定
  - 公共 API 统一从包根导出（index.ts）；只在确有需求时才暴露子路径（如 use-app-init），并在 package.json 的 `exports` 和 `typesVersions` 中显式声明：
    - `"./use-app-init": "./src/hooks/use-app-init/index.ts"`。
  - 新增对外 Hook/工具时，应：
    - 在 src 下建立清晰的目录（如 hooks/xxx 、utils/xxx）。
    - 在 index.ts 做统一 re-export。
    - 仅在需要被外部直接按路径引用时，才扩展 package.json 的 exports / typesVersions。
- React Hook 使用约定
  - 所有 Hook 遵循标准命名（useXxx）并通过 React hooks 规则（依赖列表完整等）。
  - 涉及副作用（如 window.open、新窗口跳转、Modal 弹窗）时：
    - 优先在回调或 useEffect 内处理，避免在渲染阶段触发副作用。
    - 使用 useRef 持有跨回调的状态（如 newWindowRef / alertRef），避免闭包导致的状态错乱。
- 全局行为与浏览器 API
  - removeGlobalLoading 与 useCreateBotAction/useAlertOnLogout 都直接操作 `window` 或 `document`，因此：
    - 仅在浏览器环境中使用，不适合作为 SSR 首屏渲染逻辑。
    - 在编写新代码时，避免在模块顶层直接访问 `window/document`，而应放到函数内部或 effect 中，以便未来兼容 SSR 或测试环境。
- 埋点与事件总线
  - 埋点：统一通过 `@coze-arch/bot-tea` 的 EVENT_NAMES、sendTeaEvent 发送，与其他前端应用保持统一统计口径。
  - 事件总线：使用 `@coze-common/coze-mitt` 的 cozeMitt 发射业务事件，例如 `createProjectByCopyTemplateFromSidebar`，由其他包（如 adapter/ui）监听。
  - 新增事件时需：
    - 保持事件名有明确业务含义，避免与已有事件冲突。
    - 在对应消费方（通常在 adapter/UI 包）中同步更新监听逻辑。

## 5. 重要依赖与跨包集成

- 账号相关
  - `@coze-foundation/account-adapter`
    - 提供 useAlterOnLogout（useAlertOnLogoutImpl），封装账号状态监听；global 包只负责 UI & 刷新行为。
  - `@coze-foundation/account-ui-adapter`
    - 通过 tsconfig.build.json 的 project reference 被依赖，通常用于账号 UI 组件集成（虽然当前源码未直接 import，但构建顺序依赖）。
- Bot/项目相关
  - `@coze-arch/bot-api`、`@coze-arch/bot-typings`
    - 提供 Bot 相关接口与类型定义，typings.d.ts 通过引用统一注入类型；如需新增 API 调用，应先在对应包中扩展类型，再在本包消费。
  - `@coze-studio/project-entity-adapter`
    - useCreateProjectModal 的来源，负责弹窗 UI 与服务交互，本包只组装其生命周期回调与导航逻辑。
- 国际化与 UI
  - `@coze-arch/i18n`
    - 通过 `I18n.t('key')` 获取文案；新增文案时应在 i18n 仓库维护统一 key，避免在本包写死字符串。
  - `@coze-arch/coze-design`
    - 统一 UI 库（Modal 等）；在新增 UI 行为时，优先使用该库组件。
- 事件与状态
  - `@coze-common/coze-mitt`
    - 作为轻量事件总线；在本包中仅用于通知项目复制成功等事件，避免在此承担复杂状态管理职责（全局状态请交给 global-store 等包）。
  - `@coze-studio/user-store`
    - 通过 tsconfig 引用参与构建，通常用于获取当前用户/空间信息；当前代码仅使用 currentSpaceId 作为参数传入，保持 global 部分无直接 store 依赖，是设计上的边界划分。

## 6. 开发与修改建议（AI 专用）

- 修改 / 扩展 useCreateBotAction 时：
  - 不要在 Hook 内引入新的全局状态（如 Redux/Zustand）；应通过参数或已有 adapter（project-entity-adapter 等）传递所需信息。
  - 保持所有新行为都通过 useCreateProjectModal 的配置回调实现，避免绕过其内部流程直接操作网络请求或路由。
  - 对窗口打开/关闭逻辑要谨慎：统一通过 openWindow/destroyWindow 管理 newWindowRef，避免出现孤儿窗口或多窗口。
- 修改 useAlertOnLogout 时：
  - 保持仅在回调首次触发时展示 Modal，避免用户频繁被打断。
  - 避免在本 Hook 中引入额外的业务判断逻辑（如权限检查、路由跳转）；这些应留在 account-adapter 或更上层的 adapter/UI。
- 新增全局工具函数时：
  - 若主要是 DOM 层启动/销毁逻辑，可放入 src/utils，并通过 index.ts 导出。
  - 避免在本包处理复杂领域逻辑（如聊天、工作流等），这些应放到对应 agent-ide / workflow 等包中，本包只负责「全局入口级」横切行为。

## 7. 版本控制与其他

- 版本与发布
  - 当前版本号为 0.0.1，采用 Apache-2.0 许可证，对应声明见 package.json。
  - 作为 Rush monorepo 成员，本包的版本与发布通常由上层发布流水线统一管理，AI 不应在此自动修改 version 字段，除非明确指示。
- 代码风格
  - 遵循仓库统一的 eslint / stylelint / ts-config 约定；新增文件时尽量参照现有文件头部版权声明与 import 顺序。
  - 所有对外文件（index.ts、导出的 Hook/工具）应包含统一的版权与 License 头部注释。