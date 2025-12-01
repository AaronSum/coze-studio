# Copilot Instructions - @coze-agent-ide/memory-tool-pane-adapter

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/memory-tool-pane-adapter）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包是 Agent IDE 中“记忆工具面板”的前端适配层，仅负责将上游状态（Bot 详情、数据库、变量等）装配为基础组件可消费的 `menuList` 配置，不直接承担数据拉取或写入逻辑。
- 入口文件为 [src/index.ts](src/index.ts)，仅导出 React 组件 `MemoryToolPane`，方便在其他子包中通过 `@coze-agent-ide/memory-tool-pane-adapter` 统一引用。
- 核心实现位于 [src/components/memory-tool-pane/index.tsx](src/components/memory-tool-pane/index.tsx)：
  - 依赖 `@coze-agent-ide/space-bot/component` 中的基础 UI 组件 `MemoryToolPane`（此处命名为 `BaseComponent`），本包本质上是“业务数据到基础组件的适配器”。
  - 通过 `@coze-studio/bot-detail-store` 提供的 zustand store 读取当前 Bot 的 `databaseList` 和 `variables`，以及当前页面来源 `pageFrom`。
  - 使用 `@coze-data/database` 提供的 `DatabaseDebug`、`VariableDebug` 组件和 `MemoryModule` 枚举来构造调试菜单项。
  - 使用 `@coze-arch/i18n` 和 `@coze-arch/coze-design/icons` 构造本地化文案和图标。
- 数据流总体结构：
  - 上游：Bot 详情 store（数据库列表、变量列表、页面来源等） + 数据调试模块组件。
  - 适配层：本包，根据上游状态决定菜单项是否展示，并把这些菜单项传给基础 UI 组件。
  - 下游：`@coze-agent-ide/space-bot/component` 的 `MemoryToolPane` 负责实际 UI 渲染和交互行为。
- 架构动机：将“菜单项启用逻辑 + 业务模块组合”集中在一个 adapter 包中，保持基础组件纯 UI、可复用，同时避免在多个页面重复拼装菜单列表。

## 关键源码与模式

### MemoryToolPane 组件

- 组件文件： [src/components/memory-tool-pane/index.tsx](src/components/memory-tool-pane/index.tsx)
- 关键依赖：
  - 状态：`useBotSkillStore`（读取 `databaseList`, `variables`），`usePageRuntimeStore`（读取 `pageFrom`）。
  - 类型与常量：`BotPageFromEnum.Store` 用于判断当前是否为“商店”场景。
  - 数据模块：`DatabaseDebug`、`VariableDebug`、`MemoryModule`、`MemoryDebugDropdownMenuItem` 来自 `@coze-data/database`。
  - UI：`IconCozVariables`, `IconCozDatabase`，以及 `I18n.t` 国际化。
- 内部类型：
  - `EnhancedMemoryDebugDropdownMenuItem` 通过扩展 `MemoryDebugDropdownMenuItem` 增加 `isEnabled` 字段，用于内部控制是否展示。
- 菜单构造逻辑：
  - 使用 `useMemo` 生成 `menuList`，依赖项为 `variables.length`、`isFromStore`、`databaseList.length`，避免不必要的重算。
  - 菜单项包含：
    - 变量调试：
      - `name: MemoryModule.Variable`
      - `component: <VariableDebug />`
      - `isEnabled: Boolean(variables.length && !isFromStore)` —— 只有在存在变量且当前页面不是 Store 时才展示。
    - 数据库调试：
      - `name: MemoryModule.Database`
      - `component: <DatabaseDebug />`
      - `isEnabled: Boolean(databaseList.length && !isFromStore)` —— 有数据库且非 Store 页面时展示。
  - 通过 `list.filter(item => item.isEnabled)` 过滤出最终传给基础 UI 的 `menuList`。
- 渲染：
  - 最终返回 `<BaseComponent menuList={menuList} />`，不在本包内处理具体交互。

### 包入口与类型

- 入口： [src/index.ts](src/index.ts)
  - 仅做命名导出：`export { MemoryToolPane } from './components/memory-tool-pane';`。
  - 新增对外 API 时，应在该文件集中导出，保持公共接口清晰。
- 类型声明： [src/typings.d.ts](src/typings.d.ts)（如后续有扩展）
  - 当前可用于放置全局类型或模块声明，避免在源码中到处声明 `declare module`。

## 构建、测试与调试工作流

- 包管理采用 Rush + pnpm monorepo 管理：
  - 在仓库根目录执行 `rush update` 初始化依赖（参见仓库 README 与本包 [config/rush-project.json](config/rush-project.json)）。
- 本子包自身 `package.json` 中定义的脚本：
  - `npm run build`
    - 当前实现为 `exit 0`（占位，构建逻辑由上层统一工具链负责）。不要在本包内期望构建产物输出目录。
  - `npm run lint`
    - 调用 `eslint ./ --cache`，规则继承自 `@coze-arch/eslint-config`，适配 React + TS + monorepo 约定。
  - `npm run test`
    - 使用 `vitest --run --passWithNoTests` 执行单元测试，测试配置位于 [vitest.config.ts](vitest.config.ts)，通过 `@coze-arch/vitest-config` 的 `defineConfig({ dirname: __dirname, preset: 'web' })` 复用统一前端测试预设。
  - `npm run test:cov`
    - 在 `test` 基础上加 `--coverage` 生成覆盖率报告。
