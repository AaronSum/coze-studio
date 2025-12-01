# @coze-common/table-view 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/table-view）中安全、高效地协作开发。

## 全局架构与职责划分

- 本子包是一个「支持原位编辑、统一数据结构」的表格 UI 组件库，对外主要通过 [src/index.ts](src/index.ts) 暴露：
  - 组件：`TableView` 及其实例方法 `TableViewMethods`（`resetSelected`、`getTableHeight`）。
  - 渲染子组件：`TextRender`、`EditHeaderRender`、`TagRender`、`ActionsRender`、`ImageRender`，用于各类单元格展示。
  - 类型：`TableViewValue`、`TableViewColumns`、`TableViewRecord` 和编辑相关枚举、校验类型，定义在 [src/components/types.ts](src/components/types.ts)。
  - 服务：列宽缓存服务 `colWidthCacheService`，定义在 [src/components/table-view/service.ts](src/components/table-view/service.ts)。
- 表格主体逻辑集中在 [src/components/table-view/index.tsx](src/components/table-view/index.tsx)：
  - 负责将业务无关的 `dataSource` / `columns` 映射为内部数据结构并挂载 `tableViewKey`，再透传给 `UITable`（来自 `@coze-arch/bot-semi`）。
  - 通过 `EditMenu` / `EditToolBar` 管理右键菜单和批量操作工具栏，并把用户操作回调封装为 `editProps` 对外暴露。
  - 封装虚拟滚动、滚动到底触发 `scrollToBottom` 回调、列宽伸缩和缓存、行选择、主题切换（`useTheme`）等逻辑。
- 渲染层拆分在 [src/components/renders](src/components/renders) 下：
  - `TextRender`、`TagRender`、`ActionsRender`、`ImageRender` 等负责单元格内容的具体展示形式。
  - `EditHeaderRender` 负责表头编辑相关的展示与交互（如全选、多选、操作入口等）。
- 编辑菜单与工具栏集中在 [src/components/table-view/edit-menu.tsx](src/components/table-view/edit-menu.tsx)：
  - 通过 `EditMenu`（右键菜单）和 `EditToolBar`（顶部操作条）两种形态暴露行编辑/删除等能力。
  - 配置由 `EditMenuItem` 枚举 + `getRowOpConfig`（在 `utils.ts` 中）驱动，可扩展性较好。
- 列宽缓存服务 [src/components/table-view/service.ts](src/components/table-view/service.ts)：
  - 使用 `window.localStorage` + `Map` 结构实现简单 LRU，按 `tableKey` 维度缓存每个列 `dataIndex` 对应的 `width`。
  - 出错时通过 `CustomError` + `REPORT_EVENTS` 上报埋点，注意这里是业务级错误并非 UI 反馈。
- Storybook 配置位于 [.storybook/main.js](.storybook/main.js) 和 [.storybook/preview.js](.storybook/preview.js)，用于本组件的可视化调试与文档演示。

## 开发与运行流程

- 依赖管理：本包遵循 Rush monorepo 规范，首次在仓库根目录执行：
  - `rush update` 安装依赖（参考 [README.md](README.md)）。
- 本子包常用脚本（在本目录执行）：
  - `npm run dev`：启动 Storybook，端口默认为 6006，用于交互调试组件行为与视觉效果。
  - `npm run test`：使用 Vitest 运行单测（配置见 [vitest.config.ts](vitest.config.ts)，预设 `preset: 'web'`）。
  - `npm run test:cov`：带覆盖率的测试。
  - `npm run lint`：执行 ESLint 检查（规则由 `@coze-arch/eslint-config` 统一管理，配置见 [eslint.config.js](eslint.config.js)）。
  - `npm run build`：当前实现为 `exit 0`，在此子包内不做实际构建，真实构建通常由上层工具链统一处理。
- Storybook：
  - 配置文件 [ .storybook/main.js ] 使用 `@storybook/react-vite` + `vite-plugin-svgr`，可在 `stories` 目录新增交互样例。
  - 若引入 SVG 资源，优先通过 SVGR（`import Icon from './xxx.svg?react'`）方式使用。

## 组件行为与关键数据流

