# @coze-project-ide/main Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/main）中安全、高效地协作开发。

## 一、子包定位与全局架构
- 位置：frontend/packages/project-ide/main，提供「Project IDE 页面」的具体实现，被主应用 [frontend/apps/coze-studio](frontend/apps/coze-studio) 通过异步路由按需加载（见 [frontend/apps/coze-studio/src/routes/async-components.tsx](frontend/apps/coze-studio/src/routes/async-components.tsx) 中 `ProjectIDE` 导入）。
- 职责：组合 Project IDE 领域内的各类业务包（workflow、data、plugin 等），拼装为一个可运行的 IDE 页面；不直接管理底层 API 调用，而是依赖 framework/biz-* 包暴露的能力。
- 技术栈：React 18 + TypeScript + React Router v6 + Inversify（通过 `@coze-project-ide/framework`）+ Zustand 等，构建由上层 Rsbuild/Rush 统一负责。
- 依赖关系（核心）：
  - `@coze-project-ide/framework`：提供 `ProjectIDEClient`、`IDEGlobalProvider`、插件体系与依赖注入能力，是 Project IDE 的运行框架。
  - `@coze-project-ide/ui-adapter`：提供 SecondarySidebar 等通用 IDE UI 组件，本包负责将其插入到具体布局中。
  - `@coze-project-ide/biz-workflow`、`@coze-project-ide/biz-plugin-registry-adapter`、`@coze-project-ide/biz-data`、`@coze-project-ide/biz-components`：分别提供工作流、插件、数据资源与资源树插件等业务模块，通过 “widget registry / plugin” 接入框架。
  - `@coze-common/auth`、`@coze-common/auth-adapter`：用于鉴权和初始化项目角色，控制是否允许进入 IDE 页面。
- 架构思路：本包本身保持「壳 + 装配」角色：
  - 壳：通过 `IDELayout` 提供路由容器，通过 `ProjectIDE` 组件拼装视图与插件；
  - 装配：通过 `options.view` 配置各区域视图实现，通过 `plugins` 数组挂载业务插件（`createAppPlugin`、`createResourceFolderPlugin`）。

## 二、源码结构总览
- [src/index.tsx](frontend/packages/project-ide/main/src/index.tsx)
  - 暴露 `ProjectIDE`、`IDELayout` 两个主要导出：
    - `ProjectIDE`：真正的 IDE React 组件，接受 `spaceId`、`projectId`、`version` 作为入参；
    - `IDELayout`：路由层页面组件（默认导出），负责从 URL 中解析 spaceId/projectId/commit_version 并渲染 `ProjectIDE`。
  - 内部调用：
    - 使用 `useProjectAuth(EProjectPermission.View, projectId, spaceId)` 控制访问权限，未授权直接 throw Error 交给外层 ErrorBoundary 处理；
    - 使用 `IDEGlobalProvider` 提供全局上下文（spaceId、projectId、version）；
    - 使用 `ProjectIDEClient`，通过 `presetOptions.view` 与 `plugins` 定义 IDE 的视图与业务插件。
- [src/layout.tsx](frontend/packages/project-ide/main/src/layout.tsx)
  - `Page` 组件作为路由入口：
    - 通过 `useParams` 获取 `space_id`、`project_id`；
    - 从 `window.location.search` 解析 `commit_version`；
    - 将三者传递给 `ProjectIDEContainer`。
  - `ProjectIDEContainer`：
    - 调用 `useDestoryProject(projectId)` 注册销毁逻辑；
    - 调用 `useInitProjectRole(spaceId, projectId)` 初始化角色数据；
    - 仅在角色初始化完成时渲染 `ProjectIDE`，否则返回 null（避免闪烁/权限错误）。
- [src/components/](frontend/packages/project-ide/main/src/components)
  - [index.ts](frontend/packages/project-ide/main/src/components/index.ts) 统一导出：TopBar、PrimarySidebar、widgetTitleRender、WidgetDefaultRenderer、SidebarExpand、ToolBar、GlobalModals、Configuration、ErrorFallback、GlobalHandler、BrowserTitle、GlobalLoading、UIBuilder 等。
  - 各子目录对应单一职责组件：
    - `top-bar/`：IDE 顶部导航/操作区域；
    - `primary-sidebar/`：左侧主侧边栏，展示资源导航、视图入口等；
    - `sidebar-expand/`：控制侧边栏展开/收起按钮；
    - `toolbar/`：每个 widget 顶部工具栏（含 `FullScreenButton` 等）；
    - `widget-*`：widget 标题渲染、默认内容渲染、错误兜底等；
    - `global-*`：全局 Modal、Loading、浏览器标题、全局事件处理等。
