# @coze-workflow/sdk 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/sdk）中安全、高效地协作开发。

## 1. 子包定位与整体架构
- 本包位于 monorepo 中的路径：frontend/packages/workflow/sdk，对应 npm 包名 `@coze-workflow/sdk`，主要作为 **对外 SDK 门面层**。
- 该包不直接实现复杂领域逻辑，而是对其它内部包进行 **轻量封装和统一导出**：
  - 从 `@coze-workflow/base` 引入工作流 Schema / 节点结果相关的核心类型与提取器实现。
  - 从 `@coze-workflow/components` 引入表达式编辑器（ExpressionEditor）相关的组件、Hook 和类型。
- 源码集中在 [frontend/packages/workflow/sdk/src](frontend/packages/workflow/sdk/src)：
  - [src/index.ts](frontend/packages/workflow/sdk/src/index.ts)：SDK 统一导出入口，是对外 API 的主要对接点。
  - [src/utils/schema-extractor.ts](frontend/packages/workflow/sdk/src/utils/schema-extractor.ts)：对 `@coze-workflow/base` 中 `SchemaExtractor` 的轻量包装。
  - [src/utils/node-result-extractor.ts](frontend/packages/workflow/sdk/src/utils/node-result-extractor.ts)：对 `NodeResultExtractor` 的轻量包装。
  - [src/utils/index.ts](frontend/packages/workflow/sdk/src/utils/index.ts)：收拢并导出本包的 util 函数。
- 架构理念：
  - **分层**：base 负责领域算法与数据模型，components 负责 React UI / 编辑器，这个 sdk 包负责对外“收口”；避免外部调用方直接依赖多个内部包。
  - **稳定 API 面**：通过简单函数和类型 re-export，给上层产品或第三方集成一个相对稳定的能力入口，减少未来内部重构对调用方的影响。

## 2. 关键导出与数据流
- `schemaExtractor(params)`（[schema-extractor.ts](frontend/packages/workflow/sdk/src/utils/schema-extractor.ts)）
  - 入参：`{ schema: WorkflowJSON; config: SchemaExtractorConfig; }`，均来自 `@coze-workflow/base` 类型。
  - 内部行为：`new SchemaExtractor(schema).extract(config)`，仅负责实例化及转发，**不做额外业务判断或副作用**。
  - 返回：`SchemaExtracted[]`，由 base 包定义。
- `nodeResultExtractor(params)`（[node-result-extractor.ts](frontend/packages/workflow/sdk/src/utils/node-result-extractor.ts)）
  - 入参：`{ nodeResults: NodeResult[]; schema: WorkflowJSON; }`。
  - 内部行为：`new NodeResultExtractor(nodeResults, schema).extract()`，同样为纯粹包装器。
  - 返回：`NodeResultExtracted[]`。
- 表达式编辑器相关导出（[src/index.ts](frontend/packages/workflow/sdk/src/index.ts)）：
  - 直接从 `@coze-workflow/components` re-export 大量类型和工具，包括：
    - 值/Token/Segment/Signal 等 `ExpressionEditor*` 系列类型与类。
    - Hook：`useListeners`, `useSelectNode`, `useKeyboardSelect`, `useRenderEffect`, `useSuggestionReducer` 等。
  - 同时 re-export 相关的 type 定义：`ExpressionEditorEventParams`, `ExpressionEditorTreeNode`, `PlaygroundConfigEntity` 等。
- 数据流总体特征：
  - 以 **Workflow JSON + 节点执行结果** 为输入，经过 base 提供的提取器，生成用于 UI 渲染或分析的结构化数据。
  - 以 React Expression Editor 组件为交互界面，通过 hooks 与上述结构化数据协同工作。