- Storybook（如有使用）：
  - 本包带有 Storybook 配置 [./.storybook/main.js](.storybook/main.js) 与 [./.storybook/preview.js](.storybook/preview.js)，用于本地调试 UI 组件。
  - 具体启动命令不在本包 `package.json` 中定义，通常在仓库级或脚手架中统一定义；需要时请查阅 frontend 目录下的说明或脚本。
- 推荐开发步骤（在仓库根目录）：
  - 安装依赖：`rush update`
  - 跑测试（仅当前包）：在本子包目录执行 `npm test` 或通过 Rush 选择性运行（参考根目录 Rush 文档）。

## 项目约定与模式

- 技术栈：
  - React 18 函数组件，hooks 风格，无 class 组件。
  - 状态管理统一使用 `zustand`，配合 `useShallow` 以减少渲染次数，不在组件内部创建新的 store。
  - UI 与 i18n 均来自统一的 `@coze-arch/*` 包，禁止在本包内引入额外 UI 库或自行实现 i18n。
- 命名与结构：
  - 组件统一放在 `src/components/<name>` 下，按功能拆分子目录；入口 `src/index.ts` 只做聚合导出。
  - 对外暴露的组件使用 PascalCase，例如 `MemoryToolPane`。
  - 与外部模块对接时（如 `@coze-data/database`），使用其已定义的类型/枚举（例如 `MemoryModule`），避免在本包中重复定义常量或字符串字面量。
- 条件展示逻辑：
  - 与“商店 / 非商店”场景相关的逻辑统一以 `BotPageFromEnum` 的枚举值来判断，不使用硬编码字符串。
  - `isEnabled` 逻辑集中在本包，基础 UI 组件只消费过滤后的菜单列表。
- 国际化：
  - 所有展示性文案通过 `I18n.t(key)` 读取，键名如 `variable_name`、`db_table_data_entry` 必须在上游 i18n 资源中存在；不要在本包内写死文案。

## 外部依赖与集成细节

- `@coze-agent-ide/space-bot/component`：
  - 提供基础 `MemoryToolPane` UI 组件，本包向其传入 `menuList` 数组，具体字段遵循 `MemoryDebugDropdownMenuItem` 类型约定（图标、文案、模块名、内容组件等）。
- `@coze-studio/bot-detail-store`：
  - `useBotSkillStore`：暴露 `databaseList` 与 `variables`，用于判断是否展示各类调试菜单。
  - `usePageRuntimeStore`：暴露 `pageFrom`，用于判断当前页面来源（例如 Store）。
- `@coze-data/database`：
  - `VariableDebug` / `DatabaseDebug`：真正实现变量、数据库的调试 UI 与逻辑。
  - `MemoryModule`：标识具体记忆模块类型（变量 / 数据库），用于和基础组件的行为对齐。
  - `MemoryDebugDropdownMenuItem`：菜单项类型定义，本包在其基础上增加内部字段 `isEnabled`。
- `@coze-arch/i18n`：
  - `I18n.t(key)`：统一的国际化接口，确保文案可随全局语言切换。
- `@coze-arch/coze-design/icons`：
  - `IconCozVariables`、`IconCozDatabase`：统一的设计体系图标，保证 IDE 视觉一致性。

## 开发流程与协作规范

- 代码风格：
  - 使用仓库统一的 ESLint / Stylelint / TSConfig 配置（参见本包根目录的 `eslint.config.js`、`.stylelintrc.js`、`tsconfig.json`）。
  - 新增文件时遵循已有文件的导入顺序、React 组件书写方式和类型标注风格。
- Git / 分支：
  - 具体分支策略在仓库根部文档中约定（README、CONTRIBUTING 等）；本包不额外引入自定义流程。
  - 在修改本包前，建议在 feature 分支上工作，并运行至少 `npm run lint` 与 `npm test` 确保不破坏现有行为。
- Storybook / 预览：
  - 如果需要添加或修改 UI 行为，可以在 `.storybook` 下增补 stories，并通过仓库统一的 Storybook 启动命令进行验证。

## 特殊注意事项

- 本包不负责数据的增删改查，只负责“是否展示某个调试入口”以及“将正确的调试组件挂到菜单项上”；任何实际数据操作应在 `@coze-data/database` 或上游 store 中完成。
- 当引入新的记忆模块（例如向 `MemoryModule` 增加新的类型）时，应：
  - 首先在 `@coze-data/database` 中完成模块及类型扩展；
  - 然后在本包中扩展 `EnhancedMemoryDebugDropdownMenuItem` 列表，增加对应菜单项，并按业务规则设置 `isEnabled` 条件。
- 为了保持适配层的轻量和可维护性，不建议在本包内增加复杂业务逻辑（如多步异步调用、错误提示等），这类逻辑应放在上游 store 或独立 service 中。
