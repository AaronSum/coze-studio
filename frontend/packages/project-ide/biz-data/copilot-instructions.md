# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/biz-data）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包是 Project IDE 中“数据类资源”业务层模块，主要负责三类资源：知识库（knowledge）、变量（variables）、数据库（database）的 IDE 侧页面与资源操作编排。
- 对外以 WidgetRegistry 形式接入 IDE 布局系统，通过路由匹配决定在主工作区展示何种数据页面。
- 领域能力（知识 IDE、变量管理、数据库详情等）全部来自其他 data/foundation 包，本包主要负责：
  - 将 IDE 上下文（project/space/version/uri/query）组装为 data 子系统需要的参数。
  - 提供统一的资源导航（在 IDE 内跳转 dataset/table 及上传页）。
  - 在左侧资源树中整合“知识库 + 数据库”的创建、重命名、删除、导入等动作。
- UI 采用 React 18 函数组件，状态与业务上下文大量依赖外部包（zustand store、KnowledgeParamsStore 等），本包自身不维护复杂全局 state。

## 目录结构概览

- src/index.tsx
  - 模块对外导出入口：导出三个 WidgetRegistry（Knowledge/Variables/Database）以及业务 hook `useDataResource`。
- src/registry.tsx
  - 定义 `KnowledgeWidgetRegistry` / `VariablesWidgetRegistry` / `DatabaseWidgetRegistry`，通过 `LayoutPanelType.MAIN_PANEL` 将页面挂载到 IDE 主面板。
  - 使用 `withLazyLoad(() => import('./main' | './variables-main' | './database-main'))` 做按需加载，避免首屏压力。
- src/main.tsx
  - “知识库”主页面容器，负责：
    - 从 framework 获取 `spaceID`、`projectID`、`version`、`uri`、`widget`、路由 query 等。
    - 将这些信息封装到 `KnowledgeParamsStoreProvider`，并透传给 `BizProjectKnowledgeIDE` 或 `KnowledgeResourceProcessor`。
    - 通过 `resourceNavigate` 封装跳转逻辑（统一用 `qs.stringify` 拼接 query，使用 `useIDENavigate` 在 IDE 内导航）。
    - 处理 onUpdateDisplayName / onStatusChange，驱动 tab 标题与侧边栏刷新。
- src/variables-main.tsx
  - “变量”主页面容器，主要职责：
    - 设置 widget 标题 & UI 状态（使用 I18n key `dataide002`）。
    - 将 `projectID` / `version` / `datasetID` 注入 `KnowledgeParamsStoreProvider`，内部使用 `VariablesPage` 渲染变量管理页面。
    - 暴露 `resourceNavigate`，支持从变量页跳转到其他资源或上传页面。
- src/database-main.tsx
  - “数据库”详情页面容器，职责与 main.tsx 类似，但面向 `DatabaseDetail`：
    - 通过 uri.path.name 作为 `tableID`，处理数据库 Tab 初始态（query.tab → `initialTab`）。
    - 与侧边栏联动：修改名称后调用 `refetch` 刷新列表。
- src/hooks/use-data-resource.tsx
  - 为项目资源侧边栏（biz-components）提供统一的数据资源操作能力：
    - 暴露 `onCustomCreate` / `onChangeName` / `onAction` / `onDelete` / `createResourceConfig` / `modals` / `validateConfig`。
    - 根据资源类型（ResType.Knowledge / ResType.Database）将事件路由到对应 hook（`useKnowledgeResource` / `useDatabaseResource`）。
    - 集成 “从资源库导入” 功能：当 action 为 `ImportLibraryResource` 时调用 `useImportData` 打开导入弹窗。
- src/hooks/use-knowledge-resource.tsx / use-database-resource.tsx / use-import-data.tsx / use-resource-operation.tsx
  - 封装各类资源的具体 CRUD、弹窗及操作逻辑，通常对接 `@coze-data/*` 和 `@coze-project-ide/biz-components` 的 API。
- src/components/sider-category.tsx
  - 与侧边栏分类展示相关的 UI 组件（如分组、图标等），配合 use-data-resource 返回的配置使用。

## 开发与构建工作流

- 包级脚本（参考 package.json）：
  - `npm run build`: 当前实现为 `exit 0`，仅作为占位，真正的构建通常由仓库统一的 Rush/rsbuild 流水线完成；AI 助手不要在此包内私自引入特殊打包逻辑，如需变更应遵循仓库全局 build 规范。
  - `npm run lint`: 调用根部的 eslint 配置（`eslint.config.js` + `@coze-arch/eslint-config`），对 TS/TSX 进行检查。
  - `npm run test`: 使用 `vitest --run --passWithNoTests`，测试配置继承自 `@coze-arch/vitest-config`，preset 为 `web`。
  - `npm run test:cov`: 带 coverage 的 vitest 运行方式。
- 在整个 monorepo 中，一般通过 Rush 统一调度：
  - 安装依赖：`rush update`。
  - 构建相关上层应用（如 IDE shell）后，本包组件会以 workspace: * 方式被消费，无需单独启动 dev server。
- 若需要在本包内增加测试：
  - 将测试文件放到 `__tests__/` 或与源码同级（遵循仓库的 vitest 命名规则，例如 `*.test.tsx`）。
  - 利用 `@testing-library/react` / `@testing-library/react-hooks` 做组件及 hook 测试。

## 项目约定与编码规范

- 语言与框架：
  - 使用 React 18 函数组件 + TypeScript 5，严格依赖类型定义（引用 `@coze-arch/bot-typings` 等）。