## 3. 构建、测试与开发工作流
- 构建与打包
  - 当前 `package.json` 中 `build` 脚本为 `"build": "exit 0"`，表示本子包自身不单独执行构建逻辑，构建通常由 monorepo 上层（如 Rush / 统一构建脚本）驱动。
  - TS 编译配置位于 [tsconfig.build.json](frontend/packages/workflow/sdk/tsconfig.build.json)，核心要点：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，统一前端编译规范。
    - `rootDir: ./src`，`outDir: ./dist`，编译产物统一输出到 dist。
    - references 指向 base、components 以及 config 下的各 tsconfig，用于 TypeScript project references & 增量构建。
  - 若需要手动检查类型，可在 monorepo 顶层使用 Rush 相关命令（如 `rush build` 或 `rushx ts-check`，实际命令以顶层配置为准），本包本地不单独暴露 ts-check 脚本。
- 测试
  - 测试框架为 Vitest，配置在 [vitest.config.ts](frontend/packages/workflow/sdk/vitest.config.ts)，通过 `@coze-arch/vitest-config` 统一预设（preset: 'web'）。
  - `npm test` / `pnpm test`（在本包目录）等价于：`vitest --run --passWithNoTests`。
  - 覆盖率命令：`npm run test:cov`，对应 `vitest --run --coverage`，覆盖率输出目录由 Rush 在 [config/rush-project.json](frontend/packages/workflow/sdk/config/rush-project.json) 中声明为 `coverage`。
  - 测试文件位于 [__tests__](frontend/packages/workflow/sdk/__tests__) 下，目前主要是占位（`.gitkeep`），可补充具体单测；建议放在对应子目录（如 `__tests__/utils`）并使用 Vitest 标准命名约定（`*.test.ts` / `*.spec.ts`）。
- Lint
  - ESLint 配置在 [eslint.config.js](frontend/packages/workflow/sdk/eslint.config.js)，使用 `@coze-arch/eslint-config` 的 `web` 预设。
  - 脚本：`npm run lint` => `eslint ./ --cache`，作用于本包下的源码与测试。
  - Stylelint 通过工作区统一配置（`@coze-arch/stylelint-config`），本包自身无单独脚本，遵循 monorepo 统一前端风格规范。

## 4. 代码与类型约定
- 语言与运行时
  - 使用 TypeScript + React（`jsx: "react"`），但本包本身不包含 UI 组件，只暴露相关类型与 hooks。
  - 目标模块类型：`module: ESNext`，`moduleResolution` 继承自上游 tsconfig；构建产物在 package.json 中通过：
    - `main: src/index.ts`（当前指向源码，用于 TS/构建链）
    - `module: dist/esm/index.js`
    - `unpkg: dist/umd/index.js`
    - `types: src/index.ts`（类型入口仍在源码层，借助 TS references 保证类型可解析）。
- 函数设计
  - `schemaExtractor` 与 `nodeResultExtractor` 被视为 **纯函数包装器**：
    - 不应在其中引入副作用（例如网络请求、本地存储操作等）。
    - 不进行跨包逻辑拼装，保持只做一件事：调用 base 提供的 extractor 并返回结果。
  - 新增的 util 函数若也只是对 base/其他内部包的封装，应遵循同样的 **轻封装原则**，确保 sdk 层逻辑简单、可预测。
- 类型与导出
  - 所有对外暴露的类型/函数应在 [src/index.ts](frontend/packages/workflow/sdk/src/index.ts) 中集中导出，避免调用方直接从 `./utils` 或更深层路径 import。
  - 变更导出时要注意：
    - 同时更新 README 和必要的使用示例。
    - 保持与 `@coze-workflow/components`、`@coze-workflow/base` 的版本兼容关系（目前通过 `workspace:*` 受 monorepo 统一管理）。

## 5. 与其他子包的集成关系
- `@coze-workflow/base`
  - 提供工作流相关核心数据结构 `WorkflowJSON`、`NodeResult`、`SchemaExtractor`、`NodeResultExtractor` 等。
  - sdk 的 `schemaExtractor` / `nodeResultExtractor` 只调用公开 API，不依赖 base 的内部实现细节，避免耦合。
