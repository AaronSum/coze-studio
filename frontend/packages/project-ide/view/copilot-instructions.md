# AI 协作开发指引（@coze-project-ide/view）

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/view）中安全、高效地协作开发。

## 全局架构概览

- 本包提供 IDE 视图层基础设施，核心职责是：基于 Lumino/Phosphor 风格的 `DockPanel/TabBar` 布局系统，配合 ReactWidget 与依赖注入（Inversify），为 Project IDE 提供「多面板布局 + Widget 管理 + 布局持久化 + 视图服务 API」。
- 对上游：通过 `createViewPlugin` 暴露为 `@coze-project-ide/core` 的插件，典型由 `@coze-project-ide/client` 调用；对下游：通过 `WidgetFactory`、`ViewContribution`、`ViewService` 等接口让具体业务模块注册视图与行为。
- 关键参与者：
	- `src/create-view-plugin.tsx`：本包入口，定义插件生命周期（onBind/onInit/onLayoutInit/onDispose），向 IoC 容器注册所有服务与 UI 组件。
	- `src/view-manager.tsx`：视图编排中心，处理插件入参、合并 `ViewContribution`、初始化 `ApplicationShell/LayoutRestorer/WidgetManager` 等。
	- `src/shell/application-shell.ts`：IDE Shell 容器，基于 Lumino `Widget/Panel/BoxLayout/SplitLayout/DockPanel` 构建多区域布局（主区/底栏/侧栏/活动栏/状态栏等），并跟踪当前激活 Widget 与布局数据。
	- `src/shell/layout-restorer.ts`：布局与 Widget 内部状态的持久化/恢复器，依赖 `StorageService/WindowService/WidgetManager/ViewRenderer`，负责在 unload 时持久化、启动时还原。
	- `src/widget-manager.ts`：Widget 生命周期与实例缓存管理，按 URI 与 `WidgetFactory` 创建/复用 Widget，并与 IoC 容器集成以支持子容器级别的依赖注入。
	- `src/view-renderer.tsx` 与 `src/widget/react-widget.tsx`（未在此文展开）负责将 Lumino Widget 与 React 组件通过 Portal 方式桥接。
- 数据流大致路径：
	- 业务模块通过 `ViewContribution`/`WidgetFactory` 注册 Widget 与默认布局信息 → `ViewManager.mergeOptions` 合并到 `ViewPluginOptions` → `ApplicationShell` 创建各 Panel 与 DockPanel → `LayoutRestorer` 从存储中恢复布局，并通过 `WidgetManager` 重建各 Widget → 用户操作触发 `ViewService/HoverService/DragService/DebugService` 等对布局和 Widget 状态进行操作。

## 依赖和技术栈

- 依赖注入：
	- 使用 `inversify` 提供 IoC 容器；本包内所有服务类默认通过 `@injectable()` + `@inject` 声明依赖。
	- 多实现扩展点统一使用 `@flowgram-adapter/common` 的 `ContributionProvider` 与 `bindContributionProvider/bindContributions`（如 `WidgetFactory`、`ViewContribution`、`CustomPreferenceContribution`）。
- 核心框架：
	- `@coze-project-ide/core`：提供 `definePluginCreator/Command/IDERendererProvider/EventService/OpenerService/ContainerFactory/NavigationHistory` 等基础能力，是本包真正挂载到 IDE 的入口依赖。
	- Lumino 子实现位于 `src/lumino/**`，是 Jupyter/Phosphor 风格 Widget 系统的 fork，`src/lumino/widgets/index.ts` 聚合导出所有布局组件。
- UI & 样式：
	- 使用 `React` 作为渲染层（通过 `ReactWidget` 与 Portal 集成），并引入 `@vscode/codicons` 与本包内的 `index.css` 实现图标与基础样式；
	- `PerfectScrollbar` 在 `src/index.ts` 暴露，用于自定义滚动条。
- 其他：`lodash/mergeWith` 用于合并 View 配置；`fast-json-stable-stringify`/`nanoid` 等在某些子模块中使用（未在此文一一展开）。

## 关键模块与职责

