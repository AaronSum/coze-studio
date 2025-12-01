# @coze-data/knowledge-data-set-for-agent 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-data-set-for-agent）中安全、高效地协作开发。

## 全局架构与职责边界
- 本子包是一个「无 UI、仅状态」的前端数据子模块，核心是基于 `zustand` 的全局状态仓库，暴露给其他包使用。
- 对外唯一导出为 `src/index.tsx` 中的 `useDatasetStore`，实际实现位于 `src/store/data-set.ts`，请保持该导出路径稳定，避免破坏依赖方（例如 agent-ide 相关包）现有引用。
- `useDatasetStore` 使用 `@coze-arch/idl/knowledge` 中的 `Dataset` 类型，代表「知识数据集」实体列表，是与后端/IDL 约定的一部分，扩展字段时必须保持类型兼容性。
- 状态结构：
  - `dataSetList: Dataset[]`：当前可用的数据集列表。
  - `setDataSetList(dataSetList: Dataset[])`：完整覆盖式写入，不做增删改的细粒度操作；如需更复杂操作，应先在调用方构造好新的数组再传入。
- Store 通过 `zustand/middleware/devtools` 包装，在开发模式下会向 Redux DevTools 暴露 `Coze.Agent.Dataset` 名称空间，方便调试；生产环境不会启用 devtools。
- README 中的「react component template」描述已与当前实现略有偏差，本包实际更像「数据 store 包」，新增能力时优先保持「轻 UI / 重数据」的定位。

## 关键开发流程（构建 / 测试 / 调试）
- 包管理与安装
  - 由 Rush + pnpm 统一管理，首次或依赖更新后在仓库根目录执行：`rush update`。
  - 本子包本身不直接运行 `pnpm install`，请遵循工作区的 Rush 流程。
