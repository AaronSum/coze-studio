# @coze-data/database-v2 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/memory/database-v2-main）中安全、高效地协作开发。

## 1. 全局架构与职责边界
- 本包实现「数据库 v2」前端主入口，向外暴露统一 API，内部主要承载业务编排与 UI 组合，底层能力拆分为：
  - `@coze-data/database-v2-base`：字段类型、常量、基础组件（如表结构编辑、字段标题、DismissibleBanner 等）与类型定义。
  - `@coze-data/database-v2-adapter`：与具体业务域/接口绑定的适配层（如 Database 模式选择、创建表模态框、基础信息模态框、警告信息等）。
  - 本包（database-v2-main）：提供跨业务复用的「数据库详情视图」「数据库选择弹窗」「从 Library 进入的数据库管理」等高阶组件/Hook，对上游业务（Studio、Workflow、Project-IDE 等）暴露统一接口。
- 对外导出点集中在 [src/index.tsx](src/index.tsx)：
  - `useLibraryCreateDatabaseModal`：用于 Library/资源中心里创建数据库的业务 Hook。
  - `SelectDatabaseModal` / `useSelectDatabaseModal`：数据库选择弹窗及其 Hook，供 IDE / Workflow 等使用。
  - `DatabaseCreateTableModal`、`DatabaseTabs`：直接转出自 `@coze-data/database-v2-base`，方便上层按需引入。
  - `DatabaseDetail` / `DatabaseDetailComponent`：数据库详情视图的路由版与可嵌入版入口。
- 数据与上下文来源：
  - 使用 `@coze-data/knowledge-stores` 提供的 `useKnowledgeParams`、`useDataCallbacks` 读取 URL/路由参数、触发状态回调（如状态变化、名称更新）。
  - 使用 `@coze-arch/bot-studio-store` 中的 `useSpaceStore` 获取当前空间 ID，实现不同空间/项目下的资源隔离。
  - 使用 `@coze-arch/bot-api` 的 `MemoryApi` 调用后端接口，如 `BindDatabase` / `UnBindDatabase` 绑定/解绑数据库。
  - 通过 `@coze-arch/i18n`、`@coze-arch/coze-design`（Toast、UI 组件）完成多语言文本与交互提示。

## 2. 关键页面与组件结构
- 入口与聚合：
  - [src/index.tsx](src/index.tsx)：唯一公共导出文件，新增对外 API 时，应在此统一导出，并保持命名语义清晰、稳定。
- 数据库详情视图：
  - [src/pages/database/index.tsx](src/pages/database/index.tsx) `DatabaseDetail`：
    - 作为「路由级」组件，基于 `useKnowledgeParams` 读取 `botID`、`tableID`、`biz` 等参数，并通过 `useSpaceStore` 获取 `spaceId`。
    - 若缺少 `tableID`，直接渲染占位文案 `no database id!`；上层依赖方应保证路由参数正确。
    - 将参数封装后传入 `DatabaseInner`，后者负责真正的业务逻辑与 UI 渲染。
  - `DatabaseInner`（同文件内）：
    - 通过 `useDataCallbacks` 获取 `onStatusChange` / `onUpdateDisplayName` 回调，将其透传给 `DatabaseDetail` 组件，以便在 IDE / Library 中同步数据库状态及展示名称。
    - 维护本地状态 `actionText`（"Add" 或 "Remove"），用于控制按钮语义与后续操作类型。
    - 封装 `handleAddDatabase` / `handleRemoveDatabase`，分别调用 `MemoryApi.BindDatabase` / `MemoryApi.UnBindDatabase`，并使用 `Toast` 反馈结果；失败时统一显示 `res.msg`。
    - `handleClose`：根据 `window.history.length` 判断是返回上一级还是直接跳转到 `/space/${spaceId}/library`，避免在单页入口中出现空白页面。
    - 基于 `@coze-arch/i18n` 的文案键 `db2_030`、`db2_031` 生成按钮文案；AI 在新增按钮/文案时，应先在 i18n 配置中加 key，再在此处引用。
- Library 页面：
  - [src/pages/library/index.tsx](src/pages/library/index.tsx)：封装数据库 Library 入口逻辑（例如展示列表、创建入口等），通常会组合 `useLibraryCreateDatabaseModal` 与相关弹窗组件，用于在 Library 中直接创建/配置数据库。