- 数据流（核心在 [src/components/table-view/index.tsx](src/components/table-view/index.tsx)）：
  - 外部传入 `dataSource: TableViewRecord[]` 与 `columns: TableViewColumns[]`。
  - 内部使用 `tableData = dataSource.map((data, index) => ({ ...data, tableViewKey: String(index) }))` 保证每一行有稳定主键，并通过 `getRowKey` 作为 `UITable` 的 `rowKey`。
  - 所有列定义经过 `columnsHandler` 包装：
    - 注入 `onCell`，捕获右键事件以控制 `EditMenu` 显示和位置。
    - 若未提供 `render`，统一使用 `TextRender` 进行只读显示。
- 选择与批量操作：
  - `rowSelect` 开启时，`rowSelection` 传给 `UITable`，选中行集合存入组件内部 `selected` 状态。
  - `EditToolBar` 根据 `selected` 是否为空控制显示，按钮文案/行为依赖 `EditMenuItem` 配置和 `getRowOpConfig`。
  - `rowOperation` 为 true 时，行右键弹出 `EditMenu`，`menuConfigs` 根据选中数量动态决定展示“编辑/删除/批量删除”。
- 虚拟滚动与滚动到底：
  - `isVirtualized` 为 true 时，`TableWrapper` 使用 `AutoSizer` 包裹 `UITable`：
    - 高度减去 `HEADER_SIZE` 作为纵向滚动区域，行高 `ITEM_SIZE` 固定为 56。
    - `virtualized.onScroll` 会在接近底部时（`scrollOffset + height - HEADER_SIZE >= tableData.length * ITEM_SIZE`）调用 `scrollToBottom`，且通过 `useDebounceFn` 做 100ms 防抖。
- 列宽伸缩与缓存：
  - `resizable` 为 true 时，`UITable.tableProps.resizable` 有效：
    - `onResize`：优先调用外部传入的 `onResize(col)`，否则退回到内部 `resizeFn`。
    - `onResizeStop`：
      - 使用当前列的 `dataIndex` 更新 `newColumns` 列数组；
      - 将所有带 `dataIndex` 的列宽度 (`width`) 整理为 `widthMap`，并通过 `colWidthCacheService.setWidthMap(widthMap, tableKey)` 落入 localStorage；
      - 若 `tableKey` 未传，则不会写缓存。
  - 组件挂载时调用 `colWidthCacheService.initWidthMap()`，保证缓存结构存在。
- 主题与空状态：
  - 通过 `useTheme` 读取主题，转为 `styles.dark` / `styles.light` 作为外层容器 class；请保持新样式类也遵循此模式。
  - 当 `dataSource` 为空且 `loading` 为 false 时，若未传入自定义 `empty`，显示默认空态 `EmptyStatus`（使用 `UIEmpty` + `IllustrationNoResult`）。

## 类型、约定与模式

- 类型及模式：
  - 统一使用 [src/components/types.ts](src/components/types.ts) 中定义的类型：
    - `TableViewRecord`：要求是 key 到 `TableViewValue` 的映射，并可带内部字段 `tableViewKey`。
    - `TableViewColumns`：基于 `@coze-arch/bot-semi/Table` 的 `ColumnProps<TableViewRecord>`，请优先复用而非重新定义。
    - `TableViewMode`、`EditMenuItem` 用于标识当前模式与可用菜单项；新增菜单项需要同时扩展这些枚举与 `getRowOpConfig`。
    - `ValidatorProps` 约定列编辑时的校验函数和错误信息，若在未来扩展编辑表单，请复用该接口。
- I18n 规范：
  - 所有文案均通过 `I18n.t(key)` 获取，示例见空态描述 `dataset_segment_empty_desc` 和工具栏文案 `table_view_002`。
  - 新增文案必须使用 I18n key，不要写死中文或英文字符串。
- 错误与埋点：
  - 异常场景（例如 localStorage 读写失败）通过 `CustomError(REPORT_EVENTS.XXX, message)` 抛出，以便统一上报。
  - 不要在 UI 组件里直接 `console.error` 或静默吃掉错误，如需新埋点请在 `@coze-arch/report-events` 中新增并统一使用。
- 样式：
  - 表格样式集中在 [src/components/table-view/index.module.less](src/components/table-view/index.module.less) 与 [src/components/renders/index.module.less](src/components/renders/index.module.less)（若存在），遵循 `data-table-view`、`table-view-actions` 等 BEM 风格命名。
  - 切勿在组件中直接写行内样式控制主题/布局，优先通过 CSS Modules className 组合实现。

## 测试策略与注意事项