- 构建
  - 本包 `package.json` 中 `build` 脚本目前为 `exit 0`，即构建为空操作：
    - 在整体仓库构建时，本包不会产出独立构建产物，仅作为 TypeScript 源码供其他包消费。
    - 如后续需要真正的打包/编译流程，应在 `package.json` 和相关 `tsconfig.build.json` 中补充，但请先对齐团队规范（参考其他 data/* 包）。
- 测试
  - 测试框架：Vitest，项目级配置在 `vitest.config.ts`，通过 `@coze-arch/vitest-config` 统一封装，preset 使用 `web`。
  - 运行单元测试：在仓库根目录使用 Rush 脚本（例如 `rushx test --to @coze-data/knowledge-data-set-for-agent`，以实际脚本为准），或在包目录下运行：`npm run test`。
  - 生成覆盖率：`npm run test:cov`。
  - 当前 `__tests__/` 目录仅有 `.gitkeep`，新增测试文件建议与 `src/store/data-set.ts` 一一对应（例如 `__tests__/data-set.test.ts`），并覆盖：初始 state、`setDataSetList` 行为以及与 DevTools 的基本交互（如 action 名称）。
- 调试
  - Zustand store 可通过浏览器 Redux DevTools 进行观察：
    - Store 名称：`Coze.Agent.Dataset`。
    - `setDataSetList` 调用会以对应 action 名字上报，便于排查某次列表变化来源。
  - 依赖本包的上层 UI（例如 agent-ide 相关包）会在运行时调用 `useDatasetStore`，调试数据流时通常从这些包的组件/Hook 入手（例如 prompt/space-bot 等使用方）。

## 项目内约定与代码风格
- 类型与 IDL 对齐
  - 所有数据集实体均使用 `@coze-arch/idl/knowledge` 的 `Dataset` 类型，不在本包自行定义重复类型；如需扩展字段，应从 IDL 源头统一修改。
  - 避免在 store 中引入与 UI 强耦合的类型或字段（例如纯展示用的本地 state），这类逻辑更适合放在上层 UI 包中。
- Store 设计约定
  - 仅暴露一个全局 store Hook：`useDatasetStore`。
  - 当前 store 专注于「读/写完整列表」的最小能力：
    - 复杂操作（筛选、分页、合并等）交给调用方处理，保持 store 简单、可预测。
    - 若确实需要更多 action（如 `appendDataSet`, `removeById`），请确保：
      - Action 命名清晰且与 DevTools 日志一致（第三个参数为 action 名称）。
      - 不破坏现有调用方对 `setDataSetList` 的使用假设。
- DevTools 与环境开关
  - `devtools` 中使用 `enabled: IS_DEV_MODE`，其中 `IS_DEV_MODE` 是由上层环境/打包器注入的全局常量：
    - 在新增依赖或调整配置时，避免直接在本包内读取 `process.env.NODE_ENV`，应继续复用/依赖统一注入的常量机制。
- 文件与目录
  - 核心逻辑集中在 `src/store/data-set.ts`，如新增 store 或拆分逻辑，应保持 `src/index.tsx` 仅做窄出口导出，避免在 index 中堆积实现细节。
  - 类型补充（例如全局声明）统一放在 `src/typings.d.ts`，不要在多个文件中重复声明全局类型。

## 重要依赖与集成点
- `zustand` 与 `zustand/middleware/devtools`
  - 用于创建全局 store，并在开发环境中与 Redux DevTools 集成。
  - 新增字段或方法时，要确保 state 更新是不可变的（通过 `set` 传入新对象/数组），以便 DevTools 能正确记录变更。
- `@coze-arch/idl/knowledge`
  - 提供 `Dataset` 类型，是与后端服务和其他前端模块共享的契约：
    - 不要在本包中随意修改 `Dataset` 结构；如有变更需求，请联动 IDL 定义所在仓库/目录。
  - 如果 IDL 变更导致类型不兼容，请先更新本包，再按需调整依赖方（例如 prompt、space-bot 等）。
- 上游使用方（仅列出与本包紧耦合的典型包）
  - `frontend/packages/agent-ide/prompt`：通过 `useDatasetStore` 读取/更新数据集，用于 Prompt 相关能力；调整 store 结构或行为前需关注这里的调用方式。
  - `frontend/packages/agent-ide/space-bot`：在「单 Agent 模式」下展示/配置数据集；`useDatasetStore` JSDoc 中提到的 "Only works in bot single agent mode" 对此有语义约束，新增行为时不要破坏该假设。

## 开发流程与团队协作规范
- 代码风格与 Lint
  - 使用 `eslint.config.js` 与 `@coze-arch/eslint-config` 统一规则，提交前建议在包目录下执行：`npm run lint` 或通过仓库级别的 Rush 脚本执行 lint。
  - 样式相关虽然本包暂未包含样式文件，但仍引入了 `@coze-arch/stylelint-config` 与 `.stylelintrc.js`，未来如新增样式文件（CSS/LESS 等），请遵循统一 Stylelint 规范。
- TypeScript 配置
  - `tsconfig.json` 与 `tsconfig.build.json`、`tsconfig.misc.json` 组合使用：
    - `tsconfig.json`：开发时的基础配置。
    - `tsconfig.build.json`：构建/类型检查时的配置入口，供其他包 `references` 使用。
    - `tsconfig.misc.json`：可能用于额外脚本/工具链，修改前建议对比其他 data 包做法。
  - 在修改 `tsconfig` 时，避免破坏项目引用关系（例如被其他包通过 `path` 引用）。
- 测试与覆盖率
  - 尽量为 store 行为增加单元测试（包括边界情况，如空数组、重复数据集等），以防止未来重构时引入回归。
  - 使用 `@testing-library/react-hooks` 进行 Hook 级别的测试会更贴近真实使用方式（虽然当前包主要是 Zustand store，但仍可在测试中通过 Hook 形式访问）。

## 项目中不常见或需要注意的特性
- 本包 intentionally 轻量：
  - `build` 脚本为 no-op，说明当前阶段主要关注类型与运行时代码供工作区直接消费，而非单独发布编译产物。
  - 这在 monorepo 中较少见，但与其他「data store」性质的包保持一致即可；新增构建流程前请确认是否真的需要发版或产出 bundle。
- DevTools 名称与单 Agent 模式约定：
  - DevTools 名称固定为 `Coze.Agent.Dataset`，这是跨团队调试时常用的定位关键字，请勿随意更改；如必须修改，请同步更新相关调试文档或工具。
  - 注释中强调「Only works in bot single agent mode」，说明本 store 当前假设运行环境为单 Agent；在多 Agent 场景下复用时，要么新增独立 store，要么通过命名空间/作用域扩展，而不是直接在现有 store 上叠加多 Agent 语义。
- 全局常量 `IS_DEV_MODE` 来自上层构建环境：
  - 这是本仓库中特有的模式，依赖于统一的打包链路与环境注入；在迁移/抽离本包到其他仓库时，需要特别注意为其注入等价的常量，否则 DevTools 可能异常。

## 面向 AI 助手的具体协作建议
- 在本子包中进行修改或新增功能时，请优先遵循以下顺序：
  1. 识别是否需要改动 `Dataset` 类型或 IDL，如果需要，请仅在相关 IDL 工程内变更，并在本包中同步引用；不要在此处重新定义结构。
  2. 对于新状态或行为，优先在 `src/store/data-set.ts` 内集中实现，并通过 `src/index.tsx` 暴露最小必要导出。
  3. 调整 store API 时，检查所有使用方（至少包括 prompt 与 space-bot 相关包）是否需要同步修改。
  4. 为新增行为添加或更新测试（Vitest），并确保 `npm run test` 通过。
- 在自动生成代码前，请避免：
  - 修改 `package.json` 中的包名、入口字段或主要脚本，除非明确要与现有工作流对齐。
  - 重命名或删除 `useDatasetStore`，因为这是跨包依赖的公共接口。
  - 引入与本包定位不符的复杂 UI 组件或业务逻辑，建议将其放在上层 feature/应用包中。
