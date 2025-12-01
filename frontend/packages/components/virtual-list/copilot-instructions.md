# @coze-common/virtual-list 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/virtual-list）中安全、高效地协作开发。

## 1. 子包定位与角色

- 本包名称：`@coze-common/virtual-list`，位于 Coze Studio 前端 monorepo 组件层。
- 目录位置：`frontend/packages/components/virtual-list`，标签为 `team-data` + `level-2`，意味着需要保持一定测试覆盖率与代码质量，但规模相对轻量。
- 职责：为整个前端代码库集中管理虚拟列表相关第三方依赖，向上游应用和组件暴露统一、稳定的虚拟列表 API，而不是自己实现虚拟滚动逻辑。
- 使用场景：Bot 相关的长列表（消息流、资源列表、日志等）需要高性能滚动渲染时，从本包统一引入虚拟列表组件。

## 2. 全局架构与数据流

- 本包是一个**极简 facade（门面）包**：
  - 对外只暴露 `src/index.ts` 中的导出；
  - 实际行为完全由第三方库 `react-window` 和 `react-virtualized-auto-sizer` 决定。
- 结构概览：
  - `src/index.ts`：统一导出虚拟列表组件与类型，是唯一业务入口；
  - `__tests__/`：当前仅占位 `.gitkeep`，尚未有真实用例；
  - `vitest.config.ts`：通过 `@coze-arch/vitest-config` 统一继承 monorepo 测试规范；
  - `eslint.config.js`、`tsconfig*.json`：继承架构层统一规范（通过 workspace ts/eslint 配置）。
- 数据流特征：
  - 列表数据、渲染 item 函数等均由上层业务传入 `FixedSizeList` / `VariableSizeList`；
  - 本包不持有任何状态、不做数据加工，只负责**类型与 API 的转发**；
  - AutoSizer 负责根据容器大小计算列表渲染区域，本包仅 re-export `default as AutoSizer`。
- 设计动机：
  - 在大型 monorepo 中统一第三方虚拟列表依赖，避免多处直接引用形成版本/行为分裂；
  - 外部代码只依赖 `@coze-common/virtual-list`，方便未来替换底层实现（例如切换到其他虚拟列表库）而不侵入业务代码。

## 3. 源码结构与关键文件

- `package.json`
  - `name`: `@coze-common/virtual-list`。
  - `main`: `src/index.ts`（注意是源码入口，构建由上层工具负责）。
  - `scripts`：
    - `build`: `exit 0` —— 当前不在包内执行真实构建，依赖 monorepo 的统一打包流程；
    - `lint`: `eslint ./` —— 使用根目录 ESLint 配置；
    - `test`: `exit 0` —— 测试入口占位，实际测试建议通过 rush/vitest 统一执行。
  - `dependencies`：
    - `react-window`: 核心虚拟列表实现；
    - `react-virtualized-auto-sizer`: 自动根据容器尺寸计算列表尺寸。
  - `devDependencies`：仅包含统一的 lint/ts/test 配置和对应类型定义。
- `src/index.ts`
  - 导出内容：
    - `FixedSizeList`, `VariableSizeList` 以及其 Props 类型（`FixedSizeListProps`, `VariableSizeListProps`）直接来自 `react-window`；
    - `AutoSizer` 作为 `default` 导出，从 `react-virtualized-auto-sizer` re-export。
  - 约束：
    - 不在此文件中写业务逻辑，只做 re-export；
    - 如需新增虚拟列表能力，优先考虑继续以 re-export / 轻量包装的方式保持简单性。
- `vitest.config.ts`
  - 使用 `@coze-arch/vitest-config` 的 `defineConfig`：
    - `dirname`: 使用当前目录，保证测试根路径正确；
    - `preset: 'node'`：测试运行在 Node 环境；
    - `{ test: {} }`：可按需在本子包扩展，但默认遵循统一规则。

## 4. 开发与运行流程

> 注意：本包本身的 `build`/`test` 脚本是占位实现，真实工作流依赖前端 monorepo 顶层的 Rush + Rsbuild/Vitest 系统。

- 依赖安装（在 monorepo 根目录）：
  - `rush install` / `rush update`：安装和更新所有前端依赖。
- 本包开发步骤（推荐）：
  - 进入目录：`cd frontend/packages/components/virtual-list`；
  - 代码编辑：直接修改或扩展 `src/index.ts`，必要时新增内部实现文件（例如 `src/hooks/`、`src/components/`）；
  - Lint：
    - 在本目录运行：`pnpm lint` 或 `npm run lint`（具体根据 Rush/rushx 绑定）；
    - 或在上层通过 Rush 统一执行（例如 `rushx lint`，具体命令以根目录配置为准）。
- 测试工作流：
  - 当前 `npm test` 显式 `exit 0`，不会执行真实用例；
  - 如需在此包内编写测试：
    - 在 `__tests__/` 中新增 `*.test.ts(x)` 文件；
    - 根据 monorepo 顶层 Vitest 配置，通过 workspace 的统一测试命令运行（一般为 `rush test` 或 `rushx test`，以实际配置为准）。