### create-view-plugin（插件入口）

- 文件：`src/create-view-plugin.tsx`
- 通过 `definePluginCreator<ViewPluginOptions>` 定义插件，暴露 `createViewPlugin` 给上层：
	- `onBind`：
		- 注册核心服务：`ViewManager/WidgetManager/ViewRenderer/ApplicationShell/LayoutRestorer/ViewService/HoverService/DragService/DebugService` 等为单例。
		- 注册扩展点：
			- `bindContributionProvider(bind, WidgetFactory)` → 允许其他包注入多种 WidgetFactory；
			- `bindContributionProvider(bind, ViewContribution)` → 允许注入视图贡献（默认 Widget/ActivityBar/StatusBar 等配置）；
			- `bindContributionProvider(bind, CustomPreferenceContribution)` → 注入自定义布局偏好配置项；
			- `bindContributions(bind, WidgetOpenHandler, [OpenHandler])` → 将 `WidgetOpenHandler` 作为 `OpenHandler` 实现注入。
		- 注册布局渲染相关：`DockPanelRendererFactory/TabBarFactory/TabBarToolbarFactory/CustomRenderWidgetFactory/FlowDockPanel.Factory`，为多 TabBar、多 DockPanel 的动态创建提供工厂方法。
		- 注入 IDE 渲染入口：将 `IDERendererProvider` 绑定为 `ViewRenderer.toReactComponent(ApplicationShell)` 的结果。
		- 绑定视图通用贡献：`ViewCommonContribution` 同时作为 `CommandContribution/StylingContribution/ShortcutsContribution`。
		- 调用 `bindActivityBarView` 注册 Activity Bar 相关视图。
	- `onInit`：调用 `ViewManager.init`，完成 Widget 工厂注册、Shell 初始化、DebugBar 初始化。
	- `onLayoutInit`：
		- 初始化 context menu：基于 `MenuService` 给 `.lm-TabBar-tab` 注入关闭/全屏等命令项；
		- 调用 `ViewManager.attach` 完成 ActivityBar/StatusBar 的挂载与 Portal 注入；
		- 通过 `EventService` 劫持全局 `contextmenu` 事件，在非可编辑 DOM 上调用 `menuService.open` 并屏蔽默认行为。
	- `onDispose`：委托给 `LayoutRestorer.storeLayout` 持久化当前布局。

### ViewManager（视图编排）

- 文件：`src/view-manager.tsx`
- 主要 API：
	- `init(viewOptions: ViewPluginOptions)`：
		- `mergeOptions`：遍历 `ViewContribution` 列表，通过其 `registerView` 回调向传入的 `viewOptions` 追加 `widgetFactories/activityBarItems/statusBarItems/defaultWidgets` 等；
		- 调用 `WidgetManager.init(widgetFactories)` 注册所有 WidgetFactory；
		- 调用 `LayoutRestorer.init(viewOptions)` 初始化布局持久化（包括 storageKey、自定义偏好项等）；
		- 调用 `ApplicationShell.init` 创建主区/底栏/侧栏/ActivityBar/StatusBar 等布局结构；
		- 若 `defaultLayoutData.debugBar` 存在，则调用 `DebugBarWidget.initContent` 初始化调试栏内容。
	- `attach(viewOptions: ViewPluginOptions)`：
		- `LayoutRestorer.restoreLayout()` 从存储恢复布局与内部状态；
		- 启动默认 Widgets：遍历 `defaultLayoutData.defaultWidgets`，通过 `OpenerService.open(uri)` 打开；
		- 将 `ApplicationShell.activityBarWidget/statusBarWidget` 挂到布局上：通过 `ViewRenderer.addReactPortal` 与 `shell.addWidget` 将其注入对应 Panel，并初始化数据。

### ApplicationShell（布局容器）