- 通用弹窗与编辑组件：
  - 目录 [src/components](src/components) 下包含：
    - `database-detail`：数据库详情页主体 UI 组件，接受回调与初始 Tab 等参数，供路由版与嵌入版复用。
    - `select-database-modal`：数据库选择弹窗，暴露组件与 Hook 两种使用方式，可嵌于不同业务入口。
    - `batch-import-modal` 及其 `steps/*`：实现 CSV/Excel 批量导入数据库的多步向导流程。
    - `database-table-data` / `row-edit-modal` / `field-edit-kit/*`：为数据表行/字段编辑提供组合组件，内部大量依赖 `database-v2-base` 中的字段类型与常量。

## 3. 构建、测试与 Storybook 工作流
- 构建：
  - package.json 中 `build` 当前实现为 `exit 0`，即构建占位，真实打包由上游 Rush/整体构建流程统一处理；本包内通常不单独执行打包。
  - Rush 侧依赖通过 [config/rush-project.json](config/rush-project.json) 管理，本包作为 workspace 项参与整体构建。
- 测试：
  - 使用 Vitest 与 monorepo 统一配置：
    - [vitest.config.ts](vitest.config.ts) 通过 `@coze-arch/vitest-config` 的 `defineConfig`，`preset: 'web'` 适配前端环境与 JSDOM。
  - 常用命令：
    - `npm test`：运行单元测试，允许无测试文件时通过（`--passWithNoTests`）。
    - `npm run test:cov`：带覆盖率统计的测试运行。
  - 新增测试时建议放在 `__tests__` 或与源文件同级的 `*.test.tsx`/`*.test.ts`，遵循 Vitest 默认约定。
- Lint 与样式：
  - [eslint.config.js](eslint.config.js) 使用 `@coze-arch/eslint-config`，`preset: 'web'`，无需在子包内重复维护复杂规则；仅在此覆盖项目特有规则（目前为空）。
  - [.stylelintrc.js](.stylelintrc.js) 使用 `@coze-arch/stylelint-config`，保证 LESS/CSS 风格一致；样式文件集中在 `src/**/*.module.less`。
- Storybook：
  - 通过 [ .storybook/main.js ](.storybook/main.js) 配置 React + Vite 的 Storybook：
    - `stories` 路径为 `../stories/**/*.mdx` / `../stories/**/*.stories.tsx`。
    - 使用 `vite-plugin-svgr` 支持导入 SVG 为 React 组件，AI 在新增 SVG 资产时可以直接 `import Icon from './icon.svg?react'`。
  - [ .storybook/preview.js ](.storybook/preview.js) 配置 actions/controls 的基础行为，不覆写全局主题；如需添加全局 decorator，应在此集中管理。

## 4. 重要依赖与集成方式
- Coze 前端基础设施：
  - `@coze-arch/bot-api`：后端 HTTP API 的 typed client；本包目前直接使用 `MemoryApi`，调用时统一检查 `res.code === 0` 判断成功，否则通过 `Toast.error(res.msg)` 提示。
  - `@coze-arch/bot-studio-store`：全局 store（可能基于 Zustand），通过 `useSpaceStore(store => store.getSpaceId())` 获取当前空间 ID；调用时尽量只读取需要的字段，避免无关 rerender。
  - `@coze-arch/i18n`：统一国际化入口 `I18n.t(key)`；新增文案必须先在 i18n 仓库/配置中注册，禁止硬编码可见文案（占位调试除外）。
  - `@coze-arch/coze-design`、`@douyinfe/semi-*`：UI 组件库与图标/插画组件，本包主要依赖 Toast、Modal、表单控件、图标等。
- 数据与知识库：
  - `@coze-data/knowledge-stores`：暴露 `useKnowledgeParams`（路由/业务参数）、`useDataCallbacks`（状态上报钩子），是数据库/知识库模块与上层 IDE/Studio 之间的关键桥梁。
  - `@coze-data/knowledge-resource-processor-*`、`@coze-data/knowledge-stores` 等依赖在本包中一般作为黑盒使用，AI 不应在此包对其内部实现做假设，只使用公开 Hook/API。
- 体验相关：
  - 拖拽行为基于 `@dnd-kit/*`，用于表格行/字段排序等；修改排序逻辑时要同时考虑 `id`、`index` 与 `key` 映射关系，避免数据与 UI 不一致。
  - 日期/时间处理依赖 `dayjs` 与 `date-fns`，数值/对象处理依赖 `lodash-es` 与 `immer`；如新增复杂数据结构转换逻辑，优先复用已有工具包，而不是重新实现。

## 5. 代码风格与项目约定
- 语言与框架：
  - 使用 React 18 + TypeScript，函数式组件为主，尽量使用 `React.FC` 风格定义 Props 类型（当前文件中多为独立接口 + 函数组合）。
  - 路由相关逻辑统一使用 `react-router-dom@6` 的 Hook（如 `useNavigate`）。
