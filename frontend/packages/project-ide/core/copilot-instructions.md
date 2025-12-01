# @coze-project-ide/core 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/core）中安全、高效地协作开发。

## 全局架构概览
- 本包提供 Project IDE 的「核心运行时」，对外暴露统一入口：[src/index.ts](frontend/packages/project-ide/core/src/index.ts)，聚合导出所有子模块能力。
- 采用 Inversify 风格的 IoC/DI 容器，核心依赖由 @flowgram-adapter/common 和本包 common/* 提供：
  - 事件 & 资源管理：Emitter、Event、Disposable、DisposableCollection、StorageService、WindowService。
  - 插件体系：Plugin、PluginContext、definePluginCreator、loadPlugins、LifecycleContribution 等。
  - 上下文 & URI：ContextKeyService、URI、URIHandler、path/uri 封装。
- 核心领域模块：
  - application：IDE Application 启动与容器装配（Application、IDEContainerModule），负责聚合各类 ContainerModule 与插件。
  - resource：资源抽象（Resource、ResourceInfo、ResourceService、AutoSaveResource 等），统一管理文件/文档等可持久化实体。
  - command：命令系统（Command、CommandService、CommandRegistry、createCommandPlugin），类似 VS Code Command API。
  - shortcut：快捷键系统（ShortcutsService、ShortcutsRegistry、createShortcutsPlugin），为命令/动作提供键盘绑定。
  - preference：偏好配置系统（PreferenceSchema、PreferenceContribution、createPreferencesPlugin）。
  - navigation：导航系统（NavigationService、NavigationHistory、createNavigationPlugin）。
  - styles：主题 & 样式系统（ThemeService、ColorTheme、StylingContribution、createStylesPlugin）。
  - label：资源/URI 的 label 化显示（LabelService、URILabel、LabelHandler、createLabelPlugin）。
  - renderer：React 渲染适配层（IDEProvider、IDERenderer、useIDEContainer/useIDEService 等），为上层 app 提供 Hook + Context 接口。
  - event：跨模块事件中心（EventService、EventContribution、createEventPlugin）。
- 设计理念：
  - 把「IDE 能力」拆成多个可插拔插件，每个领域（命令/资源/导航/样式等）都有对应 *Plugin + Service + Contribution* 三件套。
  - 通过 Inversify 容器 + ContainerModule 把所有服务注入 Application，React 端通过 renderer 暴露 Hook 访问服务。

## 代码结构与主要文件
- 顶层配置
  - [package.json](frontend/packages/project-ide/core/package.json)：定义构建、Lint、TypeScript、Vitest 依赖及脚本，对外入口 main=src/index.ts（由 tsup 打包）。
  - [tsconfig.build.json](frontend/packages/project-ide/core/tsconfig.build.json)：继承 monorepo 通用 web tsconfig，构建输出到 lib-ts，根目录为 src，并通过 references 依赖其他 config 包。
  - [vitest.config.ts](frontend/packages/project-ide/core/vitest.config.ts)：统一测试配置，使用 jsdom 环境，忽略 dist/lib/node_modules 等目录。
- 核心导出入口
  - [src/index.ts](frontend/packages/project-ide/core/src/index.ts)：聚合导出所有子模块能力，是理解本包职责的最佳索引。
- common 子模块（通用基础能力）
  - [src/common/index.ts](frontend/packages/project-ide/core/src/common/index.ts)：统一 re-export 路径服务、插件创建工具、生命周期 contribution、容器工厂等。
  - [src/common/plugin.ts](frontend/packages/project-ide/core/src/common/plugin.ts)：定义 Plugin、PluginCreator、PluginConfig、PluginsProvider 等核心类型及插件装配方法。
  - [src/common/container-factory.ts](frontend/packages/project-ide/core/src/common/container-factory.ts)：封装 Inversify Container 创建逻辑及通用绑定惯例。
  - [src/common/context-key-service.ts](frontend/packages/project-ide/core/src/common/context-key-service.ts)：管理上下文 key/value，用于条件性启用命令、快捷键等。
  - [src/common/open-service.ts](frontend/packages/project-ide/core/src/common/open-service.ts)：抽象打开资源/视图（OpenerService、OpenHandler、OpenerOptions）。
  - [src/common/uri.ts](frontend/packages/project-ide/core/src/common/uri.ts) & [src/common/path.ts](frontend/packages/project-ide/core/src/common/path.ts)：基于 vscode-uri 的 URI 封装和路径工具。
  - [src/common/prioritizeable.ts](frontend/packages/project-ide/core/src/common/prioritizeable.ts)：按优先级排序/选择逻辑，配套 vitest 用例。
- application 子模块
  - [src/application/application.ts](frontend/packages/project-ide/core/src/application/application.ts)：Application 类定义 IDE 生命周期（启动、插件装载、服务初始化等）。
  - [src/application/container-module.ts](frontend/packages/project-ide/core/src/application/container-module.ts)：IDEContainerModule 收拢所有核心 ContainerModule 及插件绑定点。
  - [src/application/index.ts](frontend/packages/project-ide/core/src/application/index.ts)：导出 Application、IDEContainerModule，并可能封装快捷创建函数。
- 领域插件子模块（模式高度相似）
  - command/*：定义 Command、CommandService、CommandRegistryFactory，以及 createCommandPlugin、CommandContribution。
  - resource/*：定义 Resource、ResourceService、ResourceHandler、ResourcePluginOptions、AutoSaveResource 等，集中实现文档生命周期与保存策略。
  - shortcut/*：集中快捷键注册与解析，ShortcutsService 通过上下文/命令协同。
  - preference/*：偏好 schema 声明 + 读取服务，支持动态 schema/默认值。
  - navigation/*：提供 NavigationService 与基于栈的 NavigationHistory。
  - styles/*：样式收集器 Collector、主题模型 ColorTheme、ThemeService。
  - label/*：LabelService、LabelChangeEvent 与 URILabel 映射逻辑。
  - event/*：EventService 与 EventContribution 的插件封装。
- renderer 子模块
  - [src/renderer/index.ts](frontend/packages/project-ide/core/src/renderer/index.ts)：导出 IDEProvider、IDERenderer、IDERendererProvider、IDEContainerContext，以及 useIDEContainer/useIDEService/useNavigation/useStyling 等 React Hook。
  - 约定：
    - 上层 React app 必须用 IDEProvider 包裹根节点，才能在子树中通过 Hook 访问 DI 容器中的服务。

## 构建、测试与调试流程
- 构建
  - 推荐使用 Rush 统一构建：在 monorepo 根目录运行：
    - `rush build -t @coze-project-ide/core`（或对应自定义命令）构建本包及其依赖。
  - 子包单独构建：在 frontend/packages/project-ide/core 目录下（通常通过 rushx 调用）：
    - `npm run build:fast`：使用 tsup 对 src/index.ts 打包为 cjs + esm，并生成 sourcemap；legacy-output 方便兼容下游 bundler。
    - `npm run build:watch` / `npm run watch`：在开发时 watch 编译，并开启 `--dts-resolve` 以解决类型引用。
  - `npm run build` 当前实现为 `exit 0`，仅作为 Rush pipeline 占位；实际构建逻辑在 build:fast。
- 类型检查 & Lint
  - `npm run ts-check`：调用 tsc --noEmit，使用 tsconfig.build.json 配置，对 src 进行严格检查（strictNullChecks 打开，strictPropertyInitialization 关闭）。
  - `npm run lint`：eslint ./ --cache --quiet，规则来自 @coze-arch/eslint-config，尽量保持与 monorepo 统一风格。
- 测试
  - Vitest 统一配置在 [vitest.config.ts](frontend/packages/project-ide/core/vitest.config.ts)：
    - test.environment = jsdom，方便与 React/DOM 相关的单测。
    - include：`**/?(*.){test,spec}.?(c|m)[jt]s?(x)`；src 下单测文件命名约定为 *.test.ts / *.spec.ts。
    - exclude：node_modules/dist/lib/cypress 等构建或端到端目录。
  - 典型测试文件示例：
    - [src/common/prioritizeable.spec.ts](frontend/packages/project-ide/core/src/common/prioritizeable.spec.ts)
    - [src/common/uri.spec.ts](frontend/packages/project-ide/core/src/common/uri.spec.ts)
  - 建议新增测试沿用 Vitest + jsdom，放在对应模块目录下，以单元级粒度覆盖服务/插件逻辑。

## 项目约定与代码风格
- 语言与运行环境
  - 使用 TypeScript（目标 web），enable strictNullChecks；React 版本 >=17，通过 peerDependencies 约束。
  - 编译产物默认不提交到源码仓（dist/lib 等在 .gitignore），以源码 + 构建管线为主。
- 依赖与 DI
  - 所有跨模块共享能力通过 Inversify 容器和 Service 对象注入，而非直接 import 具体实现。
  - 插件/服务之间通过抽象接口（Service、Contribution）通信，避免循环依赖；如 CommandContribution/ShortcutsContribution/StylingContribution 等。
  - 对外 API 尽量通过 src/index.ts 暴露，而非直接 import 深层模块路径。
- 插件模式
  - 每个领域模块通常提供：
    - `createXxxPlugin(options: XxxPluginOptions)`：把领域服务及其 contribution 注入容器。
    - 若干 Service 类（XxxService）和 Contribution 接口（XxxContribution）。
    - 与 Plugin 体系结合：通过 definePluginCreator / loadPlugins 进行声明式装载。
  - 编写新能力时优先考虑：是否应作为独立插件暴露；是否需要对应的 Service + Contribution 双层抽象。
- 资源/URI/Label 统一
  - 所有可打开/持久化的实体建议以 Resource/URI 为中心建模：
    - 通过 ResourceService 管理生命周期和 AutoSaveResource 行为。
    - 使用 URI 封装路径与查询参数；LabelService 决定在 UI 中的展示文案。
  - 避免在上层组件中硬编码路径字符串，优先使用 URI 封装和 URILabel 生成展示名称。
- React 端接入
  - 上层 app 不直接 new Service，而是：
    - 使用 IDEProvider 提供容器实例。
    - 使用 useIDEContainer/useIDEService/useNavigation/useStyling 等 Hook 访问服务。
  - 新增 React Hook 应始终基于已有服务抽象，而非在 Hook 中直接操作容器。

## 外部依赖与集成细节
- @flowgram-adapter/common
  - 提供基础工具：Emitter、logger、Disposable/DisposableCollection、bindContributions、Event 等。
  - 是本包的「下层运行时」，不要在这里重新造轮子；新增能力应优先复用其事件/生命周期管理工具。
- inversify
  - DI 容器实现，用于管理 Service/Plugin/Contribution 的实例生命周期。
  - 在 ContainerFactory / IDEContainerModule 中集中管理 binding，避免在业务代码中随处创建新容器。
- vscode-uri
  - 对 URI 的解析和序列化，统一文件/资源标识。
  - 所有路径处理建议先转成 URI，再进行逻辑，而不是直接基于 string 处理。
- lodash
  - 仅用于通用工具函数，使用时保持按需引用（避免 bundle 体积过大）。

## 开发流程与协作规范
- 分支与提交（参考 monorepo 统一规范）
  - 一般通过 feature/xxx 或 fix/xxx 分支工作，再合入主干；遵循仓库级 PR/Review 流程。
  - 建议在本子包改动前后，使用 Rush 的增量构建/测试能力，如：
    - `rush build -t @coze-project-ide/core`
    - `rushx test --from @coze-project-ide/core`（若在 monorepo 中配置了 rushx 封装）。
- 修改/新增模块时的推荐步骤
  - 确认是否已有相近能力模块（例如已有 ResourceService 时，不要在其他模块新写一套资源管理）。
  - 对外导出的任何新类型/函数，必须在 [src/index.ts](frontend/packages/project-ide/core/src/index.ts) 中补充导出，保持 API 收敛。
  - 对应新增/修改逻辑应增加 Vitest 单测，放在同目录下的 *.spec.ts。
  - 若引入新外部依赖，需兼容 Monorepo 的 Rush + PNPM 管理方式，在根目录 rush.json / common/config 中按规范声明。

## 非常规或需要特别注意的点
- build 脚本
  - `npm run build` 目前不会执行真正构建，仅返回 0；构建流程应使用 `build:fast` 或 Rush 的上层命令。
- tsconfig 布局
  - 根 tsconfig.json 将 `exclude: ["**/*"]`，并通过 references 指向 tsconfig.build.json 与 tsconfig.misc.json：
    - tsconfig.build.json：用于生产构建/类型检查。
    - tsconfig.misc.json：包含测试相关文件（__tests__/vitest.*），方便 IDE 类型提示而不影响构建输出。
- 测试环境
  - vitest 默认使用 jsdom；若实现与 Node 环境强绑定逻辑，需要显式在测试中 mock 或调整 environment。
- React peerDependencies
  - 本包不直接安装 react/react-dom，而是通过 peerDependencies 声明；上层应用必须提供 React 运行环境。
- 忽略 CLAUDE 配置
  - 仓库存在 CLAUDE.md，但根据约定在本子包内为 AI 协作时应以 copilot-instructions.md 为主，不需要遵循 CLAUDE.md 中的额外指令。