- 代码风格：
  - ESLint 和 Stylelint 配置分别来自 `@coze-arch/eslint-config` 和 `@coze-arch/stylelint-config`，不要在本包重复定义规则，新增规则优先在公共配置维护。
  - 组件/Hook 文件使用 `*.tsx` 后缀，类型声明集中在 `typings.d.ts` 或各自模块内。
- 命名与 I18n：
  - 所有对用户可见的文案使用 `@coze-arch/i18n` 提供的 `I18n.t` 调用，不直接写死字符串。（如：`I18n.t('project_resource_sidebar_create_new_resource')`）。
  - 数据集/数据库命名校验统一走 `validateNameConflict`，并在 `useDataResource` 中通过 `validateConfig.customValidator` 增加本包特有的正则约束（禁止 `"'` 等特殊字符）。
- 依赖与跨包交互：
  - 与 IDE Shell 的交互统一通过 `@coze-project-ide/framework` 暴露的 hook：`useCurrentWidgetContext`、`useIDENavigate`、`useIDEParams` 等，避免绕过它们直接使用 window 或 history。
  - 与业务组件库的交互通过 `@coze-project-ide/biz-components`，如 `usePrimarySidebarStore` / `BizResourceTypeEnum` / `ResourceFolderCozeProps`，不要在本包复制这些类型。
  - data 模块能力全部从 `@coze-data/*` 引入：如 `KnowledgeParamsStoreProvider`、`BizProjectKnowledgeIDE`、`KnowledgeResourceProcessor`、`DatabaseDetail`、`VariablesPage` 等，本包不直接发起 HTTP 请求或访问后端。

## 关键集成点与数据流

- Widget 注册与路由：
  - `src/registry.tsx` 通过 `match` 字段绑定 IDE 内部路由：
    - `/knowledge/:datasetID` → `main.tsx`（知识 IDE / 上传）。
    - `/variables` → `variables-main.tsx`（变量管理）。
    - `/database/:tableID` → `database-main.tsx`（数据库详情）。
  - 所有页面都挂载在 `LayoutPanelType.MAIN_PANEL`，以保证在 IDE 主区域展示。
- IDE 上下文 → Data 子系统：
  - 从 framework hook 中拿到：
    - `useSpaceId` / `useProjectId` / `useCommitVersion` → 空间+项目+版本信息。
    - `useCurrentWidgetContext` → `uri.path.name`（datasetID 或 tableID）、widget 标题和 UI 状态控制。
    - `useIDEParams` → query 参数（如 type/opt/doc_id/module/tab 等）。
  - 通过 `KnowledgeParamsStoreProvider` 统一打包到 `params` 中传给 data 模块，形成本包的核心“桥接层”。
- 资源导航：
  - 封装在 `resourceNavigate` 中：
    - `toResource(resource, resourceID, query, opts)` → `IDENav(
      `/${resource}/${resourceID}?${qs.stringify(query)}`,
      opts,
    )`。
    - 某些场景下额外支持 `upload` 和 `navigateTo`，统一通过 `useIDENavigate` 完成。
  - AI 助手在新增资源类型或页面时，应优先扩展这里的导航能力，而不是在下游组件中自行调用 router。
- 资源树操作：
  - `useDataResource` 将侧边栏操作事件拆分并转发：
    - 创建：按 `BizResourceTypeEnum` 区分走对应资源 hook。
    - 重命名/删除：按 `ResType`（来自 `@coze-arch/bot-api/plugin_develop`）区分知识库与数据库，实现幂等删除和名称同步。
    - 导入：统一通过 `ImportLibraryResource` action 打开导入弹窗。
  - 返回的 `modals` 应在上层 UI 被渲染一次，确保所有资源相关弹窗正常挂载。

## 测试与调试建议

- 单元测试：
  - 针对 hooks（尤其是 `useDataResource`、use-*resource 系列）可以采用 react-hooks-testing-library 模拟事件流：
    - 验证在不同资源类型下事件是否路由到正确的子 hook。
    - 验证 `validateConfig.customValidator` 在非法名称时返回正确的 i18n 文案。
  - 对 Widget 容器组件（main/database-main/variables-main）更多关注：
    - 是否正确将 IDE 上下文转换为 params；
    - onUpdateDisplayName / onStatusChange 是否在对应事件中触发。
- 集成调试：
  - 通常需要启动上层 Project IDE 应用（如 apps 内对应项目），再在 IDE 中打开数据资源面板进行联调；本包本身不直接提供独立 dev server。

## 协作与提交流程

- 版权与 License：
  - 所有新文件需保留与现有文件一致的 Apache-2.0 版权头；AI 助手在新建 TS/TSX 文件时请自动补全该头部。
- Git 与分支：
  - 本仓库整体遵循 Rush monorepo 流程，通常在 feature 分支上开发，再通过合并请求集成；AI 助手不应自动创建/推送分支，但应保持改动聚焦本子包。
- 提交前检查：
  - 至少在本包内运行 `npm run lint`、`npm run test`，保证无新增 lint 错误和测试失败。

## 本子包的特殊注意事项

- 本包是“业务桥接层”，不要在这里引入与 data 模块无关的大量业务逻辑或网络调用，更多复杂逻辑应放到 `@coze-data/*` 或上层 biz-components 中。
- 导航、参数拼装、资源类型分派等是本包的核心责任，改动这些代码会影响 IDE 内多个页面行为，AI 助手在修改前务必搜索调用全局（特别是 framework/biz-components 中的依赖）。
- 由于构建逻辑由仓库统一管理，请不要在此处添加独立 bundler 配置（如自定义 vite/webpack），仅在必要时通过 tsconfig/vitest config 做轻量调整。
