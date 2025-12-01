# `@coze-devops/common-modules` 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/devops/common-modules）中安全、高效地协作开发。

## 1. 全局架构与模块边界

- 本包是 DevOps 侧的「业务可复用模块库」，主要面向 React 应用，按领域模块组织：
  - src/index.ts：统一对外出口，目前聚焦 query-trace 领域，导出 TraceFlamethread、TraceTree、TopologyFlow、Flamethread、Tree、useSpanTransform 等。
  - src/modules/query-trace：查询链路追踪可视化模块，是当前唯一的业务模块入口。
- query-trace 模块内部的职责分层：
  - components：纯 UI/可视化组件层（flamethread、trace-flamethread、trace-tree、topology-flow、tree 等），只接受已规整的数据结构和配置。
  - hooks：如 use-span-transform，负责把后端 Span 数据/配置转成前端可视化用的 CSpan 系列结构。
  - utils：cspan、cspan-transform、cspan-graph、field-item-handler 等做数据归一化、聚合、统计与展示相关工具，不直接操作 React 视图。
  - config：如 config/cspan.ts 用于定义 SpanType / Category / 状态枚举与文案、颜色等展示配置，是数据到 UI 之间的重要映射层。
  - typings：cspan.ts、graph.ts、config.ts 定义 CSpan / CTrace / Graph 节点与连线、数据源等 TS 类型，所有公共导出都应依赖这里的类型定义。
- 数据流总体路径（以 Span → 视图为例）：
  - 外部业务从 @coze-arch/bot-api 获取 Span 数组或 TraceId；
  - 通过 useSpanTransform 和 spans2CSpans / span2CSpan 把 Span 归一化为 CSpan / CSPanBatch；
  - utils/cspan-graph 负责按 traceId 获取 SpanData，并生成供 flamethread / tree / topology 使用的数据；
  - UI 组件（TraceFlamethread、TraceTree、TopologyFlow 等）接收数据源与配置，内部不关心原始 Span 细节。
- 结构设计要点：
  - 保持「数据处理」与「可视化组件」严格分层，避免组件中直接拼装复杂业务逻辑；
  - 所有跨模块复用的类型、配置和工具，都要求先沉淀到 typings / config / utils 再被组件层依赖。

## 2. 关键开发工作流

- 构建：
  - package.json 中 "build" 当前是 "exit 0"，表示本包不在子目录单独产物构建，实际构建通常由上层 Rush / 应用构建链路驱动。
  - 不要为本包引入自定义打包脚本，除非同时更新 Rush / 工程配置并在 README 中说明。
- Lint：
  - 运行 npm run lint（底层使用 eslint.config.js 与 @coze-arch/eslint-config，含 React + TS + import 规范）。
  - 同时存在 .stylelintrc.js 和 @coze-arch/stylelint-config，用于校验 *.less 等样式文件；统一在上层工具链触发，一般不要在此处新增独立命令。
- 单测：
  - 测试框架：vitest，配置在 vitest.config.ts，使用 @coze-arch/vitest-config.defineConfig({ dirname, preset: 'web' })。
  - 运行：
    - npm test 或 npm run test：执行 vitest --run --passWithNoTests；
    - npm run test:cov：开启覆盖率（@vitest/coverage-v8）。
  - 测试目录：/__tests__，若新增公共模块/组件，请在此新增用例；遵循现有 Vitest + React Testing Library 生态。
- Storybook 文档：
  - 配置位于 .storybook/main.js：
    - 框架为 @storybook/react-vite；
    - stories 源为 ../stories/**/*.mdx 与 ../stories/**/*.stories.tsx；
    - viteFinal 中合并了 vite-plugin-svgr，用于以 React 组件方式引入 SVG（例如 src/assets/react.svg）。
  - 若新增组件，建议按 Storybook 约定在 stories 中添加示例文档，便于可视化联调。

## 3. 项目约定与代码风格

- 入口与导出：
  - 对外公共 API 必须通过 src/index.ts 暴露，package.json 中 "exports" / "typesVersions" 也需要保持同步：
    - exports["./query-trace"] → src/modules/query-trace/index.ts；
    - exports["./tree"] → src/modules/query-trace/components/tree/index.tsx；
    - 若新增独立模块或组件，请同时更新 exports 和 typesVersions，保证类型提示与构建一致。