## 5. 项目约定与模式

- 导出约定：
  - 对外 API 必须通过 `src/index.ts` 统一导出，避免上层代码直接依赖第三方包路径；
  - 如果新增导出（例如新的 list 组件或类型），务必保证：
    - 命名与上游库保持一致或明确的前缀；
    - 类型导出完整且与实现一一对应。
- 依赖管理：
  - 此包负责集中管理虚拟列表相关依赖版本：
    - 避免在其他子包重复直接依赖 `react-window` 或 `react-virtualized-auto-sizer`；
    - 如需升级依赖版本，应同步在本包 `package.json` 中修改，并通过 Rush 统一更新锁文件。
- TypeScript 与构建：
  - TypeScript 配置由 `@coze-arch/ts-config` 提供，保持统一严格性（例如严格空值检查等）；
  - `main` 指向 TS 源码文件，是因为 monorepo 的构建/打包会在更外层产生最终产物，AI 助手不需要单独在此包实现构建脚本。
- 代码风格：
  - 遵循根目录 ESLint 规则（`@coze-arch/eslint-config`）；
  - 由于本包代码量极小，新增代码时保持简洁、纯函数式写法，减少副作用。

## 6. 与外部组件/系统的集成

- 与 `react-window` 的集成：
  - 采用命名导出方式：`FixedSizeList`, `VariableSizeList`, 以及相应 Props 类型；
  - 上层组件使用示例：
    - `import { FixedSizeList } from '@coze-common/virtual-list';`；
    - 避免直接 `import { FixedSizeList } from 'react-window';`，否则会破坏统一升级能力。
- 与 `react-virtualized-auto-sizer` 的集成：
  - 使用默认导出 `AutoSizer`：`export { default as AutoSizer } from 'react-virtualized-auto-sizer';`；
  - 上层示例：
    - `import { AutoSizer, FixedSizeList } from '@coze-common/virtual-list';`；
  - 常见组合模式为：外层 `AutoSizer` 负责提供宽高，内层 `FixedSizeList`/`VariableSizeList` 使用该尺寸渲染。
- 与 monorepo 工具链的集成：
  - Vitest：通过 `@coze-arch/vitest-config` 继承统一测试约定；
  - ESLint/TSConfig：通过 workspace 依赖统一配置，AI 助手在修改 `tsconfig` 或 `eslint` 相关配置时，应优先查阅 `frontend/config/` 下的共享配置。

## 7. 团队流程与质量要求

- 质量等级：
  - 本包标记为 `level-2`，根据 `frontend/rushx-config.json`：
    - 覆盖率目标较基础包略低，但仍需保持一定测试覆盖率（当前包暂无真实测试文件，如新增逻辑应同步补充单元测试）；
    - 变更应通过最低限度的单元测试和 Lint 检查。
- 提交流程（推断自 monorepo 规范）：
  - 新增/修改对外 API 时：
    - 更新本包 `README.md` 中的 Exports/Usage 部分；
    - 考虑对使用本包的上层应用是否有影响，并在对应包中做兼容性调整；
  - 遵循 monorepo 全局的分支与提交策略（通常为 feature 分支 + CI 验证），AI 助手不应直接假设可以在主分支上推送。

## 8. 特色与注意事项

- 本包目前是**纯 re-export 包**：
  - 对新增逻辑应保持克制，首选仍然是提供更好的 re-export 或轻度封装；
  - 如必须加入自定义逻辑（例如通用的 ItemRenderer 封装），建议放在单独文件中实现，并在 `src/index.ts` 仅做导出。
- 构建与测试脚本为占位：
  - `build`、`test` 脚本当前不会执行真实动作，这是 monorepo 工具链设计的一部分；
  - AI 助手在自动修改脚本时需谨慎，避免破坏上层 Rush 工作流。
- 依赖升级影响面广：
  - 升级 `react-window` / `react-virtualized-auto-sizer` 版本前，应假定整个前端所有使用虚拟列表的地方都会受到影响；
  - 升级前后建议在关键列表场景进行人工/自动化回归测试。

## 9. AI 助手操作建议（仅基于现有事实）

- 在本包中可以安全做的事情：
  - 新增或调整导出的组件/类型，只要仍基于现有依赖库；
  - 为未来扩展预留类型别名或轻量工具函数，但不要引入与虚拟列表无关的职责；
  - 在 `__tests__/` 添加针对 re-export 行为的最小快照/类型测试，配合 monorepo 测试命令运行。
- 需要谨慎的操作：
  - 修改或删除已有导出名称（可能影响大量上游依赖）；
  - 调整 `package.json` 中的依赖版本，尤其是主版本号；
  - 自行增加复杂构建脚本，而不经过 monorepo 顶层配置协同。