- 组件与 Hook 命名：
  - 组件统一使用 PascalCase（如 `DatabaseDetail`、`SelectDatabaseModal`）。
  - 自定义 Hook 使用 `useXxxYyy` 命名（如 `useLibraryCreateDatabaseModal`、`useSelectDatabaseModal`）。
  - 对外导出应避免暴露过多内部实现细节，优先通过 index 统一导出高阶组件/Hook，而不是零散导出内部子组件。
- 错误处理与用户反馈：
  - 所有与后端交互的操作（尤其是绑定/解绑、导入、删除）必须使用 Toast 明确反馈成功/失败，并尽量给出可理解文案；失败时优先展示后端返回 `msg`。
  - 避免在组件内部吞掉异常，至少应在控制台打日志或通过全局 report 组件上报（如 `@coze-data/reporter`）。
- 国际化与文案：
  - 不在业务组件中直接写死中文/英文提示，除明显 Debug 占位信息（如 `no database id!`）外，应统一走 `I18n.t`。
  - 新增文案 key 时，命名参考现有 `db2_xxx` 规则，保持前缀一致，方便后续批量维护。
- 样式约定：
  - 样式文件使用 CSS Modules + LESS，命名为 `*.module.less`，类名使用 `-` 连接的英文短语。
  - 不引入全局样式污染；需要全局覆盖时，应在上游入口（如 Studio / Workspace）进行，而不是在本包内直接操作 `body` 或全局选择器。

## 6. 使用场景与对上游的约束
- 已知引用方：
  - `frontend/packages/studio/workspace/entry-base`：工作台 Database 页面，使用 `DatabaseDetail` 和 `useLibraryCreateDatabaseModal` 等导出。
  - `frontend/packages/workflow/playground`：Workflow Playground 中的数据库选择/详情模态，使用 `SelectDatabaseModal` 与 `DatabaseDetailComponent`。
  - `frontend/packages/project-ide/biz-data`：项目 IDE 中的数据面板，使用 `DatabaseDetail`、`useLibraryCreateDatabaseModal` 与 `useSelectDatabaseModal` 等。
- 对上游的输入要求：
  - 路由参数必须通过 `@coze-data/knowledge-stores` 正确注入（`botID`、`tableID`、`biz` 等），否则会出现空视图或占位文案。
  - 使用 `DatabaseDetail` / `DatabaseInner` 时需保证 `botId`、`databaseId`、`enterFrom` 等必填参数的正确性，`enterFrom` 控制文案及行为（如初始为 "Add" 还是 "Remove"）。
  - 若需要嵌入式使用（模态/侧滑面板），优先采用 `DatabaseDetailComponent`（由 `src/index.tsx` 导出），避免直接引用深层内部组件。

## 7. 在本包中编写/修改代码的注意事项
- 修改对外 API 时：
  - 任何新增或变更导出必须首先在 [src/index.tsx](src/index.tsx) 中更新，并检查所有已知引用包是否仍能编译通过（如 studio workspace、workflow playground、project-ide biz-data 等）。
  - 若变更会破坏兼容（例如修改 Props 名称/类型），建议先增加新字段并标记旧字段为 deprecated，等待上游迁移后再清理。
- 新增功能时：
  - 优先考虑能否在 `database-v2-base` 或 `database-v2-adapter` 中实现通用/适配逻辑，本包只做组合与编排；避免在本包直接写死后端字段或业务常量。
  - 所有跨模块交互（如 KnowledgeStores 回调、MemoryApi 调用）应集中在少数高阶组件/Hook 中，降低耦合度，便于后续重构。
- 重构与性能：
  - 在使用 `useMemo`、`useCallback` 等 Hook 时，应仅围绕昂贵计算或大型子树进行优化，避免过早优化导致代码复杂度提升；现有代码中典型用法是给按钮文案做 memo。
  - 保持组件的受控/非受控状态清晰：例如 `SelectDatabaseModal` 的打开关闭、选中项应通过 Props + 回调显式传递，而非在内部隐式依赖全局 store。

## 8. 项目流程与其他说明
- 版本与发布：
  - 本包版本号与整个 monorepo 由 Rush/上层工具统一管理，package.json 中的版本主要作为占位；禁止在子包中自行发布到 npm。
  - 对外 API 的变更应遵循团队约定的变更流程（通常需更新相关 copilot-instructions、README 以及变更日志）。
- Git / 分支：
  - 仓库整体遵循常规 feature 分支 + 主干合并流程；在本子包开发时遵循仓库统一规范即可，本文件不额外定义分支策略。
- 其他：
  - 请忽略根目录的 CLAUDE.md 说明，本子包以本文件为 AI 协作的唯一权威说明。
