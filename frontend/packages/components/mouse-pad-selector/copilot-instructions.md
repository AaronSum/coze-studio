# mouse-pad-selector 子包开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/mouse-pad-selector）中安全、高效地协作开发。

## 一、子包定位与整体架构

- 子包名称：@coze-common/mouse-pad-selector，对外暴露为一个 React 组件库子模块。
- 主要导出见 src/index.tsx：
  - MousePadSelector、MousePadSelectorProps、InteractiveType：画布交互模式切换控件（鼠标 / 触摸板）。
  - GuidingPopover、GuidingPopoverProps：首次或引导性弹层，用于解释两种交互模式差异。
  - getPreferInteractiveType、setPreferInteractiveType：用户偏好交互模式的本地缓存工具。
- 外部依赖：
  - React 18 + TypeScript。
  - @coze-arch/bot-semi：UI 组件库（Button、Popover、Typography 等）。
  - @coze-arch/i18n：国际化文案获取（I18n.t）。
  - classnames、lodash-es 等通用工具库。
- 结构概览：
  - src/
    - index.tsx：对外导出入口。
    - mouse-pad-selector.tsx：核心选择器组件（交互模式切换）。
    - with-guiding-popover.tsx：引导 Popover 组件包装。
    - constants.ts：本地缓存 key、平台探测常量。
    - utils.ts：偏好读写、是否展示引导等逻辑。
    - icons/：MouseIcon、PadIcon 等图标组件。
    - *.module.less：样式模块，配合 CSS Modules 使用。
  - stories/：Storybook 示例用法。
  - __tests__/：Vitest 单测（目前可能为空，仅占位）。

> 该子包专注 UI 交互与本地偏好存储，不直接依赖后端接口或全局状态管理。

## 二、数据流与关键逻辑

### 1. 模式切换（MousePadSelector）

- 组件是一个受控组件：
  - props.value: 当前交互模式（InteractiveType.Mouse / InteractiveType.Pad）。
  - props.onChange: 模式切换回调，父组件负责更新 value，并可调用 setPreferInteractiveType 进行持久化。
- 内部通常提供 ref（forwardRef），用于上层获取内部 DOM（详见 stories/demo.stories.tsx 中 innerDomRef 示例）。
- UI 上会展示两种模式的图标和文案，图标使用 src/icons/mouse.tsx 和 src/icons/pad.tsx。

### 2. 引导弹层（GuidingPopover）

- 定义于 src/with-guiding-popover.tsx：
  - GuidingPopover 是一个包裹 children 的展示组件，内部通过 <Popover> 控制可见性。
  - GuidingPopoverProps 控制文案：buttonText、mainTitle、mouseOptionTitle/Desc、padOptionTitle/Desc。
- 默认文案来源：@coze-arch/i18n 的 I18n.t，例如 workflow_interactive_mode_popover_title 等 key。
- 初始可见性：
  - const [visible, setVisible] = useState(() => needShowGuidingPopover())。
  - needShowGuidingPopover 依据 localStorage 中 SHOW_KEY 判断是否已展示过。
- 关闭行为：
  - 点击「知道了」按钮调用 handleGotIt → hideGuidingPopover() → setVisible(false)。
  - 点击弹层外部 onClickOutSide 同样会 setVisible(false) 但不会调用 hideGuidingPopover（即不会写入「已读」标记）。

### 3. 本地偏好与常量

- src/constants.ts：
  - CACHE_KEY = 'workflow_prefer_interactive_type'：存储用户偏好的交互模式。
  - SHOW_KEY = 'show_workflow_interactive_type_guide'：是否需要展示引导弹层。
  - IS_MAC_OS：通过 navigator.userAgent 简单判断是否是 Mac/iPad 用于差异体验（例如默认选择触摸板模式）。
- src/utils.ts（从 index.tsx 的导出推断）：
  - getPreferInteractiveType(): 从 localStorage 读取并返回 InteractiveType，若不存在则按平台或默认值推断。
  - setPreferInteractiveType(type): 写入 localStorage 中的 CACHE_KEY。
  - needShowGuidingPopover(): 依据 SHOW_KEY 与其他条件，决定首次是否展示引导弹层。
  - hideGuidingPopover(): 写入 SHOW_KEY 标记已展示过。

## 三、构建、开发与测试流程

### 1. 本子包常用命令

- 安装依赖：
  - 在仓库根目录执行：rush install 或 rush update。
- 子包内脚本（package.json）：
  - dev：storybook dev -p 6006（启动本组件 Storybook 开发环境）。
  - lint：eslint ./ --cache（使用仓库统一 eslint-config）。
  - test：vitest --run --passWithNoTests。
  - test:cov：npm run test -- --coverage。
  - build：当前实现为 exit 0；真正的构建通常由上层 Rsbuild / Rush 流水线统一处理，不在子包单独产物。

### 2. Storybook 工作流

