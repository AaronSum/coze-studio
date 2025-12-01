# @coze-workflow/variable 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/variable）中安全、高效地协作开发。

## 全局架构与职责边界

- 子包根目录为 frontend/packages/workflow/variable，对应 workflow 变量域能力，属于前端 Workflow Engine 下的一块「资源」能力层，与画布、节点等包协同工作。
- 公共导出集中在 [frontend/packages/workflow/variable/src/index.ts](frontend/packages/workflow/variable/src/index.ts)，向外提供：
	- FlowNodeVariableData：来自 @flowgram-adapter/free-layout-editor 的类型别名，用于描述工作流节点中的变量数据结构。
	- hooks：变量编辑、订阅、生命周期的 React Hooks 能力。
	- legacy：旧版变量引擎实现，仍在兼容使用中，新增功能应优先落在 core 与 services。
	- typings / constants / datas / form-extensions：变量结构、枚举常量、内置变量数据、表单扩展配置等定义层。
	- core：变量引擎核心封装（facade/service 等），屏蔽调用方对内部实现细节的感知。
	- components：变量相关 UI 组件（作用域 Provider、调试面板等），只承担视图渲染和交互逻辑。
	- services：变量读写与同步能力的服务层，一般不直接被页面使用，而是通过 hooks 或 core 访问。
	- utils：例如 generateInputJsonSchema，用于根据变量配置生成 JSON Schema，供工作流引擎/前端表单使用。
	- createWorkflowVariablePlugins：将变量能力以插件形式挂入工作流/画布系统。
- 运行时数据流大致路径：
	- Workflow 画布 / 节点编辑器 → 通过插件/组件触发变量相关交互 → 调用 hooks（如 use-variable-change、use-variable-rename 等）。
	- hooks 内部依赖 services 与 core，实现变量集合读取、单变量查询、增删改及类型变更；同时可触发外部事件上报或状态同步。
	- 最终以 FlowNodeVariableData 等结构写回到 workflow 节点数据，或通过 generateInputJsonSchema 之类工具导出给其他子系统。

## 开发/构建/测试工作流

- 包级脚本定义在 [frontend/packages/workflow/variable/package.json](frontend/packages/workflow/variable/package.json)：
	- build：当前为占位命令（exit 0），真正打包通常由上层 Rush/Rsbuild 总构建流程驱动；在本包内开发时通常无需单独执行。
	- lint：eslint ./ --cache --quiet，使用 monorepo 统一 ESLint 规则（@coze-arch/eslint-config）。
	- test：vitest --run --passWithNoTests，执行单元测试；即使暂无用例也不会报错。
	- test:cov：在 test 基础上增加覆盖率统计。
- 推荐本包常用命令（在仓库根目录执行）：
	- 依赖安装：rush install 或 rush update（见 [frontend/README.md](frontend/README.md)）。
	- 在 workflow/variable 子包内跑测试：
		- cd frontend/packages/workflow/variable && pnpm test（实际命令以 workspace 管理工具为准）。
	- 前端整体开发调试通常在 apps/coze-studio 中通过 rushx dev 进行，本包仅作为依赖被消费，不直接启动独立开发服务器。
- 单测配置：
	- [frontend/packages/workflow/variable/vitest.config.ts](frontend/packages/workflow/variable/vitest.config.ts) 使用 @coze-arch/vitest-config 的 web 预设，按 monorepo 统一规范运行。
	- alias 中将大量 UI/运行时重依赖（如 @coze-workflow/render、@coze-workflow/components、@coze-arch/bot-icons、若干 bot-detail-store 包）指向 __tests__/default.mock.ts，用于减少测试运行中的外部依赖，避免真实渲染/网络调用。
	- esbuild 配置开启 experimentalDecorators 与 emitDecoratorMetadata，以支持 inversify 等依赖的装饰器写法。

## 代码风格与项目特有约定

- 语言与技术栈：
	- 使用 TypeScript + React 18，部分文件后缀为 .tsx，即便实现主要为逻辑/类型（如 typings.tsx），保持与整体工程统一。
	- 使用 inversify 进行依赖注入，需确保 reflect-metadata 在入口层加载（通常由上层应用或 arch 层负责）。
