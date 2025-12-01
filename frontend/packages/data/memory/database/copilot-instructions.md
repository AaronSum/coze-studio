# @coze-data/database 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/memory/database）中安全、高效地协作开发。

## 全局架构概览

- 本子包是前端 monorepo 中的一个 React 组件库包，包名为 `@coze-data/database`，主要职责是为数据记忆（memory）调试能力提供 UI 组件和相关工具函数。
- 入口文件为 [src/index.ts](src/index.ts)，集中导出以下能力：
  - 记忆调试弹窗：`useMemoryDebugModal` / `MemoryDebugDropdown` / `VariableDebug` / `DatabaseDebug` 等组件和类型。
  - 数据库调试核心组件：`DatabaseDebug`、`MultiDataTable`、`DataTableRef`，围绕 bot 的 databaseList 渲染多表视图。
  - 统计事件相关 hook：`useSendTeaEventForMemoryDebug` 用于上报 memory 相关埋点。
  - 类型与工具：`MemoryModule`、`MemoryDebugDropdownMenuItem` 以及通用时间格式化工具 `formatDate`。
- 组件结构大致分为：
  - `src/components/database-debug/*`：数据库调试主界面、多表视图和单表组件，是和业务数据交互最紧密的部分。
  - `src/components/memory-debug-modal/*`：承载调试能力的弹窗入口。
  - `src/components/memory-debug-dropdown/*`：在页面上以下拉菜单形式切换不同 Memory 模块。
  - `src/components/filebox-list/*`：与 Filebox 相关的记忆视图，并通过 `UseBotStore` 类型向外暴露状态约束。
  - `src/hooks/use-send-tea-event-for-memory-debug.ts`：统一封装 memory 调试相关的 TEA 埋点逻辑。
  - `src/types.ts`：集中维护 Memory 模块枚举和值结构。
  - `src/utils/index.ts`：本包内的通用工具函数（目前仅包含时间格式化）。
- 本包与其他子包的主要交互：
  - 借助 `@coze-studio/bot-detail-store` 的 Zustand store 读取 bot 信息、database 列表等业务数据（见 [src/components/database-debug/index.tsx](src/components/database-debug/index.tsx)）。
  - 调用 `@coze-arch/bot-tea` 上报埋点事件（见 [src/hooks/use-send-tea-event-for-memory-debug.ts](src/hooks/use-send-tea-event-for-memory-debug.ts)）。
  - 使用 `@coze-arch/coze-design`、`@douyinfe/semi-*` 等 UI/图标库构建 UI（具体可在 `src/components/**` 内查看）。

## 构建、测试与本地开发工作流

- 包管理与 monorepo：前端整体由 Rush 管理，当前包配置在根目录 [frontend/rushx-config.json](../../rushx-config.json)，标签为 `team-data` + `level-3`。
- 安装依赖：在 frontend 根目录执行 `rush update` 完成 monorepo 依赖安装和链接。
- 单包脚本（在 [package.json](package.json) 中定义）：
  - `npm run build`：目前实现为 `exit 0`，实际构建由上层统一 rollup 任务驱动；如需本地验证打包逻辑，请直接调用 `rollup -c rollup.config.mjs` 或参考项目通用构建脚本。
  - `npm run lint`：使用 `@coze-arch/eslint-config`，入口为 [eslint.config.js](eslint.config.js)。在修改 TSX/TS 前后应运行以保证风格一致。
  - `npm run test`：使用 Vitest，通过 [vitest.config.ts](vitest.config.ts) 和 `@coze-arch/vitest-config` 统一配置，环境为 `happy-dom`，适用于组件与 hooks 的单元测试。
  - `npm run test:cov`：在基础测试上开启覆盖率统计。
- Storybook：目录 [.storybook](.storybook) 已预置相关配置（如存在），用于组件开发与可视化调试；请优先复用现有 Storybook 约定（如 CSF 写法、stories 目录结构）。
- 打包配置：
  - 使用 [rollup.config.mjs](rollup.config.mjs) 产出 ESM 与 UMD 包，UMD 在 CI 环境下默认关闭以加快速度（通过 `CI === 'true'` 控制）。
  - ESM 构建会通过 `node-externals` 将 devDeps/peerDeps/deps 外置，UMD 构建则内联所有依赖，用于直接在页面环境运行。
  - 统一使用 `rollup-plugin-ts` + SWC（`transpiler: 'swc'`），tsconfig 指向 [tsconfig.build.json](tsconfig.build.json)。