- [src/plugins/](frontend/packages/project-ide/main/src/plugins)
  - [index.ts](frontend/packages/project-ide/main/src/plugins/index.ts)：导出 `createAppPlugin`。
  - [create-app-plugin/](frontend/packages/project-ide/main/src/plugins/create-app-plugin)：封装 Project IDE App 的业务插件：
    - `index.ts`：使用 `definePluginCreator` 定义插件创建器：
      - 绑定 `OptionsService` 为常量（spaceId、projectId、version、navigate）；
      - 注册 `ProjectInfoService`、`OpenURIResourceService`、`WidgetEventService`、`LayoutRestoreService` 等业务服务；
      - 使用 `bindContributions` 将 `AppContribution` 注册为 `LifecycleContribution`，参与框架生命周期（例如启动/关闭时执行特定逻辑）。
    - 其他文件（app-contribution.ts、layout-restore-service.ts、open-url-resource-service.ts、project-info-service.ts、widget-event-service.ts、utils/）承载具体业务逻辑：布局恢复、项目信息拉取、Widget 事件分发、点击资源后打开 URL 等。
- 样式与资源：
  - [src/index.less](frontend/packages/project-ide/main/src/index.less) + [src/styles/recommend.css](frontend/packages/project-ide/main/src/styles/recommend.css) 控制 IDE 级样式；添加样式时应遵循现有命名与层级，避免污染全局。

## 三、运行时数据流与关键交互
- 数据入口：
  - URL 中的 `space_id`、`project_id`、`commit_version` 是本 IDE 页面最核心的上下文信息，缺失或不合法会导致无法正确初始化；
  - 通过 `useInitProjectRole` 获取并缓存项目角色信息，在完成前不渲染主体内容。
- 权限控制：
  - `useProjectAuth(EProjectPermission.View, projectId, spaceId)` 决定是否允许查看页面；返回 false 时直接抛出异常，让上层 Error Boundary 渲染统一的无权限/出错页。
- 视图装配：
  - `ProjectIDEClient` 的 `presetOptions.view` 字段是 IDE 视觉结构的核心：
    - `widgetRegistries`：挂载来自 biz-* 包的 widget 注册表（会决定左侧导航 & 主工作区有哪些模块，如对话、工作流、数据库、知识库、插件、变量等）；
    - `secondarySidebar`：使用来自 `@coze-project-ide/ui-adapter` 的 SecondarySidebar 作为右侧工具面板；
    - `topBar`、`primarySideBar`、`preToolbar`、`toolbar`、`widgetTitleRender`、`widgetDefaultRender`、`widgetFallbackRender`、`uiBuilder` 分别绑定到对应的本包组件，实现 UI 皮肤和行为定制。
- 插件机制：
  - `plugins` 数组包含：
    - `createAppPlugin({ spaceId, projectId, navigate, version })`：处理 IDE 内业务生命周期、项目信息、布局恢复、资源打开等；
    - `createResourceFolderPlugin()`：来自 `@coze-project-ide/biz-components`，负责资源文件夹管理/预置资源树能力。
  - 插件与 framework 之间通过依赖注入和 Contribution 抽象耦合：新增业务能力时优先考虑「定义新 Service/Contribution + 通过 createAppPlugin 绑定」的方式，而不是在组件内写死逻辑。

## 四、构建、测试与调试
- 本包自身 package.json：
  - `main: ./src/index.tsx`，供其他包（尤其是应用层）按模块方式引入。
  - `scripts.build: "exit 0"`：占位实现，说明本包不会单独跑构建流程，真实产物由 monorepo 上层构建系统生成。
  - `scripts.lint: eslint ./ --cache --quiet`：在本包目录下运行 `pnpm lint` 或 `npm run lint` 即可进行静态检查。
- 推荐工作流：
  - 安装依赖：在仓库根目录执行 `rush install` / `rush update`。
  - 端到端开发：
    - 在根目录或 frontend 目录，进入 [frontend/apps/coze-studio](frontend/apps/coze-studio)；
    - 运行 `rushx dev` 或 `npm run dev`，通过浏览器进入包含 Project IDE 的路由路径（通常为包含 space_id、project_id 的 URL）。
  - 调试本包：
    - 修改本包组件/插件后，无需单独编译；前端 dev server 会通过 workspace:* 依赖自动热更新；
    - 如需查看导出是否被正确消费，可在 [frontend/apps/coze-studio/src/routes/async-components.tsx](frontend/apps/coze-studio/src/routes/async-components.tsx) 中的 ProjectIDE 引用处下断点。