- 配置入口位于 .storybook/main.js、.storybook/preview.js。
- 典型 story 用法见 stories/demo.stories.tsx：
  - 使用 GuidingPopover 包裹 MousePadSelector。
  - 通过 useState 控制 value，实现实时切换与日志输出。
- 在本子包目录执行：
  - npm run dev → 在浏览器访问 http://localhost:6006，调试组件行为与样式。

### 3. 单测与工具链

- 测试框架：Vitest（配置文件 vitest.config.ts，引用仓库统一 @coze-arch/vitest-config）。
- 测试位置：__tests__/ 目录或与源码同级的 *.test.ts(x)。
- 推荐：新逻辑（特别是 utils 中关于 localStorage 与平台判断的逻辑）新增 Vitest 单测，并避免在测试环境直接依赖真实 navigator / localStorage（使用 jsdom 或模拟）。

## 四、项目约定与风格

### 1. 代码风格与 Lint

- ESLint 配置继承自 @coze-arch/eslint-config，统一规则：
  - 使用函数式 React 组件 + Hooks。
  - 类型定义优先使用 TypeScript 类型别名 / interface。
  - 禁止未使用变量、未处理的 Promise 等常见问题。
- Stylelint 配置来自 .stylelintrc.js 与 @coze-arch/stylelint-config：
  - `.module.less` 采用 CSS Modules 命名，使用连字符风格类名（如 guiding-content-button）。

### 2. 组件模式与 API 设计

- 组件以「受控组件」为主：value + onChange，而不是内部自行管理状态并向外暴露 getter。
- 对外暴露类型定义（MousePadSelectorProps、GuidingPopoverProps）以方便调用方在 TS 下获得智能提示。
- 所有对外导出通过 src/index.tsx 统一集中，新增组件或工具函数时请更新此文件。
- 引导类功能（如 GuidingPopover）
  - 默认直接挂在组件外层作为包装器，而不是隐藏在 MousePadSelector 内部，以保持职责单一和组合灵活。

### 3. 国际化与文案

- 所有默认文案通过 I18n.t 调用：
  - 例如 workflow_interactive_mode_popover_title、guidance_got_it 等 key。
- 若在组件中新增硬编码文案：
  - 优先新增 i18n key 到 @coze-arch/i18n 对应资源，再在组件中引用。
  - 对外暴露的 props 应允许调用方覆盖默认文案。

### 4. 浏览器特性与环境依赖

- 直接使用 navigator.userAgent、localStorage 等浏览器全局对象：
  - 需要在 SSR 或 Node 环境中使用时，调用处必须确保只在浏览器侧执行（例如放在 useEffect 中，或在调用前检查 typeof window !== 'undefined'）。
  - 本子包本身默认运行环境为浏览器端 React，SSR 支持由上层应用控制。

## 五、与仓库其他部分的集成

- 依赖包：
  - @coze-arch/bot-semi：统一 UI 库，确保交互与样式与整个 Studio 一致。
  - @coze-arch/i18n：共享 i18n 配置，保证各应用之间文案 key 统一。
- 在 apps/coze-studio 中使用时：
  - 通常通过 workspace 依赖直接引用：import { MousePadSelector, GuidingPopover } from '@coze-common/mouse-pad-selector';
  - 建议在上层应用中：
    - 将用户选择写入全局状态或服务端，必要时调用 setPreferInteractiveType 做本地兜底。
    - 按需控制 GuidingPopover 的包裹位置（例如放在工具栏按钮外或设置面板中）。

## 六、协作与提交规范

- 分支与集成：
  - 遵循仓库整体策略（参考根目录 README / 贡献文档），通常通过 feature 分支开发，合并到主干分支后由统一流水线构建。
- 修改流程建议：
  1. 在根目录执行 rush update 安装 / 更新依赖。
  2. 在子包目录开发组件逻辑与样式，使用 npm run dev 通过 Storybook 实时验证。
  3. 为新增行为在 __tests__ 或相关 utils 上补充 Vitest 单测。
  4. 执行 npm run lint、npm run test，保证无 lint 与单测错误。
- 对 AI 助手的额外要求：
  - 修改时优先保持 API 向后兼容，除非需求明确要做破坏性变更。
  - 不要在没有上层确认的情况下更改 CACHE_KEY / SHOW_KEY 等常量字符串，以避免破坏已有用户数据。
  - 涉及浏览器全局对象（navigator、window、localStorage）时，避免在模块顶层做会在非浏览器环境报错的调用（如需要，请封装到函数或 Hook 内部）。

## 七、典型用法示例（供理解，不必重复实现）

- stories/demo.stories.tsx 中的典型组合：
  - 使用 GuidingPopover 包裹 MousePadSelector：
    - <GuidingPopover>
        <MousePadSelector value={value} onChange={setValue} ref={innerDomRef} />
      </GuidingPopover>
  - 这体现了本子包的推荐使用方式：
    - GuidingPopover 提供一次性引导说明；
    - MousePadSelector 专注于模式切换 UI 与 value 管理；
    - 偏好读取 / 写入通过 utils 提供的工具函数在上层完成。
