# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/base）中安全、高效地协作开发。

## 全局架构概览

- 本包是工作流子系统的「基础域模型和基础设施」层，为上层包（nodes、components、playground、adapter 等）提供统一的实体、类型、Store、API 封装和 React hooks。
- 核心导出集中在 [src/index.ts](frontend/packages/workflow/base/src/index.ts)：聚合 types、utils、api、store、constants、hooks、entities、contexts。
- 主要子模块：
	- 类型与协议：位于 [src/types](frontend/packages/workflow/base/src/types)，定义工作流 JSON、节点类型、变量、表达式、数据库/条件配置等前端侧协议，并和后端/其它包（如 `@coze-arch/bot-api`）对齐。
	- 实体层：位于 [src/entities](frontend/packages/workflow/base/src/entities)，目前只有 `WorkflowNode`，是对 `@flowgram-adapter/free-layout-editor` 中 `FlowNodeEntity` 的业务封装，负责节点业务读写和错误管理。
	- React 上下文与 Hooks：位于 [src/contexts](frontend/packages/workflow/base/src/contexts) 与 [src/hooks](frontend/packages/workflow/base/src/hooks)，通过 `WorkflowNodeContext` + `useWorkflowNode` 等提供在 React 组件树中访问当前工作流节点的能力。
	- 状态管理：位于 [src/store](frontend/packages/workflow/base/src/store)，基于 `zustand` 构建工作流相关的全局/局部状态（通过 `useWorkflowStore` 暴露）。
	- API & Services：位于 [src/api](frontend/packages/workflow/base/src/api) 和 [src/services](frontend/packages/workflow/base/src/services)，对接后端工作流相关 HTTP / RPC 接口，通常基于 `@tanstack/react-query` 与 `@coze-arch/bot-api` 封装。
	- 工具方法与常量：位于 [src/utils](frontend/packages/workflow/base/src/utils) 与 [src/constants](frontend/packages/workflow/base/src/constants)，包含表单路径访问、变量树处理、运行状态枚举等工具与配置。
- 数据流大致路径：
	- 后端 / 其它前端包 → `@coze-arch/bot-api` & 本包 types → Store / WorkflowNode → React 组件（通过 hooks / context 消费）。
	- 组件更新节点/工作流数据 → 通过 `WorkflowNode.setData` 等写回底层 `FlowNodeEntity` 或 `zustand` store → 由上层工作流画布 / 运行环境统一持久化或提交到后端。

## 关键开发工作流

- 本包是 Rush monorepo 子包，配置见 [config/rush-project.json](frontend/packages/workflow/base/config/rush-project.json)，通常通过仓库根目录的 Rush 脚本来构建和测试。
- 本包本身的 npm 脚本在 [package.json](frontend/packages/workflow/base/package.json)：
	- `npm run build`：当前实现为 `exit 0`，表示**实际构建由上层工具链完成**（例如统一的打包/编译管线），不要在此包中手工增加构建逻辑。
	- `npm run lint`：调用 `eslint ./ --cache`，规则来自 `@coze-arch/eslint-config`，并启用一些自定义规则（如 `@coze-arch/no-batch-import-or-export`）。
	- `npm run test`：使用 Vitest 运行单测，配置在 [vitest.config.ts](frontend/packages/workflow/base/vitest.config.ts)，通过 `@coze-arch/vitest-config` 统一管理，`preset: 'web'`，`globals: true`。
	- `npm run test:cov`：在 `test` 的基础上追加覆盖率统计。
- 在整个 monorepo 中集成本包时：
	- 安装依赖使用 Rush：在仓库根目录执行 `rush update`；
	- 单独在本包调试/测试时，可在本目录下用 `pnpm`/`npm` 执行上述脚本，但推荐沿用 monorepo 约定的 `rushx <script>` 方式（可在仓库根目录 `frontend/rushx-config.json` 查询具体脚本）。

## 项目特有约定与模式