- 文件：`src/shell/application-shell.ts`
- 继承自 Lumino `Widget`，内部维护：
	- `FlowDockPanel`：`mainPanel` 和 `bottomPanel`，分别承载主文档区与底部输出区；
	- `Panel`：`topPanel/statusBar/activityBar/rightToolbar/primarySidebar/secondarySidebar` 等；
	- `SplitLayout/BoxLayout`：
		- `bottomSplitLayout`：主区与底栏的上下分屏布局；
		- `leftRightSplitLayout`：左侧栏/中间内容/右侧栏的左右分屏布局；
		- 外层 `BoxLayout` 将 `topPanel`、中间区域与 `statusBar` 竖直排列。
- 关键方法：
	- `init({ createLayout, splitScreenConfig, disableFullScreen })`：初始化全部 Panel、侧边栏、DockPanel，并通过 `WidgetManager` 创建 ActivityBar/StatusBar Widget 实例；支持可选自定义布局构建函数。
	- `addWidget(widget, { area, addOptions, mode })`：按 `LayoutPanelType` 将 Widget 添加到对应 Panel/DockPanel 中，并调用 `track` 跟踪其激活/销毁。
	- `track(widget)`：对 `ReactWidget` 挂接 `onActivate/onDispose` 回调，维护当前激活 Widget、关闭栈（用于最近关闭恢复）以及底栏显隐逻辑。
	- `getLayoutData()/setLayoutData()`：读写布局结构（包括 DockPanel 布局、Panel 中 Widget 列表以及 SplitLayout 相对尺寸），由 `LayoutRestorer` 调用进行持久化。

### LayoutRestorer（布局持久化）

- 文件：`src/shell/layout-restorer.ts`
- 与 `ApplicationShell` 紧耦合，用于存储/恢复布局和 Widget 的内部状态：
	- 初始化阶段：
		- `init(options: ViewPluginOptions)`：
			- 调用 `WindowService.onStart` 做窗口级初始化；
			- 通过 `options.getStorageKey?.()` 决定存储 key（支持多工作区隔离）；
			- 根据 `options.restoreDisabled` / `layout/disabled/v2` 决定是否启用持久化；
			- 注册 `windowService.onUnload` 钩子，在退出时调用 `storeLayout()`；
			- 合并传入的 `customPreferenceConfigs` 与 `CustomPreferenceContribution` 扩展，并从 `StorageService` 读取其当前值。
	- 序列化：
		- `deflate(data)`：对 `ApplicationShell.getLayoutData()` 的结果进行 JSON 序列化，特殊处理 `widget/widgets` 字段，将 `ReactWidget` 转为 `{ uriStr, innerWidgetState }` 描述；
		- `convertToDescription(widget)`：利用 `ReactWidget.uri` 获取可持久化标识，若 Widget 实现 `StatefulWidget` 接口，则同时序列化内部状态。
	- 反序列化：
		- `inflate(layoutData)`：使用 `ShellLayoutRestorer.ParseContext` 延迟解析，在 JSON parse 时将 widgets 描述转换为异步 `Widget` 实例创建任务；
		- `convertToWidget(desc)`：根据 `uriStr` 调用 `WidgetManager.getOrCreateWidgetFromURI` 创建 Widget，挂到 `ViewRenderer` Portal 中并交给 `ApplicationShell.track`；若 Widget 为 `StatefulWidget`，则调用 `restoreState` 回填内部状态。
	- 对外 API：
		- `storeLayout()`：序列化 `ApplicationShell` 布局 + `innerState` 并写入 `StorageService`；
		- `restoreLayout()`：读取存储内容，反序列化后调用 `ApplicationShell.setLayoutData` 与内部状态恢复；
		- `storeWidget/restoreWidget(widget)`：按 URI 级别保存与恢复单个 ReactWidget 内部状态。

### WidgetManager（Widget 管理）