- Tailwind 与样式：
  - 采用 `postcss` + `tailwindcss` + `autoprefixer`，并开启 CSS Modules（`autoModules: true`，类名模式 `[name][local]_[hash:base64:5]`）。
  - 组件样式一般放在与组件同名的 `index.module.less` 中，通过 `import styles from './index.module.less';` 方式使用。

## 项目内特有模式与约定

- 导出约定：
  - 所有对外能力应从 [src/index.ts](src/index.ts) 统一导出，以便通过包名或 `package.json.exports` 使用；新增组件时务必更新该文件和 `exports`/`typesVersions`。
  - `package.json` 中的 `exports` 与 `typesVersions` 同步维护，例如 `./multi-table` 指向 [src/components/database-debug/multi-table.tsx](src/components/database-debug/multi-table.tsx)。
- Memory 模块枚举：
  - 所有 memory 类型应使用 [src/types.ts](src/types.ts) 中的 `MemoryModule` 枚举。目前包含 `Variable`、`Database`、`LongTermMemory`、`Filebox`，新增类型请在此集中维护，并同步到相关 UI（如下拉菜单）。
  - 下拉菜单项使用 `MemoryDebugDropdownMenuItem` 描述，每个项需要提供 `label`、`name`（枚举值）、`icon` 与 `component`，便于统一渲染。
- 埋点与路由参数：
  - 记忆调试埋点统一通过 [src/hooks/use-send-tea-event-for-memory-debug.ts](src/hooks/use-send-tea-event-for-memory-debug.ts) 完成，封装了 `sendTeaEvent(EVENT_NAMES.memory_click_front, ...)`。
  - Hook 会从 `react-router-dom` 的 `useParams<DynamicParams>()` 获取 `bot_id` / `product_id`，并根据 `isStore` 参数区分来自 bot 详情页还是 store 详情页。调用方只需传入 `isStore` 与 `type`，其余参数通过 `extraParams` 扩展。
  - `resourceTypeMaps` 中的 key（如 `longTimeMemory`、`database` 等）为现存上报约定，不要随意修改；需要新增类型时，需同时与服务端事件定义对齐。
- 状态管理：
  - 使用 Zustand（`zustand/react/shallow`）从跨包 store 中选择需要的字段，避免多余渲染（参考 [src/components/database-debug/index.tsx](src/components/database-debug/index.tsx)）。
  - 内部如需新增局部状态，更推荐使用 React hooks（`useState`/`useReducer`/`useMemo` 等），只在确有跨组件共享需求时考虑新建 store。
- 时间处理：
  - 统一通过 [src/utils/index.ts](src/utils/index.ts) 的 `formatDate(v, template)` 格式化时间；`v` 为 Unix 秒时间戳（`dayjs.unix(v)`），默认模板为 `YYYY/MM/DD HH:mm:ss`。避免在组件中直接调用 `dayjs()` 以保持展示一致性。

## 重要组件与外部依赖集成细节

- `DatabaseDebug`（[src/components/database-debug/index.tsx](src/components/database-debug/index.tsx)）：
  - 职责：作为数据库调试入口，根据当前 bot 的 `databaseList` 渲染多表调试视图。
  - 数据来源：
    - `botID` 来自 `useBotInfoStore(state => state.botId)`。
    - `databaseList` 来自 `useBotSkillStore`，使用 `useShallow` 优化选择器以减少渲染。
  - 渲染：将 `botID` 与 `databaseList` 传递给内部 `MultiTable` 组件。
- `MultiDataTable`（[src/components/database-debug/multi-table.tsx](src/components/database-debug/multi-table.tsx)）：
  - 通过包主入口以默认导出形式暴露，用于在外部场景中按需渲染多表视图。
  - 组件内部通常会组合 `DataTable` 子组件以及分页、筛选等交互（实现细节请参考具体源码）。
  - 对外通过 `DataTableRef` 类型（[src/components/database-debug/table](src/components/database-debug/table)）约定可控方法，例如刷新数据、滚动定位等。