- 测试：
  - 当前包未定义独立的 test 脚本文件；单测/集成测试通常在更上层应用或相关 biz-* 包中实现。
  - 为新逻辑添加测试时，建议：
    - 若逻辑属于通用业务（如 LayoutRestoreService），优先在对应 biz/framework 包中添加测试；
    - 若确需在本包添加测试，需先对齐 monorepo 内已有 Vitest/Jest 配置方式（参考其他 project-ide 子包）。

## 五、项目约定与风格
- 组件与文件命名：
  - 组件使用大驼峰（如 `ProjectIDEContainer`、`IDELayout`）；文件与目录以 kebab-case 或语义命名（如 `layout.tsx`、`global-modals/`）。
  - 组件集中导出：统一在 [src/components/index.ts](frontend/packages/project-ide/main/src/components/index.ts) 中导出，再由 [src/index.tsx](frontend/packages/project-ide/main/src/index.tsx) 使用；新增组件时务必补充导出。
- 插件/服务模式：
  - 所有与 Project IDE 生命周期、事件总线、布局/资源等相关的业务建议通过「Service + Contribution + PluginCreator」方式注入，而不是直接塞到 React 组件里：
    - Service：纯业务逻辑、无 UI；
    - Contribution：定义在特定生命周期钩子中执行的行为；
    - PluginCreator：负责将 Service/Contribution 绑定进框架容器。
- 权限与初始化：
  - `useDestoryProject` + `useInitProjectRole` 是项目级别的标准初始化模式，在其他 Project/Agent IDE 相关包中也保持一致；修改时需评估对整个 Studio 的影响。
- 环境差异处理：
  - `uiBuilder: () => (IS_OVERSEA ? null : <UIBuilder />)` 使用全局常量 `IS_OVERSEA` 控制海外环境是否显示特定 UI；新增类似环境开关时，请保持使用全局常量/配置而不是硬编码字符串。

## 六、与其他子包/系统的集成要点
- 与 `@coze-project-ide/framework`：
  - 本包不直接操作状态容器，而是通过 `IDEGlobalProvider` + `ProjectIDEClient` 组合；修改这两个对象的使用方式前，应先阅读 framework 包的 copilot/instructions 或 README。
- 与 `@coze-project-ide/ui-adapter`：
  - SecondarySidebar 等只负责具体 UI 与局部状态，本包决定其在整个 IDE 布局中的位置和显示条件；如果需要替换侧边栏实现，应先在 ui-adapter 中提供替代组件，再在本包 options.view 中替换引用。
- 与 biz-* 包：
  - `WorkflowWidgetRegistry`、`ConversationRegistry`、`DatabaseWidgetRegistry`、`KnowledgeWidgetRegistry`、`PluginWidgetRegistry`、`VariablesWidgetRegistry` 等均来自各自的 biz 包；
  - 本包仅负责将这些 registry 注册给框架，不应修改其内部行为；如需新增/隐藏某类 widget，应在对应 biz 包中改造。

## 七、易踩坑与注意事项
- build 脚本为占位：不要在本包中增加复杂打包逻辑（webpack/rsbuild 等），所有构建相关配置应在 frontend/config 或 apps 层完成。
- 路由参数依赖：`layout.tsx` 强依赖 `space_id`、`project_id` 路径参数；若上层路由改名或路径结构有变，需同步更新此处参数解析逻辑。
- 全局错误处理：`ProjectIDE` 内直接 throw Error('can not view') 交由上层统一处理；不要在本包里捕获并吞掉该错误，否则会破坏统一的无权限展示策略。
- 插件绑定顺序：`createAppPlugin` 中使用 `rebind(LayoutRestorer)` 将默认布局恢复服务替换为 `LayoutRestoreService`；修改此逻辑时要确认不会导致布局状态无法持久化或恢复异常。

## 八、面向 AI 助手的操作建议
- 新增视图/区域：
  - 若需要在 IDE 中增加新的 widget 类别或工具区域：
    - 优先在相应 biz 包中新增 WidgetRegistry 或 Service；
    - 再在本包 `options.view.widgetRegistries` 中添加注册；
    - 如需对应的工具栏按钮/侧边栏入口，则在 components 目录内新增组件并在 `options.view` 中引用。
- 新增业务能力：
  - 需要在 IDE 启动/关闭时执行逻辑、或监听全局事件时：
    - 在 `create-app-plugin` 目录中新建 Service/Contribution；
    - 通过 `bindContributions` 或直接 `bind().toSelf().inSingletonScope()` 注入；
    - 避免直接在 React 组件生命周期中启动长生命周期任务。
- 修改导出 API：
  - `ProjectIDE` / `IDELayout` 的 props 变更会直接影响上层应用（async-components.tsx 中的 lazy import）；
  - 如需扩展 props，尽量保持向后兼容（提供可选参数），并同步更新 coze-studio 路由层调用方。