- 文件：`src/widget-manager.ts`
- 职责：根据 URI 与 WidgetFactory 管理 Widget 的创建、缓存和生命周期：
	- `init(widgetFactories?)`：合并传入的 factories 与 `ContributionProvider<WidgetFactory>` 中注入的扩展；
	- `getFactoryFromURI(uri)`：按 `factory.match` 正则或 `factory.canHandle(uri)` 规则选择最合适的工厂；
	- `getOrCreateWidgetFromURI(uri, factory?)`：
		- 优先复用已有或正在创建中的 Widget（通过 `pendingWidgetPromises`），避免并发创建；
		- 若 factory 提供 `createWidget`，直接调用；否则根据 `factory.widget` 或 `factory.render` 决定创建方式：
			- `factory.widget`：在子容器中绑定该 class 并实例化；
			- `factory.render`：通过 `CustomRenderWidgetFactory` 创建包装 Widget，并挂上 `factory.render`；
		- 统一调用 `widget.init(uri, childContainer)` 与 `setWidget` 注册，并在 dispose 时自动从 map 中移除。
	- `createSubWidget(uri, widgetClass)`：直接为给定 class 创建子 Widget，常用于当前 Widget 下的子视图。

### ViewService（视图操作服务）

- 文件：`src/services/view-service.ts`
- 为上层（如命令/快捷键）提供常用视图操作：
	- 面板显隐与分屏：`toggleBottomLayout()/hideBottomLayout()` 通过调整 `bottomSplitLayout.setRelativeSizes` 控制主区/底栏比例；
	- Tab 管理：
		- `getOpenTitles()`：从 `DockLayout.tabBars()` 收集所有 Tab 标题；
		- `getAllTabsFromArea(area)`：获取某个 Panel 中所有 DockPanel；
		- `closeOtherTabs(dispose?)`：在当前 TabBar 中关闭除当前 Tab 外的所有 Tab，可选择是否 dispose 对应 Widget；
		- `openNextTab()/openLastTab()`：基于当前激活 Widget 在 TabBar 中的位置计算下一/上一 Tab 对应的 URI，并通过 `WidgetOpenHandler.open` 打开。
	- 全屏模式：`enableFullScreenMode()/disableFullScreenMode()/switchFullScreenMode()` 通过遍历 `ALL_PANEL_TYPES` 调整各 Panel hidden 状态，并发出 `onFullScreenModeChange` 事件；
	- ActivityBar 当前项：`setActivityBarUri(uri)` 与 `activityBarUri` getter。

### Hooks 与 Lumino 封装

- Hooks：`src/hooks/index.ts` 暴露：
	- `useCurrentWidget/useCurrentWidgetFromArea/useCurrentResource/CurrentResourceContext`，通常配合 `ViewService/ApplicationShell` 提供的 currentWidget 状态使用，用于 React 组件中获取当前资源与 Widget。
- Lumino 导出：`src/lumino/widgets/index.ts` 暴露 `Widget/BoxLayout/SplitLayout/SplitPanel/BoxPanel/DockLayout/TabBar` 等构建块，外部可以直接使用这些组件构造自定义布局，但应优先通过 `ApplicationShell`、`FlowDockPanel` 与现有布局工具方法（如 `createBoxLayout/createSplitLayout`）。

## 开发与构建流程

- 包管理与构建：
	- 本包遵循 monorepo Rush 管理，依赖通过根目录的 `rush update` 安装；
	- `package.json` 中：
		- `build`: 当前为 `exit 0`，实际构建使用 `build:fast`；
		- `build:fast`: 使用 `tsup` 以 CJS+ESM 产出，tsconfig 为 `tsconfig.build.json`；
		- `watch`: `build:fast --watch --dts-resolve`；
		- `ts-check`: 运行 `tsc --noEmit`；
		- `lint`: `eslint ./ --cache --quiet`；
		- `test/test:cov`: 目前占位为 `exit`，真实测试一般在上层应用或 monorepo 统一测试中完成。
- 常见工作流（建议 AI 代理遵守）：
	- 修改/新增 TS 源码后：优先运行本包 `npm run lint` 与 `npm run ts-check`，必要时运行上层 `rushx` 脚本进行 e2e 验证；
	- 构建产物通常由 CI 或 monorepo 顶层任务统一生成，本包本地使用 `npm run build:fast` 即可。

## 项目约定与模式

