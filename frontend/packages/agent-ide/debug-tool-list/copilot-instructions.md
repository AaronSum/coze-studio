# @coze-agent-ide/debug-tool-list 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/debug-tool-list）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 本包是 Agent IDE 中的「调试工具入口栏」UI 组件库，提供一个 DebugToolList 容器和若干 ToolPane / DebugDropdownButton 等子组件，用于在机器人详情或调试页面集中呈现调试工具入口。
- 入口文件为 src/index.ts，对外只导出 DebugToolList、ToolPane 以及与操作类型相关的枚举（OperateTypeEnum、ModalTypeEnum）。
- 核心结构：
  - DebugToolList：顶部工具条容器，负责布局、溢出处理及上下文注入。
  - ToolPane：单个工具入口，负责「按钮 + 交互区域」的组合（弹窗 / 下拉 / 自定义）。
  - DebugDropdownButton：具体的按钮渲染组件，封装 Tooltip + Menu + Button 交互细节。
  - ToolPaneContext：通过 React Context 向 ToolPane 下发统一的行为控制（标题展示、焦点管理、背景样式等）。
- 视觉与交互依赖：
  - 布局和溢出依赖 @blueprintjs/core 的 OverflowList；
  - 按钮、菜单、Tooltip 等基础控件依赖 @coze-arch/coze-design；
  - 弹窗与拖拽弹窗依赖 @coze-arch/bot-semi 的 UIModal、UIDragModal；
  - 样式使用 Less 模块（如 src/components/debug-tool-list/index.module.less、tool-pane/index.module.less）。

## 2. 关键组件与数据流

### 2.1 DebugToolList 容器

- 实现文件：src/components/debug-tool-list/debug-tool-list.tsx。
- Props：
  - className?: 外部扩展样式类；
  - style?: 行内样式；
  - showBackground: 是否在按钮上使用带背景的前景色（传入 ToolPaneContext 中）。
- 行为：
  - 接收子元素 children（通常为多个 ToolPane），过滤掉 null / undefined；
  - 使用 OverflowList 将 children 作为 items 渲染，当前实现中 overflowRenderer 返回 null，即溢出的项暂不额外展示；
  - 通过 visibleItemRenderer 为每个子项包裹 ToolPaneContextProvider，注入：
    - hideTitle: true（当前列表内默认只展示图标，不展示文案，由 tooltip 提供说明）；
    - focusItemKey / focusDragModal：用于 ToolPane 的拖拽弹窗焦点控制；
    - showBackground：跟随 DebugToolList 的 props.showBackground 控制按钮配色；
  - dragModalFocusItemKey 保存在列表级别的 useState 中，用于全局管理哪一个拖拽弹窗处于焦点状态。

### 2.2 ToolPane 与操作模型

- 实现文件：src/components/debug-tool-list/components/tool-pane/index.tsx。
- 枚举：
  - OperateTypeEnum：
    - MODAL：点击后弹出模态框（居中或可拖拽）；
    - DROPDOWN：点击后弹出下拉菜单；
    - CUSTOM：完全由外部自定义交互区域是否展示；
  - ModalTypeEnum：
    - Drag：可拖拽浮动弹窗（UIDragModal）；
    - CENTER：居中模态框（UIModal）。
- 核心 Props：
  - visible?: 是否展示入口按钮（为 false 时整个 ToolPane 返回 null 并触发 reComputeOverflow）；
  - itemKey: 唯一标识，用于焦点管理和拖拽弹窗 focusKey；
  - icon: 按钮图标；
  - title: 按钮标题（用于按钮内容和 Tooltip）；
  - operateType: 操作类型（枚举值）；
  - customShowOperateArea?: operateType=CUSTOM 时，外部控制当前是否处于“展开”态；
  - beforeVisible?: 弹出交互区域前的异步钩子（可用于数据拉取、权限校验等）；
  - modalType / modalProps：operateType=MODAL 时使用，children 作为弹窗内容；
  - dropdownProps：operateType=DROPDOWN 时使用，依赖 Dropdown 的 render / zIndex 等配置；
  - buttonProps / onEntryButtonClick：用于按钮行为扩展。
- 内部状态：
  - showOperateArea：是否展示当前 ToolPane 的交互区域（弹窗或“自定义展示”状态）。