- `@coze-workflow/components`
  - 提供 Expression Editor 组件及其生态：事件模型、Token/Segment/AST、校验器、渲染器、辅助工具及 React Hooks。
  - sdk 将这些能力集中 re-export，让上层代码只依赖 `@coze-workflow/sdk` 而不是多个子包，形成“**统一入口**”。
- `@coze-arch/*` 工具包
  - `@coze-arch/ts-config`：统一 TS 编译配置。
  - `@coze-arch/eslint-config`：统一 ESLint 规则。
  - `@coze-arch/vitest-config`：统一 Vitest 配置预设。
  - 这些包通常不在业务代码中直接使用，只在配置层体现；AI 修改配置时应优先查看上游包的约定，避免破坏 monorepo 统一规范。

## 6. 开发规范与项目流程
- Monorepo & Rush 集成
  - 本包有自己的 Rush 配置 [config/rush-project.json](frontend/packages/workflow/sdk/config/rush-project.json)，声明了部分自定义操作输出目录（如 `coverage` 和 `dist`）。
  - 典型工作流：
    - 在仓库根目录使用 `rush update` 安装依赖。
    - 使用全局命令（如 `rush build`、`rush test` 等）对所有相关包进行统一操作。
  - 增量构建 / 测试由 Rush 及 tsconfig references 控制，尽量不要擅自改动 references 列表，除非确实增加/删除了依赖包。
- 分支与提交约定
  - 本子包内未见单独的分支/提交规范文件，应遵循仓库根目录的通用规范（如 README、CONTRIBUTING 或提交钩子）。
  - AI 在生成 commit message 或分支名时，应优先遵循工作区已有模式（可从仓库近期 git log 中观察）。
- 版权与 License
  - 所有源码文件头部包含 Apache-2.0 版权声明，新增文件也应保持同样的头注释格式。

## 7. 对 AI 编程助手的具体建议
- 修改与新增代码时：
  - 优先在 [src/utils](frontend/packages/workflow/sdk/src/utils) 增加新的封装函数，并在 [src/index.ts](frontend/packages/workflow/sdk/src/index.ts) 中集中导出。
  - 避免在 sdk 中引入新的领域逻辑或复杂状态管理，这些应放到 base 或 components；sdk 只负责“拼装 + 导出”。
  - 若需要新的类型，优先复用 `@coze-workflow/base` / `@coze-workflow/components` 中已有类型，避免在 sdk 重新定义一套重复结构。
- 更新公共 API 时：
  - 确认下游调用范围（可在 monorepo 中全局搜索对应导出标识符）。
  - 尽量以增加导出、不移除旧导出的方式实现向后兼容；若必须破坏兼容，应在 README 中补充迁移说明。
- 编写测试时：
  - 将 sdk 视为一个薄层：重点测试参数透传与结果格式是否保持与 base/components 一致即可，不必重复测试底层实现细节。
  - 使用 Vitest + Testing Library（如需要 React 相关行为）保持与 monorepo 其它前端包一致的测试风格。

## 8. 不寻常 / 需要特别注意的点
- `package.json` 的 `build` 脚本目前为 no-op（`exit 0`），这在普通 npm 包中并不常见；构建逻辑完全托管给上层工具链，因此：
  - 不要在本包中随意添加会被外部构建流程依赖的新脚本，除非同步更新 Rush 等配置。
- `types` 指向 `src/index.ts` 而不是 `dist` 下的 `.d.ts`，依赖于 TypeScript + project references 进行类型推断，这对编辑器和构建工具是友好的，但：
  - 若未来增加复杂构建流程（如 rollup/tsup），要小心不要与当前类型入口设计冲突。
- 大部分表达式编辑器能力都是 **re-export 自 components 包**，在 sdk 目录内看不到它们的实现；AI 若要理解具体行为，应前往 [frontend/packages/workflow/components](frontend/packages/workflow/components) 中查阅对应实现后再做修改或新增封装。