- **类型与运行时校验分离**：
	- [src/types](frontend/packages/workflow/base/src/types) 中使用 TypeScript 类型、枚举和少量 `io-ts` runtime 类型，注释中注明：`data-set.ts` 使用 `io-ts`，**禁止直接 export**，以避免在其它页面触发额外 runtime 依赖；编写新类型时要遵守这一拆分思路。
- **对后端/其它包的紧耦合协议**：
	- `InputType` 直接来自 `@coze-arch/bot-api/developer_api`，在 [src/types/index.ts](frontend/packages/workflow/base/src/types/index.ts) 中通过 `PARAM_TYPE_LABEL_MAP` 映射为前端展示文案；修改枚举值时必须保持与后端同步。
	- `WorkflowInfo` 等通过 `FrontWorkflowInfo` 别名导出，注释说明与后端定义对齐，避免接口偏差。
- **展示文案/标签集中定义**：
	- `PARAM_TYPE_LABEL_MAP` 与 `STRING_ASSIST_TYPE_LABEL_MAP` 在 [src/types/index.ts](frontend/packages/workflow/base/src/types/index.ts) 中集中管理，任何新变量类型或 AssistType 增加，都应在此处补充对应 label，UI 不应硬编码文案。
- **WorkflowNode 封装层**：
	- `WorkflowNode` 只处理「业务相关」读取/写入逻辑，比如输入参数解析、输出集合封装、错误状态、节点基础元信息（图标、标题、描述）；
	- 底层 free-layout-editor 的 `FlowNodeEntity` 细节（表单模型、路径、错误结构）保持封装，只通过 `getFormValueByPathEnds` 之类工具暴露必要能力；
	- 注释明确标记：`getFormValueByPathEnds` 等方法是底层方法的简化封装，**暂不推荐在业务层大量依赖**，新增能力更推荐扩展 registry 或明确的业务 API。
- **Hooks/Context 使用模式**：
	- `WorkflowNodeContext`（见 [src/contexts](frontend/packages/workflow/base/src/contexts)）在组件树中提供当前节点实体；
	- `useWorkflowNode`（[src/hooks/use-workflow-node.ts](frontend/packages/workflow/base/src/hooks/use-workflow-node.ts)）内部使用 `useContext` 直接返回 `WorkflowNode` 实例；调用方应假设 context 已被上层正确注入（否则会得到 `undefined`/错误类型）。
- **Store 访问规范**：
	- `useWorkflowStore` 仅在 [src/store/index.ts](frontend/packages/workflow/base/src/store/index.ts) 作为公共入口导出，具体实现藏在 `workflow/` 子目录，业务侧统一从包根路径导入（`@coze-workflow/base/store`）。

## 重要组件与依赖集成细节

- **与 @flowgram-adapter/free-layout-editor 的集成**：
	- `WorkflowNode` 直接持有 `FlowNodeEntity` 实例：
		- 通过 `getData(FlowNodeFormData)` 获取表单模型，`isFormV2` 判断版本，并在 `setData` 中按版本分支更新表单值；
		- 通过 `getData(FlowNodeErrorData)` 读写错误对象，`setError` 统一写入；
		- 通过 `getNodeRegistry()` 获取节点注册信息并强转为 `WorkflowNodeRegistry`，允许 registry 覆盖默认的输入参数/输出取值逻辑。
	- 若需要新增节点级业务：优先在 registry 接口（见 [src/types/registry.ts](frontend/packages/workflow/base/src/types)）扩展能力，然后在 `WorkflowNode` 中通过 registry 访问，而非绕过封装直接操作 `FlowNodeEntity`。
- **与 @tanstack/react-query 的集成**：
	- API 层一般会在 [src/api/with-query-client.tsx](frontend/packages/workflow/base/src/api/with-query-client.tsx) 等文件中封装 QueryClientProvider 或自定义 hooks；
	- 本包不负责全局 QueryClient 的创建，而是作为「子域」在上层应用已有的 QueryClient 中注册 query key 与请求逻辑。