- 行为流程：
  - onClickButton：
    - 始终先触发 onEntryButtonClick；
    - 若 operateType 为 DROPDOWN：直接返回，展示逻辑由 Dropdown 组件托管；
    - 若 operateType 为 CUSTOM：只调用 beforeVisible，交互区域展示由 customShowOperateArea 控制；
    - 若 operateType 为 MODAL：
      - 首次打开时先 await beforeVisible，再通过 focusDragModal(itemKey) 将当前弹窗设为焦点；
      - 切换 showOperateArea 状态以展示 / 关闭弹窗；
  - reComputeOverflow：当 visible 变更为 false 时调用（如果上层实现有传入），用于在 DebugToolList 中重新计算溢出布局（当前 DebugToolList 中未传入，未来扩展时需保持调用逻辑）。
  - 弹窗渲染：
    - ModalTypeEnum.CENTER：使用 UIModal，固定 zIndex 为 FOCUS_MODAl_ZINDEX，visible 由 showOperateArea 控制；
    - ModalTypeEnum.Drag：使用 UIDragModal，focusKey=itemKey，zIndex 根据是否为焦点（focusItemKey===itemKey）选择 FOCUS_MODAl_ZINDEX 或 DEFAULT_MODAl_ZINDEX，并在 onWindowFocus 中回调 focusDragModal。

### 2.3 DebugDropdownButton 与按钮样式

- 实现文件：src/components/debug-tool-list/components/debug-dropdown-button/index.tsx。
- 依赖：@coze-arch/coze-design 的 Button、Menu、Tooltip 以及 IconCozArrowDownFill；
- Props 要点：
  - withBackground / hideTitle：分别控制按钮背景样式以及是否只显示图标；
  - tooltipContent：hover 时 Tooltip 展示内容（默认回退为 children，即 title 文案）；
  - menuContent / menuProps / clickToHide：当存在 menuContent 时，包装在 Menu 中实现下拉行为；
  - buttonProps：透传给 Button，但内部会通过 omit 去除 onMouseEnter / onMouseLeave，改为在组件内统一处理 hover 状态；
  - active：当前工具是否处于激活态，会影响 Button 的 color（highlight vs secondary）。
- 行为：
  - 根据是否有下拉菜单决定是否展示 IconCozArrowDownFill；
  - 通过 getButtonPaddingStyle（button-padding-table.ts）根据是否有标题和下拉菜单计算一致的 padding；
  - 始终包在 Tooltip 中，trigger="custom" + visible=isHovering，确保即使隐藏标题也能通过 hover 查看含义；
  - withBackground 为 true 时，会增加统一的「白色前景」类名，用于适配深色背景区域。

## 3. 依赖与集成特点

- 核心依赖：
  - React 18：函数式组件 + hooks（useState、useContext、useUpdateEffect 等）；
  - ahooks：仅使用 useUpdateEffect，主要用于在 visible 变化时处理副作用（重算溢出）。
  - lodash-es：用于 omit 等函数式工具，习惯以 ESM 方式引入。
  - @blueprintjs/core：只使用 OverflowList 来处理按钮溢出布局；
  - @coze-arch/coze-design：统一的 UI 规范（Button、Menu、Tooltip、Icon）；
  - @coze-arch/bot-semi：统一的弹窗与拖拽弹窗实现，避免手写 portal / zIndex 策略。
- TypeScript 类型配置来自工作区通用 ts 配置（@coze-arch/ts-config），不要在本包内重复定义全局 TS 规则。
- 存在 src/typings.d.ts（此文件通常用于本包内局部 TS 声明，新增全局类型时优先放入该文件而非随意创建 .d.ts）。

## 4. 构建、测试与本地开发流程

- 本包由 Rush 统一管理，项目元信息在 config/rush-project.json 中；新增脚本或变更名称需同步考虑 Rush 配置及 workspace 链接。
- package.json 中的脚本：
  - lint: `eslint ./ --cache`，使用工作区统一 eslint 配置（@coze-arch/eslint-config）。
  - test: `vitest --run --passWithNoTests`，配置文件为 vitest.config.ts，通过 @coze-arch/vitest-config 预设 preset: 'web'。写单测时放在 __tests__ 目录或 *.test.ts(x)。
  - test:cov: 通过 `npm run test -- --coverage` 启动覆盖率（@vitest/coverage-v8）。
  - build: 当前实现为 `exit 0` 占位，实际打包多半由上层应用或统一打包流程接管，AI 不要擅自改为真实构建命令，除非需求明确指示。
- Storybook：
  - 配置文件位于 .storybook/main.js 与 .storybook/preview.js；
  - 使用 @storybook/react-vite 作为框架，并在 viteFinal 中挂载 svgr 插件以支持 SVG React 组件导入；
  - 创建新组件时，可在 stories 目录下添加对应 *.stories.tsx 进行交互展示。