- `MemoryDebugDropdown` 与 `MemoryDebugModal`：
  - `MemoryDebugDropdown` 提供一个菜单入口，让用户在 Variable / Database / LongTermMemory / Filebox 等模块间切换；新增模块时，应在对应组件中扩展菜单项。
  - `MemoryDebugModal` 负责弹窗逻辑，内部组合上述模块组件；对外通常提供 `useMemoryDebugModal` 或显式组件控制开关。
- `FileboxList`（[src/components/filebox-list](src/components/filebox-list)）：
  - 目前在 `src/index.ts` 中的导出被注释（`// export { FileBoxList } ...`），但仍通过 `UseBotStore` 类型对外共享状态规范。
  - 在修改或重新启用该组件前，应检查与 `@coze-common/chat-area-plugin-message-grab` 等相关依赖的契约，避免破坏外部集成。
- UI 与设计体系：
  - 本包依赖 `@coze-arch/coze-design`、`@douyinfe/semi-icons` 等组件库；新组件应优先使用这些内建 UI，而不是自行造轮子。
  - 若需要新增色板或尺寸，请优先在设计体系组件中查找已有 token，再考虑局部样式覆盖。

## 工程与质量规范

- ESLint：
  - 配置入口为 [eslint.config.js](eslint.config.js)，通过 `@coze-arch/eslint-config` 统一定义规则，preset 为 `web`。
  - 修改规则时应谨慎，仅针对特定本包特殊需求做最小变更；如果是通用规则，应在架构层统一调整而不是在子包内重复配置。
- TypeScript：
  - 顶层 [tsconfig.json](tsconfig.json) 以 `composite: true` 和 `references` 形式拆分为构建配置与杂项配置：
    - [tsconfig.build.json](tsconfig.build.json)：用于 rollup 构建，保证输出类型与 JS 一致。
    - [tsconfig.misc.json](tsconfig.misc.json)：可用于测试、Storybook 或其他非构建场景。
  - 新增源文件时，请确保路径被包含在相应 tsconfig 的 `include` 中（如有配置）。
- 测试：
  - 测试文件统一放在 [__tests__](__tests__) 目录或与组件同级的 `*.test.ts(x)` 中。
  - 利用 `@testing-library/react` 和 `@testing-library/react-hooks` 进行渲染与交互测试，Vitest 作为测试运行器。
  - 对交互复杂或与外部 store/埋点交互较多的组件，应优先补测试用例（如 Memory 下拉菜单、数据库多表视图等）。
- 代码覆盖率：
  - 在全局 [rushx-config.json](../../rushx-config.json) 中，本包标签 `level-3` 的覆盖率门槛目前为 0，但依然推荐为关键逻辑添加测试，避免回归。

## 协作流程与注意事项

- Commit / 分支策略：
  - 本仓库整体策略在根目录文档（如 CONTRIBUTING.md、CODE_OF_CONDUCT.md）中统一约定，本子包不单独定义分支策略；在编写自动化说明时，可假设使用常见 feature 分支 + PR 流程。
  - 在对公共导出（`src/index.ts`、`package.json.exports`、`typesVersions`）进行修改时，应在 PR 描述中明确说明，以便其他使用方同步调整。
- 变更兼容性：
  - `@coze-studio/bot-detail-store`、`@coze-arch/bot-tea` 等为跨包核心依赖，变更使用方式前请先在代码中搜索相关用法，确认不会破坏其他包的假设。
  - 若需要调整事件名称或埋点字段，请与数据/埋点负责人确认，并在 `EVENT_NAMES` 与服务端事件定义保持一致。
- AI 助手协作建议（给代理看的、不暴露给终端用户）：
  - 对于看起来“没被使用”的导出，优先在 monorepo 内全局搜索确认再删除，避免误删给其他子包使用的导出（例如 `UseBotStore` 类型）。
  - 修改 `useSendTeaEventForMemoryDebug` 时关注文件中的 TODO 注释（例如关于 store 复用的说明），避免根据“未使用”误做重构。
  - 在不确定某个枚举值或字段是否有外部依赖时，宁可保持不变或新增字段，也不要重命名已有字段。
