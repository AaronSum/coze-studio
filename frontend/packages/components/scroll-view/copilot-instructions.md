# @coze-common/scroll-view 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/scroll-view）中安全、高效地协作开发。

## 1. 全局架构与角色定位
- 本子包是一个独立的 React 滚动容器组件库，入口为 [frontend/packages/components/scroll-view/src/index.tsx](frontend/packages/components/scroll-view/src/index.tsx)，对外导出 `ScrollView` 与 `ScrollViewController` 类型。
- 核心实现集中在 [frontend/packages/components/scroll-view/src/scroll-view](frontend/packages/components/scroll-view/src/scroll-view) 目录：
  - `index.tsx`：`ScrollView` 组件本体，负责渲染结构、注入滚动容器 ref、处理滚动事件与顶部/底部锚点逻辑。
  - `hooks.ts`：实现 `useScrollViewControllerAndState`（构造 `ScrollViewController`）与 `useAutoAnchorWhenAppendOnSafari`（Safari 反向滚动锚点兼容）。
  - `type.ts`：定义 `ScrollViewProps`、`ScrollViewController` 接口以及滚动状态枚举 `ScrollStatus`。
  - `context.tsx`：提供 `ScrollViewContentContext` 与 `useScrollViewContentRef`，暴露内部内容区域 DOM 引用。
  - `utils.ts`：实现浏览器能力探测（如 `supportNegativeScrollTop`）。
  - `consts.ts`：定义 `SCROLL_VIEW_ANCHOR_CONTAINER`，用于 Safari 自动锚点逻辑选取 DOM 容器。
- 样式通过 Less 模块 [frontend/packages/components/scroll-view/src/scroll-view/index.module.less](frontend/packages/components/scroll-view/src/scroll-view/index.module.less) 管理，类名统一通过 `styles.xxx` 与 `classnames` 组合使用。
- 组件本身不直接持有业务状态，仅通过 `ScrollViewController` 的方法（`scrollTo`、`scrollToPercentage`、`getScrollTop` 等）和一组事件回调（`onReachTop`、`onReachBottom` 等）与上层业务交互，形成“受控滚动容器 + 回调式通知”的边界。
- 子包同时内置 Storybook 示例，位于 [frontend/packages/components/scroll-view/stories](frontend/packages/components/scroll-view/stories)，主要用于交互展示与手动验证，并不参与正式构建产物。

## 2. 关键数据流与行为
- 组件结构：
  - 最外层 wrapper：绑定 `wrapperRef`，用于暴露滚动视图外层容器引用（`getScrollViewWrapper`）。
  - `before` 区域：渲染在滚动内容前，可以是节点或 `(controller) => JSX` 形式，与 `beforeClassName` 组合使用。
  - `content` 容器：通过 `ScrollViewContentContext` 暴露为内容区域根节点。
  - `scrollable` 容器：真正可滚动区域，绑定 `ref`（`containerRef`）与 `onScroll` 事件，承载 `children` 和 `innerBefore`。
- 滚动控制流：
  - `useScrollViewControllerAndState` 封装浏览器差异，统一对外暴露 `ScrollViewController`：
    - `scrollTo(update)`：以当前 scrollTop 为基准做增量更新，并在 `reverse` + 不支持负 scrollTop 的场景做兼容换算。
    - `scrollToPercentage(ratio)` / `getScrollPercentage()`：通过容器高度和内容高度换算滚动百分比，`reverse` 模式下会做反向比例转换。
    - `getScrollTop` / `getScrollBottom`：在正向/反向模式下都返回“距离顶部/底部的正数距离”。
    - `refreshAnchor()`：根据 `scrollStatusRef` 为 `Top` 或 `Bottom` 时自动吸顶/吸底，用于数据更新后重新对齐。
    - `disableScroll()` / `enableScroll()`：通过添加/移除样式类及一次微调滚动位置，临时禁止或恢复滚动。
    - `checkContentIsFull()`：判断内容高度是否恰好填满容器，用于避免初始态下滚动事件不触发的边界情况。
  - `ScrollView` 内部在 `onScroll` 回调中：
    - 通过 `getScrollTop` 和 `getScrollBottom` 与阈值比较，计算是否触发 `onReachTop`/`onLeaveTop` 与 `onReachBottom`/`onLeaveBottom`，并利用 `isReachTopRef`、`isReachBottomRef` 去抖避免重复触发。
    - 通过 `scrollStatusRef` + `DEBOUNCE_TIME`（100ms）记忆最近滚动状态（`Top`/`Bottom`/`Inner`），为 `refreshAnchor` 等后续行为提供依据。
  - Safari 兼容流：
    - `useAutoAnchorWhenAppendOnSafari` 在 `reverse === true` 且 `isAppleWebkit()` 时启用，通过 `requestAnimationFrame` 周期比较 `.scroll-view-anchor-container` 内最后一个子节点和容器高度变化，在内容尾部插入发生且滚动距离大于 `enableThreshold` 时自动调用 `scrollTo` 抵消新增高度，实现“追加消息但保持视图锚点不动”。

