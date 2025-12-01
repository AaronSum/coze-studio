# 本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/render）中安全、高效地协作开发。

本包为 Coze Studio 工作流可视化编辑器提供渲染容器、快捷键接入及与 free-layout-editor/fabric-canvas 等子系统的集成，是前端工作流域的核心 UI 入口之一。

## 全局架构
- 入口模块 [src/index.ts](frontend/packages/workflow/render/src/index.ts) 主要负责导出本包对外 API：
  - 暴露工作流渲染容器 `WorkflowRenderProvider`、容器模块 `WorkflowRenderContainerModule`、快捷键扩展 `WorkflowShortcutsContribution` 等能力；
  - 统一 re-export `FlowRendererKey`、`FlowRendererRegistry`、`FlowRendererContribution` 等类型（用于注册不同渲染实现，如 fabric-canvas 渲染）；
  - 透传部分来自其它 workflow 子包（如 base/sdk/adapter）的类型，作为上层应用使用的汇总入口。
- 渲染容器与 DI 集成：
  - [workflow-render-container-module.ts](frontend/packages/workflow/render/src/workflow-render-container-module.ts) 定义 Inversify 容器模块，注册 `FlowRendererRegistry`、`WorkflowShortcutsRegistry` 等服务及其默认实现；
  - [workflow-render-provider.tsx](frontend/packages/workflow/render/src/workflow-render-provider.tsx) 通常包裹在应用级别，负责初始化 DI 容器、注入默认渲染器和扩展点，再将 context 提供给 React 子树。
- 渲染/编辑 UI：
  - [workflow-loader.tsx](frontend/packages/workflow/render/src/workflow-loader.tsx) 负责根据 workflow JSON / 加载状态装配实际渲染组件（如 fabric-canvas 编辑器），是“从数据到画布”的桥梁；
  - `components/` 下封装了工作流渲染相关 UI 组件（工具栏、侧边栏、状态提示等），与 `@coze-arch/coze-design` 组件库和 workflow/fabric-canvas 协作；
  - `layer/` 中若存在文件，一般用于图层、蒙层或跨组件 overlay 管理，与渲染容器解耦。
- 快捷键与命令：
  - [workflow-shorcuts-contribution.ts](frontend/packages/workflow/render/src/workflow-shorcuts-contribution.ts) 定义 `WorkflowShortcutsContribution` 接口及其默认实现，通过 DI 注入 `WorkflowShortcutsRegistry` 为上层（如 history 包）提供扩展点；
  - 所有工作流相关快捷键（撤销/重做、画布操作等）最终都会在此注册，history 包等只是在该扩展点上追加命令实现。
- 公共工具与常量：
  - `constants/` 存放工作流渲染域内的常量（命令 ID、上下文 key 等）；
  - `utils/` 聚合与渲染器无关的工具函数（例如数据映射、坐标/缩放转换），会被 components 和 loader 复用；
  - `index.module.less` 为本包样式入口，配合 root 构建配置按需抽取 CSS。

