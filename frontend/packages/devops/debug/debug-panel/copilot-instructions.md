# @coze-devops/debug-panel 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/devops/debug/debug-panel）中安全、高效地协作开发。

## 1. 全局架构与职责边界

- 本包是 DevOps 侧的“调试面板（Debug Panel）”前端组件子库，用于在 Bot 调试/运营场景中查看查询链路、请求详情与 Span 信息，作为业务应用中的侧边调试面板嵌入使用。
- 对外导出统一入口位于 src/index.ts：
  - 默认导出 DebugPanel 组件（调试侧边栏容器）。
  - 命名导出 DebugPanelProps 类型，约束外部调用传入的基础信息（botId、spaceID、userID、placement、currentQueryLogId、isShow、onClose）。
- 组件树与模块划分（仅列出关键部分）：
  - src/components/debug-panel/index.tsx：DebugPanel 对外组件，负责初始化 store、上报埋点、管理 isShow / onClose 与卸载时 resetStore。
  - src/components/debug-panel/side-panel/index.tsx：SideDebugPanel 主体 UI，包括查询列表、摘要区域和 Span 详情区域，承载绝大部分业务逻辑和 API 调用。
  - src/components/debug-panel/query-filter / summary / detail / header / side-panel/span-info.tsx：调试面板内部各功能区组件。
  - src/store/index.ts：基于 zustand 的 DebugPanelStore，管理调试面板的全部状态（筛选条件、当前选中 Trace/Span、Span 列表等）。
  - src/hooks/use-debug-panel-layout-config.tsx：维护面板布局（宽高）在 localStorage 中的持久化，并通过 Resizable 组件调整。
  - src/consts/*：env / static / span / index.ts 等，收集常量配置（时间窗口、分页限制、默认布局模板等）。
  - src/utils/*：url.ts / field-item.tsx / span.ts / index.ts 等，负责 URL 参数解析、字段展示、Span 数据增强等通用逻辑。
- 数据与调用链路（高层视角）：
  - 上层业务通过 DebugPanelProps 传入 botId / spaceID / userID / currentQueryLogId / isShow。
  - DebugPanel 在 useEffect 中：
    - 调用 useDebugPanelStore 的 setBasicInfo / setEntranceMessageLogId / setIsPanelShow 写入 store；
    - 使用 sendTeaEvent(EVENT_NAMES.debug_page_show) 上报埋点；
    - 组件卸载时调用 resetStore 恢复初始状态。
  - SideDebugPanel 根据 store 中的 basicInfo / entranceMessageLogId / filter 状态，调用 @coze-arch/bot-api.obQueryApi：
    - ListDebugQueries 拉取查询列表；
    - BatchGetTracesAdvanceInfo 获取 Trace 补充信息（时间范围等）；
    - GetTraceByLogID 查询某条 LogID 对应的完整 Span 列表；
    - GetTracesMetaInfo 获取 SpanCategory 配置。
  - 获取到的原始 Span 会通过 utils/span.ts 中的 enhanceOriginalSpan 与 getSpanProp 做二次处理，生成 CSpan[] 和上层展示所需的字段。

## 2. 状态管理与核心数据结构

- Store 定义：src/store/index.ts
  - DebugPanelStore（状态）：
    - isPanelShow：当前调试面板是否展示。
    - basicInfo：基础上下文信息 BasicInfo（包含 botId / spaceID / userID / placement）。
    - entranceMessageLogId：从哪条消息/查询进入调试面板的 Query LogID。
    - targetDateId：时间筛选选中项（QueryFilterItemId，默认 FILTERING_OPTION_ALL）。
    - targetExecuteStatusId：执行状态筛选选中项（QueryFilterItemId，默认 FILTERING_OPTION_ALL）。
    - targetOverallSpanInfo：当前选中的 Trace 概览信息（TargetOverallSpanInfo，包含 logId / input / output / span）。
    - enhancedOverallSpans：当前展示列表中的 CSpan[]（经过 enhanceOriginalSpan 的结果）。
    - orgDetailSpans：当前选中 Trace 下的原始 Span[] 列表（来自后端）。
    - spanCategory：SpanCategory 配置（GetTracesMetaInfoData['span_category']）。
    - targetDetailSpan：当前在详情区域选中的 CSpan。
    - curBatchPage：批量 Span 详情分页用的当前页数。
  - DebugPanelAction（操作方法）：
    - setIsPanelShow / setBasicInfo / setEntranceMessageLogId。
    - setTargetOverallSpanInfo：切换当前选中 Trace。
    - onSelectDate / onSelectExecuteStatus：修改筛选条件。
    - setEnhancedOverallSpans / setOrgDetailSpans / setSpanCategory / setTargetDetailSpan / setCurBatchPage。
    - resetStore：重置为 initialStore，供 DebugPanel 卸载时调用。
  - 状态持久化与调试：
    - 使用 zustand + devtools 中间件，devtools 配置 enabled: IS_DEV_MODE、name: 'debug.debugPanelStore'。
    - IS_DEV_MODE 定义在 src/consts/env.ts（读取环境变量），仅在开发环境打开 devtools。
- Consts：src/consts/index.ts
  - DATE_FILTERING_DAYS_NUMBER：支持筛选的时间跨度天数（默认 7）。
  - FILTERING_OPTION_ALL：时间/状态筛选中代表“全部”的占位值 'ALL'。
  - FILTERING_LIMIT：ListDebugQueries 每次拉取的条数（默认 30）。
  - TRACES_ADVANCE_INFO_TIME_BUFFER：调用 BatchGetTracesAdvanceInfo 时在 end_time 上扩展的缓冲毫秒（1000）。
  - INITIAL_OFFSET：默认分页 offset 标记 '0'；若返回 next_page_token 为空则复位为 INITIAL_OFFSET。
  - EMPTY_TEXT：展示空值时使用的 '-'.
  - QUERY_FILTER_DEBOUNCE_TIME：查询筛选防抖时间（300ms）。
  - DEBUG_PANEL_LAYOUT_KEY：localStorage key 'coze_debug_panel_layout_config'。
- 布局配置：src/hooks/use-debug-panel-layout-config.tsx + src/consts/static.tsx
  - useDebugPanelLayoutConfig：
    - 首次调用时从 localStorage 读取 DEBUG_PANEL_LAYOUT_KEY，如果存在且为合法 JSON 则解析为 DebugPanelLayoutConfig，否则使用 DEBUG_PANEL_LAYOUT_DEFAULT_INFO。
    - 使用 useRef 持有当前布局配置，setLayoutConfig 支持：
      - 直接传入完整 DebugPanelLayoutConfig；
      - 传入函数 (draft) => void，并通过 immer.produce 返回新的配置。
    - 每次更新时会 JSON.stringify 并写回 localStorage，确保刷新后仍能保留用户调整的宽高。
  - static 中定义 DEBUG_PANEL_LAYOUT_DEFAULT_TEMPLATE_INFO 与 DebugPanelLayout 枚举，分别为侧边整体、Summary 区域等提供最小/最大宽高约束。

## 3. SideDebugPanel 组件与数据流细节

- 文件：src/components/debug-panel/side-panel/index.tsx
- 对外 Props：
  - SideDebugPanelProps：仅包含 onClose 回调，由 DebugPanel 传入。
- 内部依赖与渲染：
  - 使用 Resizable（re-resizable）实现外层宽度与 Summary 区域高度拖拽，min/max 取自 DEBUG_PANEL_LAYOUT_DEFAULT_TEMPLATE_INFO；onResizeStop 中调用 setLayoutConfig 调整对应数值。
  - 使用 useDebugPanelStore() 读取以下字段：basicInfo、isPanelShow、targetDateId、targetExecuteStatusId、targetOverallSpanInfo、enhancedOverallSpans、spanCategory、orgDetailSpans、targetDetailSpan、curBatchPage、entranceMessageLogId 以及对应的 setter 函数。
  - QueryFilter：查询筛选列表区域，负责展示 enhancedOverallSpans，并提供 onFetchQuery / onSelectQuery / onSelectDate / onSelectExecuteStatus / showLoadMore 等。
  - PanelSummary：展示当前选中 Trace 的输入/输出等摘要信息。
  - SpanInfoArea（span-info.tsx）：展示具体 Span 详情、批次分页（curBatchPage）等。
  - UI 库：Divider / Empty / Spin 来自 @coze-arch/bot-semi；IllustrationNoResult 来自 @douyinfe/semi-illustrations；文案通过 I18n.t 获取。
- 异步数据加载逻辑：
  - handleFetchQuery(inputSearch?: string, loadMore?: boolean)：
    - 非 loadMore 时会清空 showLoadMore 并重置 queryOffsetRef 为 INITIAL_OFFSET；
    - 调用 obQueryApi.ListDebugQueries：
      - 入参含 spaceID / botID / status（当 targetExecuteStatusId === FILTERING_OPTION_ALL 时不传）/ inputSearch / limit / pageToken（offset 指针）/ getDailyTimestampByDate(targetDateId)；
      - 使用 qs.stringify({ arrayFormat: 'comma' }) 处理数组参数；
    - 更新 queryOffsetRef 为 data.next_page_token（若为空则回到 INITIAL_OFFSET），showLoadMore 为 data.has_more；
    - 若 originSpans 为空，则清空 enhancedOverallSpans 并返回 []；
    - 否则调用 obQueryApi.BatchGetTracesAdvanceInfo：
      - 传入 traces: [{ trace_id, start_time, end_time = start_time + latency + TRACES_ADVANCE_INFO_TIME_BUFFER }]；
      - 使用 enhanceOriginalSpan(originSpans, traceAdvanceInfo) 得到 enhancedSpans；
      - 如果 loadMore=true，则在原有 enhancedOverallSpans 尾部追加；否则直接替换；
      - 最后通过 setEnhancedOverallSpans 更新 store，并返回最终 spans。
  - handleFetchQueryDetail(logId: string)：
    - 调用 obQueryApi.GetTraceByLogID({ space_id: spaceID, bot_id: botId, log_id })；
    - 将返回 spans 写入 setOrgDetailSpans，并返回 spans。
  - handleFetchTracesMetaInfo()：
    - 调用 obQueryApi.GetTracesMetaInfo()；
    - 将 data.span_category 写入 setSpanCategory。
  - selectQueryAuto(span: CSpan)：
    - 通过 getSpanProp(span, 'log_id' | 'simple_input' | 'output') 提取字段，构造 TargetOverallSpanInfo 并写入 setTargetOverallSpanInfo。
- 副作用与初始加载：
  - useAsyncEffect 1（监听 targetOverallSpanInfo）：
    - 每当 targetOverallSpanInfo 变化时，取出 span 的 log_id，调用 handleFetchQueryDetail(logId) 填充 orgDetailSpans；期间设置 subAreaLoading。
  - useAsyncEffect 2（监听 isPanelShow / entranceMessageLogId）：
    - 当 isPanelShow 为 true 时：
      - 初始化 loading = true，重置日期和状态筛选为 FILTERING_OPTION_ALL；
      - 若 spanCategory 为空则先调用 handleFetchTracesMetaInfo 填充。
      - 如果入口带有 entranceMessageLogId：
        - 先调用 handleFetchQueryDetail(entranceMessageLogId) 获得 spans；
        - 在 spans 中寻找 type === SpanType.UserInput 的 Span 作为 userInputSpan；
        - 再调用 BatchGetTracesAdvanceInfo 为该 Span 构造 traceAdvanceInfo，并通过 enhanceOriginalSpan 得到 userInputCSpan；
        - 使用 selectQueryAuto(userInputCSpan) 将其设为当前选中 Trace。
      - 如果没有 entranceMessageLogId，则直接调用 handleFetchQuery() 拉取列表，并选择最新一条 enhancedSpans[0] 作为默认选中 Trace。
      - 最后统一将 loading 设为 false。

## 4. 外部依赖与集成注意事项

- @coze-arch/bot-api.obQueryApi
  - ListDebugQueries
    - 输入：spaceID、botID、status[]（SpanStatus）、inputSearch、limit、pageToken（分页令牌）、起止时间戳（通过 getDailyTimestampByDate 得出）。
    - 输出：spans[]、next_page_token、has_more。
  - BatchGetTracesAdvanceInfo
    - 输入：space_id、bot_id、traces[{ trace_id, start_time, end_time }]。
    - 输出：traces_advance_info，用于增强 Span 时间范围与统计信息。
  - GetTraceByLogID
    - 输入：space_id、bot_id、log_id。
    - 输出：spans（当前 Trace 的完整 Span 列表）。
  - GetTracesMetaInfo
    - 输出：span_category 信息，用于对 Span 类型做分类与展示配置。
- @coze-devops/common-modules/query-trace
  - CSpan 类型在 DebugPanelStore 中大量使用，是 query-trace 模块提供的前端标准化 Span 结构。
  - enhanceOriginalSpan 和 getSpanProp 等工具封装在 src/utils/span.ts 之上，对原始 Span 与 traceAdvanceInfo 做融合，DebugPanel 应尽量通过这些工具处理 Span，而不是在组件中重复写逻辑。
- UI 与交互库
  - @coze-arch/bot-semi：Divider、Empty、Spin 等基础组件，保持与其他前端子包一致的 UI 风格。
  - @douyinfe/semi-illustrations：使用 IllustrationNoResult 作为空状态插画。
  - ahooks：useAsyncEffect 用于封装异步副作用；编写新异步逻辑时可复用该 hook，而不是自己手写复杂 useEffect + async。
  - re-resizable：用于实现左侧调试面板宽度和 Summary 区域高度可调；传入 enable 与 min/maxWidth/Height 等参数时需与 DEBUG_PANEL_LAYOUT_DEFAULT_TEMPLATE_INFO 保持一致。
  - qs：用于 query 参数序列化，特别是数组参数（arrayFormat: 'comma'），必须与后端 API 预期一致。
- 埋点：@coze-arch/bot-tea
  - DebugPanel 挂载时通过 sendTeaEvent(EVENT_NAMES.debug_page_show, { bot_id, workspace_id: spaceID }) 上报“调试页面展示”事件。
  - 如需新增调试面板相关埋点，请统一使用 bot-tea 的 EVENT_NAMES 常量，并与现有埋点规范保持一致。

## 5. 开发、构建与测试工作流

- package.json 中定义的脚本：
  - build："exit 0"，当前无独立构建逻辑；实际构建由上层 Rush/应用打包流程统一处理，不要在此包直接引入 bundler。
  - lint："eslint ./ --cache"，使用 repo 统一的 eslint.config.js 与 @coze-arch/eslint-config；新增 TS/React 代码须保持 lint 通过。
  - test："vitest --run --passWithNoTests"，配置文件为 vitest.config.ts（基于 @coze-arch/vitest-config）。
  - test:cov：npm run test -- --coverage，启用 @vitest/coverage-v8 覆盖率统计。
- 本包在 monorepo 中的 Rush 配置：
  - 位于 config/rush-project.json，参与前端整体构建/检查；如需新增自定义 operation，需同步更新根目录 rush.json 与相关脚本。
- Storybook 支持：
  - .storybook/main.js 指定框架为 @storybook/react-vite，使用 viteFinal 合并 vite-plugin-svgr 配置。
  - 若为 DebugPanel 衍生出可独立预览的子组件，建议在 stories 目录中补充相应 stories.tsx/mdx，方便交互调试；但当前仓库主要面向作为业务组件被应用直接嵌入。

## 6. 项目约定与编码规范（本子包特有）

- 组件边界与职责：
  - DebugPanel（外层组件）只负责：
    - 将 props 映射到 store（setBasicInfo / setEntranceMessageLogId / setIsPanelShow）。
    - 生命周期管理（挂载埋点、卸载 resetStore）。
    - 将 onClose 透传给 SideDebugPanel。
  - SideDebugPanel（业务主体）负责：
    - 所有 API 调用与筛选条件处理；
    - 布局调整与数据装配；
    - 将必要的数据与回调下发到子组件（QueryFilter / PanelSummary / SpanInfoArea 等）。
  - 子组件应尽量保持“展示 + 简单交互”，不直接访问 store，而通过 props 接收数据与事件。
- 与 query-trace 模块的协作：
  - 调试面板不直接依赖 @coze-devops/common-modules 的 UI 组件，而是通过其暴露的 CSpan 类型/数据结构来驱动自己的查询/详情视图；
  - 若需在 DebugPanel 中展示更多图表或视图，优先考虑使用 common-modules 中已有的 TraceTree / TraceFlamethread / TopologyFlow 等组件，而不是重新实现同类功能。
- 本地持久化与副作用：
  - 所有与 localStorage 交互的逻辑集中在 use-debug-panel-layout-config.tsx 中，其他组件不要直接读写 DEBUG_PANEL_LAYOUT_KEY；
  - useAsyncEffect 用于包装包含 async 的副作用，避免在普通 useEffect 中直接传递 async 函数导致的隐式行为。
- 错误处理与用户体验：
  - SideDebugPanel 中的异步调用使用 try/finally 保证 loading 与 subAreaLoading 状态正确复原；
  - 对于接口返回的数据为空时，统一通过 Empty + IllustrationNoResult + I18n 文案展示；
  - 不在组件中直接抛异常，调试信息建议通过浏览器 DevTools 或 logger（若后续集成）观察。

## 7. 面向 AI 助手的具体开发建议

- 新增能力/修改逻辑时的优先原则：
  - 先确认需求是否属于“调试面板视图增强”还是“query-trace 数据处理增强”：
    - 前者应主要改动 DebugPanel / SideDebugPanel / 子组件，尽量少动 utils/span.ts 与 store 结构；
    - 后者应优先在 utils/span.ts 或 common-modules/query-trace 中完善数据处理逻辑，再由视图层消费。
  - 修改 DebugPanelStore 结构（新增字段或动作）时：
    - 在 initialStore 中给出合理默认值；
    - 补充对应 setter，并在相关组件中按需使用；
    - 确认 resetStore 行为仍然可以恢复到合理的初始页面状态。
- 使用已有工具与模式：
  - 所有时间区间、分页、筛选相关逻辑应复用 src/consts 中的常量与 utils/getDailyTimestampByDate 等工具，不要在组件内部硬编码时间计算。
  - 需要从 Span 读取字段时，优先使用 getSpanProp，而不是直接访问 span.extra.xxx，以保持与 common-modules 的兼容性。
  - 新增布局相关配置时，扩展 DebugPanelLayout / DEBUG_PANEL_LAYOUT_DEFAULT_INFO / DEBUG_PANEL_LAYOUT_DEFAULT_TEMPLATE_INFO，保持 useDebugPanelLayoutConfig 的统一管理。
- 提交前自查：
  - 确保 npm run lint 与 npm test 在 frontend 目录下可通过；
  - 检查是否破坏 DebugPanelProps 的外部契约（新增必填字段应谨慎，尽量通过可选字段扩展），并在 README.md 或调用方应用中同步更新用法。

以上内容均基于当前仓库实现整理，后续如有结构/流程调整，可在本文件中同步更新，以便 AI 编程助手持续正确协作。