## 3. 开发与构建工作流
- 本子包被 Rush 管理，位于 `@coze-common/scroll-view` workspace。
- package.json 中定义的脚本：
  - `npm run build`：当前实现为 `exit 0`，即占位脚本，真实构建通常由上层前端工程统一驱动；在本包内不应依赖该命令生成产物。
  - `npm run lint`：调用根工作区共享 eslint 配置（`@coze-arch/eslint-config`），对整个包执行 lint，使用缓存以加速迭代。
  - `npm run test`：使用 Vitest（经 `@coze-arch/vitest-config` 封装）执行单元测试，允许无测试文件时通过（`--passWithNoTests`）。
  - `npm run test:cov`：在 `test` 基础上增加覆盖率收集（`@vitest/coverage-v8`）。
- Vitest 配置在 [frontend/packages/components/scroll-view/vitest.config.ts](frontend/packages/components/scroll-view/vitest.config.ts) 中通过 `defineConfig({ dirname: __dirname, preset: 'web' })` 引用统一预设，AI 在新增测试时应沿用该预设，不要自行覆盖。
- Storybook：
  - 示例故事位于 [frontend/packages/components/scroll-view/stories/demo.stories.tsx](frontend/packages/components/scroll-view/stories/demo.stories.tsx)，通过从 `../src` 导入组件；如新增展示用例，请保持使用统一故事结构（`default export` + 命名 stories）。
- 若需要在整个前端工程中运行开发/构建，可使用根目录下脚本（例如 [scripts/build_fe.sh](scripts/build_fe.sh) 或 Rush 相关命令），但本说明聚焦于子包内的增量开发。

## 4. 项目约定与代码风格
- TypeScript 与 React：
  - 所有导出类型集中在 `type.ts` 或 `src/index.tsx` 统一出口，避免在业务文件中散乱导出类型。
  - 组件使用 `forwardRef` 暴露 `ScrollViewController`，ref 类型与 props 类型均在 `type.ts` 中定义，新增能力时应同步更新类型定义并从 `src/index.tsx` 继续 re-export。
- 命名与状态：
  - 滚动状态统一使用 `ScrollStatus` 枚举，禁止写死字符串状态值。
  - DOM ref 使用 `xxxRef` 命名，状态缓存（如“是否已触发到顶/到底”）使用 `xxxRef.current` 布尔值形式，避免 useState 触发多余渲染。
  - 常量（如容器 className）集中在 `consts.ts` 中声明并在逻辑中引用，便于后续统一调整。
- 样式与 className：
  - 所有样式来自 Less 模块，使用 `styles.xxx` + `classnames` 组合，布尔条件统一写在对象形式（`{ [styles.reverse]: reverse }`）。
  - 控制滚动行为的样式（如 `disable-scroll`）必须在 Less 中定义并仅通过 controller API 切换，避免直接在业务组件中操作样式类。
- 工具函数与平台特性：
  - 浏览器特性探测（如 `supportNegativeScrollTop`、`isAppleWebkit`）集中在 `utils` 和上层 util 文件中，新增兼容逻辑时应优先扩展这些工具，而非在组件内部分散写判断。
  - 涉及 `navigator`、`document` 等全局对象的逻辑，应封装在 hook 或工具函数内，避免在模块顶层直接访问（以利于 SSR/测试环境）。
- ESLint/Stylelint：
  - 使用 workspace 级别配置：`@coze-arch/eslint-config` 与 `@coze-arch/stylelint-config`，局部关闭规则时（如 `max-line-per-function`）倾向于在文件顶部统一关闭，而非在多处内联关闭。