- 领域划分：
  - src/modules 下每个子目录代表一个「业务模块」；index.tsx 中导出的能力应尽量从 modules 目录下聚合，而非直接从 components/hooks/utils 中裸导出。
  - query-trace 内部再通过 components / hooks / utils / config / typings 完成二级分层，新增文件应跟随现有分层方式。
- TypeScript 与类型：
  - 强类型约束：所有公共导出都需要具备显式类型（来自 typings 子目录或第三方 SDK 类型）。
  - 对后端 Span 相关类型统一从 @coze-arch/bot-api/ob_query_api 引入，例如 Span、SpanStatus、SpanCategory。
  - 对前端内部的 CSpan、CTrace、Graph 节点结构等，统一从 src/modules/query-trace/typings 引入，不在组件中临时自定义结构。
- 样式与 UI：
  - 组件样式统一使用 *.module.less，并通过 import s from './xxx.module.less' 或 styles 引入，配合 classNames 组合类名。
  - 通用 UI 组件库为 @coze-arch/bot-semi / @coze-arch/coze-design，避免引入额外的 UI 组件库；Loading/Spin 等优先使用 @coze-arch/bot-semi 提供的组件。
- i18n：
  - 文案统一通过 @coze-arch/i18n.I18n.t('key') 获取，不在组件内写死文案；
  - 新增指标或 Tooltip/Label 文案时，请补充对应 i18n key（在上游 i18n 仓库中），本包中只使用 key。
- 命名习惯：
  - CSpan/CTrace 等 "C" 开头的数据结构表示「前端自定义的 Canonical Span/Trace」，与服务侧 Span 区分；
  - DataSourceTypeEnum 区分 SpanData 与 TraceId 两种数据源形态，组件层只区分这两种，不接受更细的类型变种。

## 4. 关键组件与外部依赖集成

- Span → CSpan 转换（数据规范化）：
  - 入口：src/modules/query-trace/utils/cspan-transform.ts。
  - span2CSpan：
    - 接收 @coze-arch/bot-api/ob_query_api.Span，统一将多种 attr_xxx 字段「归一到 extra」字段：
      - 包含 attr_user_input / attr_invoke_agent / attr_llm_call / attr_workflow_llm_call / attr_plugin_tool / attr_chain / attr_bw_* 等多种变体；
      - 优先级按代码顺序选择第一个非空对象。
    - 通过 SpanCategoryMeta 构造 SpanCategoryMap，把 Span.type 映射到 category，后续用于图表/颜色分类。
  - spans2CSpans：
    - 先通过 uniqBy(spans, 'id') 做去重；
    - 按是否为 "batch" 类型（isBatchSpanType）拆分成单条 Span 与批量 Span；
    - 批量 Span 通过 aggregationBatchSpan 按 workflow_node_id + type + task_index 聚合成 CSPanBatch（计算统一的 start_time / latency / status）。
- flamethread 链路火焰图：
  - 可视化组件：src/modules/query-trace/components/trace-flamethread/index.tsx。
  - 封装 @visactor/vgrammar 图表引擎，通过内部 Flamethread 组件（components/flamethread）实现：
    - useEffect 根据 dataSource.type（SpanData / TraceId）与 spanData / traceId 初始化 flamethreadData；
    - tooltip 内容使用 getStatusLabel / getTokens 计算状态、延迟、token 数，并通过 I18n.t 渲染多语言。
  - 扩展点：
    - 通过 props.rectStyle / labelStyle / globalStyle 与 defaultProps 合并方式定制样式（Object.assign 叠加）；
    - onClick 回调可捕获 RectNode 点击事件，业务可据此跳转或高亮其他视图。
- TraceTree 调用树：
  - 组件入口：src/modules/query-trace/components/trace-tree/index.tsx。
  - 依赖底层 Tree 组件（components/tree）与 spanData2treeData 工具：
    - 同样支持 DataSourceTypeEnum.SpanData / TraceId 两种数据源；
    - 通过 spanTypeConfigMap 与 tree util 计算每个节点的文案、图标、颜色及交互行为。
  - 与运行时系统集成：
    - 通过 @coze-arch/bot-hooks.usePageJumpService 与 SceneType.BOT__VIEW__WORKFLOW 实现「点击节点跳转 Workflow 页面」；
    - 需要 spaceId 才能发起跳转，参数封装在 WorkflowJumpParams 中。