- DI 与扩展点约定：
	- 默认所有可复用服务/管理器类使用 `@injectable()` + 构造/字段注入；
	- 多实现扩展点统一通过 `ContributionProvider` 暴露，并在 `create-view-plugin` 中通过 `bindContributionProvider` 注册；
	- 新增扩展点时，优先复用 `@flowgram-adapter/common` 的 Contribution 机制，而非自行维护数组。
- URI 作为 Widget 唯一标识：
	- 所有可持久化 Widget 应保证 `ReactWidget.uri` 存在且可序列化；
	- 若需要自定义 ID 规则，使用 `WidgetFactory.getId(uri)` 返回稳定字符串；
	- 布局持久化仅依赖 URI，不存储复杂运行时对象。
- 状态持久化约定：
	- 需要在会话间保存内部状态的 Widget 应实现 `StatefulWidget` 接口（`storeState/restoreState`），并依赖 `LayoutRestorer.storeWidget/restoreWidget` 机制；
	- 不需要持久化的临时 Widget 不必实现该接口。
- 布局配置约定：
	- 默认布局与 Widget 列表应通过 `ViewContribution.registerView({ register })` 注入，而不是在 `ViewManager` 中硬编码；
	- ActivityBar/StatusBar 项目通过 `defaultLayoutData.activityBarItems/statusBarItems` 统一配置；
	- `presetConfig` 中的 `splitScreenConfig/disableFullScreen/disableContextMenu` 等，用于对整个 IDE Shell 行为做开关控制。

## 与外部系统的集成

- 与 `@coze-project-ide/core`：
	- 插件生命周期：本包通过 `definePluginCreator` 将自身作为可插拔模块注册给 IDE；
	- 命令系统：使用 `Command.Default.*` 常量（例如视图关闭/全屏）给 ContextMenu/快捷键绑定具体行为；
	- 事件系统：依赖 `EventService.listenGlobalEvent` 劫持 DOM 事件；
	- 资源/路由：`URI/OpenerService/NavigationHistory` 用于资源定位与历史导航。
- 与其他 Project-IDE 子包：
	- `@coze-project-ide/client` 等上层包通过 `createViewPlugin` 与 `ViewPluginOptions` 传入具体的 WidgetFactories/默认布局；
	- `@flowgram-adapter/common` 提供了通用 DI/Contribution/Event/Disposable 等基础实现，是本包多数基础工具类的来源。

## 协作与修改建议（针对 AI 助手）

- 修改/新增功能时优先考虑：
	- 是否应通过 `ViewContribution/WidgetFactory/CustomPreferenceContribution` 注入，而非直接在核心类中硬编码；
	- 是否需要在 `LayoutRestorer` 中新增持久化字段；如是，必须同时更新 `deflate/parse/convertToWidget/getLayoutData/setLayoutData` 的串联逻辑，保持序列化格式兼容；
	- 是否破坏现有 Panel/布局结构：新增 Panel 类型时必须更新 `LayoutPanelType`、`PANEL_CLASS_NAME_MAP`、`ALL_PANEL_TYPES` 以及 `ApplicationShell.getPanelFromArea/createPanel/getLayoutData/setLayoutData`。
- 安全边界：
	- 不要在本包内直接访问浏览器全局状态（除 `WindowService` 已封装场景外）；
	- 不要在 WidgetManager 之外手动管理 Widget map 或自行缓存 Widget 实例；
	- 避免修改 `lumino/**` 内部实现，除非确认为 bug 修复且已评估对全部使用方的影响。

## 项目流程与规范补充

- 代码风格：遵循 monorepo 公共 ESLint/TSConfig（`@coze-arch/eslint-config`、`@coze-arch/ts-config`），尽量保持类/方法命名与现有模式一致（*Manager、*Service、*Widget、*Contribution 等后缀）。
- Git/分支流程：由 monorepo 统一管理，本子包内不存放单独 Git 配置；AI 助手只需确保改动局部且遵循现有模式，避免大规模重构跨包接口。

以上信息应足以支撑 AI 编程助手在本子包中进行多数日常开发任务（新增视图、扩展布局、集成服务等），在动核心类（ApplicationShell/LayoutRestorer/WidgetManager）前建议先通读相关文件并确认调用链。