## 5. 重要集成点与外部依赖
- React & DOM：
  - 使用 `useRef`、`useEffect`、`useLayoutEffect` 操作 DOM，所有滚动行为必须通过封装好的 controller API 间接完成，不直接访问 `scrollTop` 除非在 controller 内部实现。
  - `requestAnimationFrame` 用于对滚动/高度变化进行节流与动画结束同步（如 `scrollToPercentage` 和 Safari 自动锚点）。
- lodash-es：
  - 使用 `debounce` 处理滚动状态更新，默认延迟为 `DEBOUNCE_TIME = 100ms`，新增逻辑若需要依赖滚动状态，应考虑这一延迟带来的时序影响。
  - 使用 `isFunction` 与 `isNumber` 辨别 props 或运行时值的类型，避免直接通过 `typeof` 在组件中多处复制逻辑。
- classnames：
  - 用于组合 CSS Module 类与自定义 className，所有条件类名都应通过 `cs(...)` 构造，避免字符串拼接。

## 6. 测试与调试约定
- 当前 `__tests__` 目录仅包含 `.gitkeep`，意味着默认无单元测试；Vitest 配置允许这一状态，因此新增测试时无需改动配置。
- 建议在新增功能或修复复杂滚动逻辑时：
  - 为 `useScrollViewControllerAndState` 和 `ScrollView` 编写以行为为中心的单元测试（例如：在不同 `reverse`/浏览器能力配置下，检查 `getScrollTop`、`getScrollBottom`、`scrollToPercentage` 的结果）。
  - 利用 JSDOM 或测试工具模拟容器尺寸与滚动行为，而非依赖真实浏览器环境。
- 交互调试可以通过 Storybook 完成：复用/扩展现有 `demo.stories.tsx`，构造大数据量、消息列表追加、顶部/底部加载更多等场景观察实际滚动表现。

## 7. 过程与协作规范
- 版本管理与发布：
  - 包版本与依赖受 Rush + workspace 管理，一般通过根工程统一调整；AI 如需修改 `package.json` 依赖，应保持与其他组件包一致的版本策略（例如 React 18.2.x）。
- 分支与提交：
  - 本说明不直接约束全仓库分支策略，但在对子包进行修改时，应避免在文件头部移除现有版权与 License 声明，并保持导出 API 的向后兼容（不要随意重命名或删除对外导出的类型/组件）。
- 变更边界：
  - 若仅为滚动行为或样式做修改，应局限在本子包目录内：[frontend/packages/components/scroll-view](frontend/packages/components/scroll-view)，不要跨包修改公共配置（如根 eslint/vitest 配置），除非变更明确要求。
  - 组件对外暴露仅通过 `src/index.tsx`，新增导出时务必在此文件添加统一 re-export，避免从内部路径直接被业务引用。

## 8. 特殊/易踩坑说明
- 反向滚动与负 scrollTop：
  - 在 `reverse === true` 且浏览器不支持负 `scrollTop`（低版本 Chromium）时，通过 `supportNegativeScrollTop` + `_getContainerScrollTop`/`_setContainerScrollTop` 做偏移修正，因此外部不要再对 `scrollTop` 做额外转换，只使用 controller 提供的 API 即可。
- Safari 自动锚点：
  - `useAutoAnchorWhenAppendOnSafari` 依赖类名 `scroll-view-anchor-container`，请保证包裹消息列表的容器正确应用该 class，否则苹果浏览器下追加内容时可能出现“跳底部”的体验问题。
- 滚动状态去抖：
  - `scrollStatusRef` 的更新是去抖的，在快速滚动/频繁插入内容时，其值可能略晚于真实 DOM 状态，依赖该状态的逻辑（如外层根据 Top/Bottom 状态展示“回到底部按钮”）需要容忍一定延迟，不应用于精确到帧的动画控制。
- 触屏禁用滚动：
  - `useScrollViewControllerAndState` 在 `touchstart` 时标记 `isDisableScroll`，`touchend` 恢复，这一行为与某些外层手势系统可能存在交互；如需调整，请在本 hook 内统一修改，而不要在业务组件中重复注册 `touchstart/touchend` 监听。
