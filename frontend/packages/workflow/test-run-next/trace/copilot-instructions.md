# @coze-workflow/test-run-trace 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/test-run-next/trace）中安全、高效地协作开发。

## 1. 全局架构与数据流概览

- 子包位置：frontend/packages/workflow/test-run-next/trace，对外只导出两个 React 组件：TraceListPanel、TraceDetailPanel（见 src/index.ts、src/components/**）。
- 功能定位：为「工作流 TestRun」提供“调用链/Trace 视图”，包括列表筛选面板和单条 Trace 详情视图，用于观察一次工作流执行的各个节点 span。
- 主要模块：
	- 组件层：src/components/trace-list-panel、src/components/trace-detail-panel，负责列表页和详情页 UI 布局、交互和与上层容器的集成。
	- 观测组件层：src/observation-components/**，从 @flow-devops/observation-components 拷贝的 TraceTree、TraceFlameThread、MessagePanel 等可视化组件，用于展示时序树、火焰图、消息内容等。
	- 状态与上下文：src/contexts/trace-list，基于 zustand 封装 Trace 列表相关状态和操作，暴露 TraceListProvider、useTraceListStore。
	- 工具与常量：src/utils.ts、src/constants.ts、src/types.ts 等，封装 Span 处理、格式化、跳转参数构建和图表模式切换等逻辑。
- 数据来源：依赖 @coze-arch/bot-api/workflow_api 中定义的 Span、TraceFrontendSpan、Int64 等类型；上层容器（通常来自 @coze-workflow/base、@coze-workflow/test-run-shared）负责真正向后端拉取 trace 数据，再以 props 或上下文形式传入本包组件。
- 典型数据流：
	- 上层根据 workflow/executeId 调用 bot-api 获取 spans → 通过 sortSpans 等工具函数做去重与排序 → 注入 TraceListPanel / TraceDetailPanel。
	- 列表面板通过 TraceListProvider 管理筛选条件与当前选中 Trace → 点击一条记录时，通过 getGotoNodeParams 生成 GotoParams 供上层路由/工作流编辑器跳转到对应节点。
	- 详情面板则将单个 Trace 的 spans 交给 observation-components 中的 TraceTree / TraceFlameThread 进行可视化展示，辅以 MessagePanel 等组件展示 tag、日志或消息详情。

## 2. 开发与构建工作流

- 子包脚本（见 package.json）：
	- lint: eslint ./ --cache
	- build: exit 0（当前为空壳，真正产物由上层构建体系负责）
	- test / test:cov: exit 0（暂未在本子包定义单元测试）
- 依赖 monorepo 统一管理：在仓库根目录通过 Rush + workspace 管理依赖，添加/修改依赖后需在根目录执行 rush update。
- 本包本身不直接输出打包产物，而是通过 exports/main 指向 TypeScript 源码（src/index.ts），由上层 bundler（可能在 apps 层）统一编译。
- 推荐本地开发流程：
	- 在前端应用工程中引用 @coze-workflow/test-run-trace，确保根目录已执行 rush update、rush build 或对应应用的启动脚本（详见 frontend/apps 下的具体 app 文档）。
	- 在 trace 子包中改动 TSX/TS 后，依赖上层 dev server 的 HMR/重启来刷新页面；本包自身不需要单独启动 dev server。
- ESLint 配置：eslint.config.js 使用 @coze-arch/eslint-config 的 web preset，并关闭了若干内部规则（如 @coze-arch/no-deep-relative-import），说明本包允许较深层的内部相对引用和较复杂组件。

## 3. 代码结构与约定

- 目录结构（仅列关键）：
	- src/index.ts：对外导出 TraceListPanel、TraceDetailPanel。
	- src/constants.ts：图表模式枚举 TraceChartsMode，trace 数量/时间限制常量 MAX_TRACE_LENGTH、MAX_TRACE_TIME（最多 50 条、最长 7 天）。
	- src/types.ts：封装 GotoParams（workflowId、nodeId、executeId、subExecuteId），用于上层跳转到对应 workflow 节点。
	- src/utils.ts：
		- sortSpans：基于 span_id 去重（lodash-es uniqBy）并按 start_time 升序排序。
		- getTimeFromSpan：用 dayjs 格式化 start_time。
		- getStrFromSpan / getLongFromSpan / getTokensFromSpan：从 span.tags 中按 key 解析特定字段（字符串或 Int64），用于读取 workflow_id、execute_id、tokens 等。
		- formatDuration：根据毫秒值输出 ms/s/min/h/d 人类可读字符串。
		- getGotoNodeParams：从 span.tags 提取跳转所需的 workflow_id / workflow_node_id / execute_id / sub_execute_id 并组装成 GotoParams。
	- src/components/trace-list-panel/**：
		- index.ts：导出 TraceListPanel。
		- header.tsx / header.module.less：列表头部筛选、统计等 UI。
		- list-panel.tsx：主列表容器组件，负责与 TraceListProvider 交互。
	- src/components/trace-detail-panel/**：
		- index.ts：导出 TraceDetailPanel。
		- trace-detail-panel.tsx / trace-detail-panel.module.less：详情主布局与样式。
		- pay-block.tsx / pay-block.module.less：与计费/用量相关的展示区块（如 tokens、时长等）。
	- src/contexts/trace-list/**：
		- 暴露 TraceListProvider、useTraceListStore，基于 zustand 管理列表数据、选中项、筛选条件等；建议 AI 修改时保持 hook API 名称与 shape 一致，避免破坏现有调用方。
	- src/observation-components/**：
		- index.ts：二次导出 TraceTree、TraceFlameThread、MessagePanel、spans2SpanNodes、ObservationModules 等。
		- common/**：基础 UI 元件，如时间标签、标题、flamethread/tree 中使用的通用组件。
		- trace-tree/**：树形调用链视图。
		- trace-flame-thread/**：调用链“火焰图”视图。
		- message-panel/**：展示 span 或日志消息详情。
		- utils/graph.ts：spans2SpanNodes，将原始 spans 转换为可视化组件需要的节点结构。
		- 样式：scroll-bar.less、variables.less 同一化滚动条和主题变量，与 Coze Studio 其他观测类组件保持一致。
- 样式约定：
	- 组件样式多采用 *.module.less，本地作用域类名，通过 import styles from './xxx.module.less' 的方式绑定；observation-components 内部则使用通用 less 文件与 BEM/语义类名配合。
- 类型与 API：
	- Trace 相关类型优先复用 @coze-arch/bot-api/workflow_api 中的定义，不在本包重复建模；新增字段从 Span.tags 中解析时，应遵循 getStrFromSpan / getLongFromSpan 的模式。
	- 时间、数量限制使用 src/constants.ts 内导出的常量，避免魔法数字散落在组件中。

## 4. 与外部依赖/子系统的集成

- bot-api 集成（@coze-arch/bot-api/workflow_api）：
	- Span / TraceFrontendSpan / Int64 等类型从该包导入，本包只做前端展示与轻量转换，不直接发起网络请求。
	- 对 span.tags 的 key 有约定（如 workflow_id、workflow_node_id、execute_id、sub_execute_id、tokens、is_trigger 等），新增使用前请检查后端/IDL（idl/workflow/**）是否已有定义。
- UI 与设计体系：
	- 依赖 @coze-arch/coze-design、@mui/material、@emotion/react/styled 等内部设计系统和 MUI 组件，trace 视图需要与其他工作流编辑/运行面板在交互与样式上保持一致。
- 状态管理：
	- 使用 zustand 管理 trace 列表相关的 client-side state；尽量通过 TraceListProvider 进行封装，对外只暴露 useTraceListStore，避免在各处直接创建 store。
- 其他工具：
	- dayjs 用于时间格式化；json-bigint 可能用于处理超大整数 ID；@textea/json-viewer 用于 JSON 结构展示；lodash-es 提供集合/数组工具函数。

## 5. 开发规范与协作注意事项

- 代码风格：
	- 遵循 @coze-arch/eslint-config 的 web preset，允许部分规则关闭（如函数过长、深层相对路径、zustand shallow 偏好），因此组件逻辑可相对集中但仍需保持可读性。
	- TypeScript 严格模式由 monorepo ts-config 统一控制，本包 devDependencies 中包含 @coze-arch/ts-config，请优先沿用现有类型模式，不要随意使用 any，除非与现有代码风格一致且有必要。
- 组件改动：
	- TraceListPanel / TraceDetailPanel 为对外公开 API，修改其 props 结构、导出名或行为时，需要同步检查所有引用点（在 frontend/apps/**、frontend/packages/workflow/** 中搜索 '@coze-workflow/test-run-trace'）。
	- observation-components 下的实现来自外部包拷贝，顶部注释明确写明“I don't understand the logic yet.”，在不充分理解时应避免大范围重构；更安全的方式是新增轻量适配层或扩展 props，而非直接改动深层渲染逻辑。
- 性能与上限：
	- MAX_TRACE_LENGTH、MAX_TRACE_TIME 控制了查询与展示上限，新增功能（如“加载更多”、“更长时间范围”）时必须配合后端与其他工作流页面的约束统一调整，不要在本包中单独改成任意值。
	- sortSpans 目前默认按 start_time 升序，且缺失时间的 span 排在最后（Infinity），依赖该顺序的 UI（列表、flame、tree）在修改排序逻辑时需做回归测试。
- 国际化与文案：
	- 本包依赖 @coze-arch/i18n，具体使用方式在上层工作流应用中；在 Trace 面板中新增文案时，应通过统一 i18n 工具注入，而不要写死中文/英文字符串（参照相邻 workflow 子包的实践）。

## 6. 提交、分支与发布（与上层保持一致）

- 分支/提交策略：
	- 该仓库整体遵循 86Links/Coze Studio 的统一流程（具体见仓库根目录 README.md 与贡献文档），本子包没有单独的分支策略；在 feature/bugfix 分支中修改 trace 子包即可。
	- 提交信息建议包含 scope，如 feat(trace): xxx 或 fix(trace-list): xxx，方便后续排查 trace 相关问题。
- 构建与发布：
	- 版本号由 Rush + monorepo 统一管理，本包 package.json 中的 version 字段通常通过自动流程更新；不要手动改动，除非明确在版本管理流程中要求。
	- 发布到 npm/内部 registry 的流程同其他 @coze-workflow/* 包一致，本文件不重复阐述；仅需注意：对外 API 变更需要配合版本号的 semver bump（特别是破坏性变更）。

## 7. 典型扩展场景建议

- 新增 Trace 维度展示：
	- 在 utils.ts 中新增从 span.tags 读取新字段的工具函数，并在现有组件（列表列、详情信息块、MessagePanel）中使用；避免在组件中直接访问 tags 结构。
- 扩展 Trace 可视化：
	- 若需要新的图表模式（如甘特图），建议在 constants.ts 中新增 TraceChartsMode 枚举值，在 TraceDetailPanel 中接入，同时考虑 observation-components 下是否需要新模块或扩展 spans2SpanNodes。
- 跳转行为扩展：
	- 如需跳转到新的页面/锚点，优先复用 getGotoNodeParams 结构，通过上层容器解释这些字段；只有在现有字段明显不足时，再考虑为 GotoParams 新增字段，并同步所有调用方与后端约定。