## 关键构建 / 调试流程
- 依赖安装与基础命令：
  - 在仓库根目录按 [frontend/README.md](frontend/README.md#L47-L78) 进行 `rush install` / `rush update`，保证 workspace:* 依赖正确链接；
  - render 子包自身 `package.json` 中脚本（见 [package.json](frontend/packages/workflow/render/package.json)）：
    - `build`: `exit 0`，本包不单独产出构建结果，仅参与类型检查和运行时；
    - `build:watch` / `dev`: 依赖 `edenx` 工具（内部脚手架），当前 monorepo 默认通过上层应用运行，通常无需在子包直接执行；
    - `lint`: `eslint ./`，可通过 `rushx lint --to @coze-workflow/render` 触发；
    - `new` / `upgrade`: 与 `edenx` 相关的代码模版/升级命令，仅在需要脚手架功能时使用。
- TypeScript 配置：
  - [tsconfig.json](frontend/packages/workflow/render/tsconfig.json) 作为 composite 项目入口，声明 references 及基础配置；
  - [tsconfig.build.json](frontend/packages/workflow/render/tsconfig.build.json) 继承 `@coze-arch/ts-config/tsconfig.web.json`，负责编译 `src`，并通过 `references` 显式依赖 workflow/base、fabric-canvas、adapter 等子包；
  - [tsconfig.misc.json](frontend/packages/workflow/render/tsconfig.misc.json) 用于非产出文件（如 `__tests__`、配置文件）的类型检查，保持编辑器体验一致。
- 本包未定义 `test` 脚本，也未在包级配置 Vitest；
  - 实际调试/联调通常在消费侧应用进行，例如 [frontend/apps/coze-studio](frontend/apps/coze-studio) 的 workflow 详情页或 [frontend/packages/workflow/playground](frontend/packages/workflow/playground)；
  - 渲染相关问题建议通过启动主应用（`cd frontend/apps/coze-studio && rushx dev`）后，在浏览器 DevTools 中配合源码映射调试。
- Rush 额外配置：
  - render 包的 Rush 项目配置位于 [frontend/packages/workflow/render/config/rush-project.json](frontend/packages/workflow/render/config/rush-project.json)（如存在），通常用于声明 `ts-check`、`build` 等 operation 与其输出目录；
  - 在 CI 或本地批量检查类型时使用 Rush 顶层命令（例如 `rushx ts-check --to @coze-workflow/render`），保持树形依赖顺序正确。

## 项目约定与模式
- 依赖注入模式（Inversify）：
  - 容器模块统一通过 `new ContainerModule(bind => { ... })` 注册服务与扩展点（参见 [workflow-render-container-module.ts](frontend/packages/workflow/render/src/workflow-render-container-module.ts)）；
  - 业务/基础服务使用 `@injectable()` 与 `@inject()` 装饰器声明依赖，避免手动 new 或直接跨模块引用；
  - 扩展点（如 `FlowRendererContribution`、`WorkflowShortcutsContribution`）统一通过 `bindContributions`（来自 `@flowgram-adapter/common`，接口参考 history 包）进行多实现注册。
- 渲染器注册模式：
  - 通过 `FlowRendererRegistry.register(FlowRendererKey, renderer)` 将具体渲染实现（如 fabric-canvas 编辑器）挂入容器；
  - 上层组件/loader 只依赖 `FlowRendererKey` 和 `FlowRendererRegistry`，不直接 import 具体实现，便于后续替换/扩展；
  - 自定义渲染器时，应实现 `FlowRendererContribution` 接口并在容器模块中注册，避免散落在各处。
- 快捷键扩展模式：
  - render 包只定义基础抽象与默认实现，具体业务快捷键（如历史撤销/重做、运行/调试等）在其它包中以 `WorkflowShortcutsContribution` 的方式扩展；
  - 快捷键 handler 一般遵循：`commandId + shortcuts[] + isEnabled(context) + execute(context)` 的模式，以便统一管理冲突与启用条件。
- 样式与 sideEffects：
  - [package.json](frontend/packages/workflow/render/package.json) 中 `sideEffects` 声明了所有样式类文件（`**/*.css|less|sass|scss`），保证构建 tree-shaking 时不会误删渲染必需的样式 import；
  - 组件样式尽量集中定义在 `index.module.less` 或组件同名 less 文件，配合全局 Tailwind/设计体系使用。
- 代码风格与 lint：
  - ESLint 配置在 [eslint.config.js](frontend/packages/workflow/render/eslint.config.js) 继承 `@coze-arch/eslint-config` 的 web 预设，保持与其它 frontend 包一致；
  - TS 使用严格模式，优先使用显式类型导入与 `type` 关键字，减少交叉引用引起的循环依赖。

## 关键集成点与外部依赖
- `@flowgram-adapter/free-layout-editor`：
  - 提供底层文档/操作/历史等编辑能力，render 包通过 loader 与容器将其挂到 React UI 上；
  - 所有对画布的实际操作（增删节点、连线、拖拽等）都在 free-layout-editor 内执行，render 包只负责“连接 UI 与编辑器引擎”。
- `@coze-workflow/fabric-canvas`：
  - 作为主要的画布实现之一，为工作流节点/连线提供可视化编辑体验；
  - render 包中的 loader/组件负责将 workflow JSON 与 fabric-canvas 的 context 进行映射，例如初始化画布、监听内容变化、触发历史栈更新等；
  - 当 fabric-canvas 引入 breaking change 时，优先在 render 层做兼容适配，避免影响上层应用。
- `@coze-workflow/base` / `@coze-workflow/sdk` / `@coze-workflow/adapter`：
  - 提供工作流 JSON 类型、运行态接口、后端交互适配等能力；
  - render 包通过它们获取/提交 workflow 数据、绑定运行结果或调试信息，但不直接处理业务逻辑或 API 细节。
- `@coze-workflow/history`：
  - 在 render 的快捷键与命令扩展点之上注册撤销/重做等历史能力；
  - 双方通过接口解耦：render 只定义扩展点，history 仅消费这些扩展点并暴露额外 hooks/服务（见 [frontend/packages/workflow/history/copilot-instructions.md](frontend/packages/workflow/history/copilot-instructions.md)）。
- `@coze-arch/coze-design`：
  - Coze 前端统一 UI 组件库，render 中的大部分基础 UI（按钮、弹窗、布局等）依赖于该库；
  - 设计规范、交互模式以 coze-design 为准，修改 UI 行为时优先使用已有组件能力而不是自定义 DOM。
- 其它三方库：
  - `inversify` + `reflect-metadata`：DI 容器与装饰器支持；
  - `lodash-es`：常用工具函数（如 `cloneDeep` 等）；
  - `nanoid`：生成工作流内元素的唯一 ID；
  - `classnames`：合并 CSS class；
  - `@use-gesture/vanilla`：处理画布拖拽/手势交互（如缩放、平移）。

## 过程规范与协作
- Git 分支与提交规范：
  - 统一遵循仓库根目录 [CONTRIBUTING.md](CONTRIBUTING.md) 中的约定（git-flow/FDD、Angular 风格 commit message 等）；
  - 对 render 包的变更建议在 PR 标题/描述中显式标注 "workflow render"，便于代码审阅与发布记录归类。
- 推荐的最小验证流程（针对 render 改动）：
  - 本地运行 `rushx lint --to @coze-workflow/render`，确保 lint 通过；
  - 在 [frontend/apps/coze-studio](frontend/apps/coze-studio) 中启动 dev 环境（`rushx dev`），进入任意 workflow 编辑页面验证：
    - 画布能正确渲染与响应交互；
    - 快捷键（如撤销/重做、复制粘贴等）行为与预期一致；
    - 控制台无新错误/告警。
- 与其它 workflow 子包的依赖关系：
  - render 处于“上承应用 UI、下接画布引擎与适配层”的位置，改动时要注意：
    - 不直接依赖下层包的内部实现，优先通过暴露的接口/类型交互；
    - 若添加新依赖（如新的 workflow/* 子包），需要同步更新 [tsconfig.build.json](frontend/packages/workflow/render/tsconfig.build.json) 的 `references` 以及根 Rush 配置。

## 特殊 / 区别性特征
- 核心 UI 入口但不产出独立 bundle：
  - 本包的 `build` 脚本目前为 `exit 0`，真正的构建在上层应用（如 coze-studio）中完成；
  - 因此不要在 CI 或脚本中直接依赖 `@coze-workflow/render` 的 `dist` 目录，类型检查与构建均以 monorepo 顶层为准。
- 以“扩展点驱动”为主：
  - render 自身尽量只提供抽象与默认实现，所有业务/领域特定能力（历史、运行、调试等）通过独立子包挂载；
  - 新增能力时，优先考虑是否可以通过 `FlowRendererContribution` 或 `WorkflowShortcutsContribution` 等扩展点实现，而不是直接耦合在主渲染容器中。
- 强依赖 Rush/TS 项目引用顺序：
  - 由于 render 依赖多个 workflow/* 子包以及 arch 层包，TS 项目引用链较长；
  - 如需调整包之间的依赖关系，务必同步修改相关 `tsconfig.*.json` 与 Rush 配置，避免 `tsc --build` 在 CI 中出现循环依赖或缺失引用问题。