- 运行说明：
  - 工作区初始化：在仓库根目录运行 `rush update`；
  - 若需要本地 Storybook：需在上层统一脚本中查找具体 dev 命令（README 中给出的 `npm run dev` 为模板说明，本包自身 package.json 未定义 dev）。

## 5. 代码风格与约定

- 语言与框架：
  - 一律使用 TypeScript + React 函数组件；
  - 枚举、常量等遵从当前文件命名风格（OperateTypeEnum、ModalTypeEnum 均为 PascalCase 枚举名 + 全大写枚举值）。
- 命名与结构：
  - 组件目录结构遵循：components/<component-name>/<component-name>.tsx + index.ts + index.module.less；
  - 对外导出统一从 src/index.ts 聚合，而非在 package.json 中暴露多个入口；
  - Context 统一放在 debug-tool-list-context.ts，其他组件通过 ToolPaneContext 使用，不要在子目录重复创建新的 Context 以免状态割裂。
- 样式与类名：
  - 使用 CSS Modules（*.module.less），className 通过 s['xxx'] 引用；
  - 混合使用内部样式与原子类（如 Tailwind 风格的 mr-[4px]、text-[14px]），新增样式时保持与现有写法一致，不要混入多套原子类体系。
- 交互约定：
  - Tooltip 默认展示 title 或 tooltipContent，用于在 hideTitle=true 时补充语义；
  - 所有与弹窗相关的显隐均通过 showOperateArea 控制，onCancel/onWindowFocus 等回调统一负责更新该状态和焦点；
  - 通过 itemKey 与 focusItemKey 实现 Drag 模态框的 zIndex 提升，新增 ToolPane 时务必保证 itemKey 全局唯一；
  - beforeVisible 必须安全可多次调用且可返回 Promise<void>，不允许在其内部抛出未捕获异常影响主交互。

## 6. 与外部系统的边界

- 本包只关注 UI 行为和交互编排，不直接操作业务数据或网络请求。
- 真实的调试工具逻辑（如日志查看、变量面板等）由外部在 children / dropdownProps.render / modalProps.children 中实现，本包仅负责：
  - 渲染入口按钮；
  - 决定弹出方式（弹窗 / 下拉 / 自定义）；
  - 管理焦点与层级（尤其是拖拽弹窗的聚焦行为）；
  - 统一视觉风格与布局（与 Agent IDE 其它子包保持一致）。
- 集成其他 workspace 包：
  - 与 @coze-studio/bot-detail-store、@coze-arch/bot-hooks 等的实际交互逻辑不会出现在本包内，AI 在修改或新增代码时不要臆造 store / hook，仅在外部组件中使用这些能力后再传入 ToolPane。

## 7. 开发建议（AI 专用）

- 修改或新增组件时：
  - 优先复用现有 DebugToolList / ToolPane / DebugDropdownButton 组合，而不是新增一套工具栏；
  - 若需要扩展交互类型，先考虑是否能在 OperateTypeEnum 或 ModalTypeEnum 基础上扩展，而不是硬编码在具体页面中。
- 在 AI 自动补全或重构时需注意：
  - 不要更改 package.json 中的 build/test 脚本语义，除非用户明确提出需求；
  - 不要删除或更改 ToolPaneContext 的字段名（hideTitle、focusItemKey、focusDragModal、reComputeOverflow、showBackground），以免破坏跨组件约定；
  - 保持枚举值字符串不变（如 'modal'、'dropdown'、'custom'、'drag'、'center'），它们可能在外部依赖中被硬编码使用；
  - 新增 props 时，优先向内聚组件（如 ToolPane / DebugDropdownButton）添加，并通过已有 context 或 props 传递，而不是在 DebugToolList 中堆叠过多逻辑。

## 8. 测试与质量保障

- 单测框架为 Vitest，基于 @coze-arch/vitest-config 的 web 预设：
  - 写 UI 测试时可使用 @testing-library/react / @testing-library/jest-dom；
  - 推荐针对 DebugToolList 与 ToolPane 的显隐逻辑、beforeVisible 调用时序、OperateTypeEnum 不同分支进行行为测试。
- lint 与 stylelint：
  - JS/TS 由 eslint.config.js 管控；
  - Less/CSS 由 .stylelintrc.js 及 @coze-arch/stylelint-config 控制；
  - AI 在批量修改时应保持原有规则不变，尽量让新增代码通过现有 lint 配置。