- 测试技术栈：Vitest + React Testing Library + Jest DOM（见 [__tests__/components/table-view/index.test.tsx](__tests__/components/table-view/index.test.tsx) 等）。
- 当前测试特点：
  - 强依赖 `vi.mock` 对外部依赖做模拟：`ahooks`、`@coze-arch/i18n`、`@coze-arch/coze-design`、`@coze-arch/bot-semi`、`@coze-common/virtual-list`、`@douyinfe/semi-illustrations` 以及本包内部的 `renders`、`service`、`edit-menu`、样式文件等。
  - 测试重点在：
    - 表格渲染是否正常（行数、空态、自定义空态、loading 状态）。
    - 虚拟滚动开启时能否正常渲染（但不深入校验滚动行为）。
    - `ref` 暴露的 `resetSelected`、`getTableHeight` 是否存在且返回预期值。
  - 部分测试只为覆盖率服务，并未真正断言副作用（如 `scrollToBottom` 调用、右键菜单可见性等），扩展时需谨慎不要改变已有测试假设。
- 新增/修改代码时的建议实践：
  - 若修改 `TableView` 对外 props 或行为，应同步更新对应测试文件，并考虑新增用例覆盖边界情况（如无 `tableKey`、无 `columns`、大量数据虚拟滚动等）。
  - Mock 路径使用相对路径（如 `../../../src/components/table-view/service`），新增模块时保持同一层级结构，避免测试 Mock 失效。

## 对外集成与依赖

- 外部 UI 与基础库：
  - `@coze-arch/bot-semi`：封装 Semi UI，`UITable` 和 `UIEmpty` 是最核心的承载组件；新的表格行为应尽量通过其 props 扩展而非绕过。
  - `@coze-arch/coze-design`：统一的设计系统组件（`Menu`、`Button`、`ButtonGroup`、`Space` 等）与主题能力 `useTheme`。
  - `@douyinfe/semi-illustrations`：插画资源，用于空态等场景。
  - `@coze-common/virtual-list`：提供 `AutoSizer` 等虚拟列表封装，请按现有用法传入 `children({ width, height })`。
- 业务基础设施：
  - `@coze-arch/i18n`：国际化；
  - `@coze-arch/report-events`：埋点上报事件常量；
  - `@coze-arch/bot-error`：统一错误类型 `CustomError`。
- 使用约束：
  - 本子包只负责表格 UI 和有限的交互逻辑，不应直接依赖具体业务 API 或 store；如需扩展行为，优先通过 props 回调（如 `onDelete`、`onEdit`、`scrollToBottom`、`onResize`）向上抛出。

## 代码风格与协作规范

- 代码风格：
  - 遵循 `@coze-arch/eslint-config` 和 `@coze-arch/ts-config`，不要显式覆盖通用规则；
  - 单测中的命名规范检查在 [eslint.config.js](eslint.config.js) 中被关闭（`@typescript-eslint/naming-convention: off`），便于使用中文描述和直观命名。
- 结构约定：
  - 新增组件时优先按当前结构拆分：
    - 入口导出集中在 [src/index.ts](src/index.ts)。
    - 视图组件放入 [src/components](src/components) 分子目录，按功能拆分（如 `table-view`、`renders`）。
    - 复用逻辑/工具放在同层 `utils.ts` 或新的 `service.ts` 文件中。
- 分支与发布：
  - 此仓库整体流程由上层 monorepo 管理（Rush + CI），本子包自身未定义独立的发布脚本；
  - 在修改组件行为前，建议保持向后兼容：避免改变默认 props 语义，新增能力优先以可选 props 形式暴露。

## 开发注意事项与坑点

- 浏览器环境假设：
  - `colWidthCacheService` 直接访问 `window.localStorage`，在非浏览器环境（如 SSR、某些单测场景）会抛错；
  - 单测中通过 Mock 避免访问真实 localStorage，新增测试请继续沿用此策略。
- 右键菜单与遮挡：
  - 右键菜单位置计算依赖 `document.body.offsetWidth/Height` 和常量 `SAFEY`、`SAFEX`，如需调整 UI 尺寸或密度，请同步更新这两个常量以保证菜单不会溢出视窗。
- 性能：
  - 虚拟滚动模式下，判断“滚动到底”的阈值为精确抵达，无额外余量；如果遇到浏览器差异导致回调不触发，优先考虑在该判断条件上做改动，而不是绕过虚拟滚动逻辑。