- 导出与模块组织：
	- 所有对外公开的 API 必须通过 [src/index.ts](frontend/packages/workflow/variable/src/index.ts) 出口统一导出，避免直接从内部子目录引用（防止将来重构破坏调用方）。
	- hooks 命名统一以 use- 前缀，并放在 [src/hooks](frontend/packages/workflow/variable/src/hooks) 下：
		- 例如 use-variable-change、use-variable-rename、use-variable-type-change、use-auto-sync-rename-data、use-available-workflow-variables 等，表达「单一清晰职责」。
	- services 与 core：
		- core 层提供 workflow-variable-facade / workflow-variable-facade-service 等门面对象，对外暴露稳定接口。
		- services 目录下则是更具体的服务实现，若新增业务能力，优先在 service > core > hooks 三层填充，而不是直接在组件中写复杂逻辑。
- 变量体系相关惯例：
	- 变量 keypath、scope、type 等概念在 constants/datas/typings 中被统一建模，新增字段或类型时必须保证：
		- 更新 typings 与 constants，避免出现魔法字符串。
		- 同步更新 generateInputJsonSchema 等工具函数，保证 Schema 与运行时数据一致。
	- legacy 目录中的旧实现仍被部分调用，新增能力应优先落在非 legacy 区域；迁移/重构 legacy 代码需注意兼容现有导出。

## 与外部子系统的集成点

- 与 Workflow 画布系统：
	- 依赖 @flowgram-adapter/free-layout-editor，使用其中的 FlowNodeVariableData 等类型描述工作流节点变量结构，是本包与画布/节点编辑系统的主要契约。
	- createWorkflowVariablePlugins 将变量能力注册为工作流插件，通常由上层 workflow 包在初始化时调用。
- 与 Coze 前端基建：
	- 使用 @coze-arch/bot-api / @coze-arch/logger / @coze-arch/report-events 等 workspace 依赖，负责变量相关的服务调用、埋点与日志，这些调用必须遵守各自包的接口约定（不在本包内直接拼接 URL 或手写请求）。
	- 国际化统一通过 @coze-arch/i18n 完成，组件/文案不直接写死字符串，而是使用 i18n key；新增 UI 时请比照其它 workflow 包的写法。
- UI 与交互：
	- 依赖 @douyinfe/semi-ui 作为基础 UI 组件库；布局和交互风格应与整个 workflow 套件保持一致，避免混用其它 UI 框架。
- 运行时与注入：
	- 使用 inversify 管理服务实例，新增 service 时需在对应 container 中完成绑定；如需在测试环境替换实现，可通过测试时的容器配置或 alias 实现。

## 团队流程与协作规范

- 本包元信息中 tags: ["team-automation", "level-3"]，说明：
	- 归属 team-automation 团队维护；在做较大重构/接口变更时，应参考团队约定并在相关负责人评审后合入。
	- level-3 意味着复杂度与重要性中等偏上，变更需要附带合理的单测覆盖和回归验证。
- 代码规范：
	- ESLint 规则来自 @coze-arch/eslint-config，局部如 src/index.ts 中使用 @coze-arch/no-batch-import-or-export 的禁用例外，应沿用已有 disable 方式，避免随意新增全局关闭规则。
- Git 与发布：
	- monorepo 层面的分支策略、发布流程遵循仓库根目录的 CONTRIBUTING.md 与 Rush 相关约定；本包自身不单独维护版本脚本。

## 本子包的特别注意事项

- 测试中大量外部依赖通过 alias 指向 __tests__/default.mock.ts：
	- 新增对这些被 alias 的包的引用时，请确认是否也需要在 vitest.config.ts 中补充 alias，以保证测试环境可运行。
	- 若需要在测试中使用真实实现，应在特定测试文件中显式引入实际模块，而不是修改全局 alias。
- 由于 variables 能力深度参与 Workflow 运行，任何对核心类型（如 FlowNodeVariableData）或 Schema 生成逻辑的修改，都有较大范围影响：
	- 修改前应先在本包内补充/调整单测覆盖关键路径，再在上层 workflow 包或集成场景中进行联调。
- legacy 目录中代码虽然标注「等待替换」，但目前仍是生产路径的一部分：
	- 禁止直接删除或大规模重构 legacy 内容，除非已经找到并更新所有调用方，并通过完整回归测试。

以上约定和信息仅基于当前仓库状态，如有新增目录/能力，请在完成实现后同步更新本说明。