- TopologyFlow 拓扑图：
  - 组件入口：src/modules/query-trace/components/topology-flow/index.tsx。
  - 使用 reactflow 渲染拓扑：
    - useGenerateTopology 负责从业务数据生成节点/边；
    - useLayoutTopology 负责在 DOM 渲染后计算布局（包括尺寸响应、自动定位等），返回 ref 绑定在最外层容器；
    - CUSTOM_NODES / CUSTOM_EDGES 自定义节点与边类型，对接 reactflow 的 nodeTypes / edgeTypes。
  - UI 行为：
    - 禁用节点拖动和连线（nodesDraggable={false}, nodesConnectable={false}）；
    - 自带 loading 状态，通过 Spin 组件渲染；
    - 支持外部自定义 renderHeader(topologyType) 以渲染业务标题/工具栏。
- Tree/Flamethread 通用组件：
  - components/tree 与 components/flamethread 提供可复用的树形视图 / 火焰图基础实现，TraceTree / TraceFlamethread 在其之上做 query-trace 领域装饰。
  - 若在其他模块中重用这些基础组件，建议保持 API 与当前使用方式一致，避免在组件内部硬编码 query-trace 逻辑。

## 5. 项目流程与协作规范

- 版本管理与发布：
  - package.json.version 当前为 0.0.1，且 private=true，说明该包主要在 monorepo 内部使用；发布或版本提升应遵守根目录 Rush / 版本管理流程（见仓库 README / rush.json），不要在子包内单独执行 npm publish。
- 代码所有权：
  - 该包属于 DevOps 业务下 team-devops，可能有 OWNERS 文件（若存在请遵守其评审要求）。
  - 重要改动（新增导出、更改核心数据结构）需要兼容现有调用方（其他 apps / packages），如有破坏性变更需提前在上层协调。
- 提交流程：
  - 保持 eslint / stylelint / vitest 全通过；
  - 如改动影响 Storybook 示例，请同步更新 stories 与 README，确保组件用法示例准确。
- 部署与运行：
  - 本包不直接参与生产部署流程，而是被应用（frontend/apps/*）引用；
  - 若新增依赖，请优先使用 workspace:* 或 monorepo 已存在的版本，避免在子包中引入与上层不一致的第三方版本。

## 6. 特殊注意事项与坑

- 多种 Span attr_xxx 兼容：
  - cspan-transform.ts 中 span2CSpan 针对大量 attr_* 字段做回退处理，是兼容历史/多版本后端的关键逻辑；
  - 修改该逻辑前必须确认所有使用场景（查询链路、Bot 工作流、Black/White Workflow 等），并补充对应单测。
- 批量 Span 聚合：
  - aggregationBatchSpan 严格依赖 extra.task_total / extra.task_index / extra.workflow_node_id 字段；
  - 若后端字段含义或格式调整，需要同时更新聚合逻辑和相关配置，否则会导致 batch 可视化错误（时间轴对不齐或丢数据）。
- 数据源模型：
  - 所有上层组件都假设 dataSource.type 只会是 SpanData 或 TraceId，两种模式下内部会分别走「直接用 SpanData」或「getSpanDataByTraceId 再转换」的逻辑；
  - 若未来引入新的数据源形态，应先扩展 DataSourceTypeEnum 和对应 utils，再改动组件层逻辑，保持统一入口。
- 性能与排序：
  - cspan-transform 中的 compareByStartAt / compareByTaskIndex 等排序逻辑直接影响火焰图与树的显示顺序；
  - 在处理大规模 Span 集合时要注意尽量复用现有排序/聚合工具，而不是在组件中额外排序一次。

## 7. 面向 AI 助手的具体建议

- 在新增功能或重构时，请优先：
  - 确认是否应放在现有 query-trace 模块内，或拆出新的 modules/* 子目录；
  - 先设计 typings 与 config（类型与配置），再补充 utils / hooks，最后接入 components；
  - 所有对外暴露的组件或工具函数，都从 src/index.ts 统一导出，并同步更新 package.json.exports / typesVersions。
- 在修改已有逻辑时：
  - 对 cspan-transform / cspan-graph / field-item-handler 等核心数据处理文件要保持向后兼容，并为新分支补充单测；
  - 对 TraceFlamethread / TraceTree / TopologyFlow 的 props 进行扩展时，尽量以可选字段形式添加，避免改变现有必填字段语义；
  - 涉及跳转（usePageJumpService）或 token 统计（getTokens）等跨包行为时，查阅对应上游包的 README 与类型定义，确保参数正确。