- **与 @coze-arch/* 系列包的关系**：
	- `@coze-arch/bot-api`：统一定义工作流/节点/变量的后端接口结构；
	- `@coze-arch/bot-error`、`@coze-arch/bot-flags`、`@coze-arch/bot-utils`、`@coze-arch/logger`：为错误处理、特性开关、通用工具和日志提供统一实现，本包仅作为调用方；
	- `@coze-arch/vitest-config`、`@coze-arch/eslint-config`、`@coze-arch/ts-config`：在测试、lint、编译层统一规范配置，不应在本包内重复定义。
- **与 Zustand Store 的关系**：
	- `useWorkflowStore` 内部（[src/store/workflow](frontend/packages/workflow/base/src/store/workflow)）基于 `zustand` 创建 store；
	- 将工作流运行态（执行状态、当前执行节点、运行结果等）抽离出 UI 组件，方便其它子包（如 history、test-run、playground）直接消费。

## 开发流程与协作规范

- 分支与提交规范依赖 monorepo 根目录的 Git 约定；本包没有额外的本地分支策略说明，新增功能/修复通常通过在顶层仓库创建 feature 分支，并在其中修改多个相关子包。
- 代码风格：
	- 必须通过 ESLint + Prettier，遵循 `@coze-arch/eslint-config`；
	- 禁止随意关闭/绕过自定义 ESLint 规则；若确有需要（如批量 export），应像 [src/index.ts](frontend/packages/workflow/base/src/index.ts) 那样有针对性地关闭，并尽量缩小作用范围。
- 类型与注释：
	- 优先使用显式类型导出与 re-export，方便其它包通过类型自动完成理解调用方式；
	- 对与后端/其它包强绑定的类型（枚举值、DTO 结构等）应在注释中说明「与后端保持同步」或「与 XXX 包保持一致」，修改时同步相关方。
- 测试：
	- 单测放在 [__tests__](frontend/packages/workflow/base/__tests__) 目录，使用 Vitest + Testing Library；
	- 本包主要测试目标是：`WorkflowNode` 行为（数据/错误/registry 集成）、store 行为、关键类型/工具函数的边界情况。

## 非常规/易踩坑点

- **构建脚本为 no-op**：
	- `npm run build` 当前不会产出构建结果，真正打包由上层管线负责；在本子包新增编译产物（如生成 dist）需要先确认 monorepo 的构建规范，避免与现有流程冲突。
- **io-ts 直接导出受限**：
	- 注释明确 `data-set.ts` 不允许直接 export，以免把 io-ts runtime 类型泄漏到业务层；如果需要新的 runtime 校验，请复用已有模式（在 types 子目录内部使用，向外只暴露 TS 类型/辅助函数）。
- **WorkflowNode 只是「业务视图」**：
	- 外部不要假设 `WorkflowNode.data` 结构的所有字段都固定不变（特别是 `nodeMeta` 内部字段），这些字段是针对当前编辑/运行 UI 的业务视图；
	- 若有跨包依赖节点数据结构，应通过 types 中定义的 DTO/VO 类型进行约定，而不是直接透传 form 的原始结构。

## 对 AI 编程助手的具体建议

- 修改或新增功能前，优先确认：
	- 该需求属于「协议扩展」（types + DTO/VO 变化）、
	- 还是「节点业务行为」变更（`WorkflowNode` 或 store / hooks）、
	- 或是「与其它包交互」的 API 封装调整（api/services）。
- 编辑 `WorkflowNode` 或 store 时：
	- 保持对 `@flowgram-adapter/free-layout-editor` 抽象边界，不要在业务代码中直接依赖其内部实现细节；
	- 尽量通过 registry 接口或统一的工具函数来访问表单/错误数据。
- 新增类型/变量相关能力时：
	- 在 [src/types](frontend/packages/workflow/base/src/types) 中补充枚举、label map 和 DTO/VO 定义；
	- 同步检查是否需要与后端协商字段/取值范围，或与 `@coze-arch/bot-api` 保持对齐。
- 若需要为其它子包提供新的共享能力，请优先考虑：
	- 是否应放在本基础包（面向整个工作流域），
	- 还是放在更上层（如 nodes/components/playground），以避免基础包对具体 UI 或特定场景产生反向依赖。

