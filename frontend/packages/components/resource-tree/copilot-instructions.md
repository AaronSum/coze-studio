# @coze-common/resource-tree 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/components/resource-tree）中安全、高效地协作开发。

## 1. 全局架构与数据流
- 本包提供「资源依赖树」可视化组件 `ResourceTree`，入口在 `src/index.tsx`，对外暴露 React 组件和若干工具类型：`NodeType`、`DependencyOrigin`、`isDepEmpty` 等。
- 上游业务通过 `data: DependencyTree`（来源于 `@coze-arch/bot-api/workflow_api`）作为唯一业务输入，组件内部负责将其转换为可渲染的流程图文档。
- 渲染引擎基于 `@flowgram-adapter/fixed-layout-editor`：
  - `FixedLayoutEditorProvider`（`src/fixed-layout-editor-provider/index.tsx`）封装 `PlaygroundReactProvider`，注入 `FlowDocument` 等核心服务；
  - 插件 preset 通过 `createFixedLayoutPreset` 建立，组合自定义节点、连线、图层等能力。
- 树结构构建核心逻辑集中在 `TreeService`（`src/services/tree-service.ts`）：
  - 输入 `DependencyTree` → 深度优先遍历（`dfsTransformNodeToSchema`）→ 生成内部 `TreeNode` 树；
  - 标记节点来源（`DependencyOrigin.APP/LIBRARY/SHOP`）、类型（`NodeType.CHAT_FLOW/WORKFLOW`）与深度、版本、是否循环引用（`isLoop`）；
  - 维护 `treeHistory` 与 `edges`，用于检测重复资源、环路以及多父节点引用；
  - 输出 `FlowNodeJSON` 树（`treeToFlowNodeJson`、`dfsTreeJson`），并写入 `FlowDocument.fromJSON` 驱动画布渲染。
- 自定义连线与图层：
  - `CustomLinesManager`（`src/services/custom-lines-manager.ts`）和 `CustomHoverService` 负责非标准连线渲染与 hover 行为；
  - `src/layers/flow-lines-layer.tsx` 和 `src/components/lines-render` 负责将 `CustomLine`（`src/typings/line.ts`）渲染到画布之上。
- React 层：
  - `ResourceTree` 在 `useEditorProps`（`src/hooks/use-editor-props.tsx`）生成的 `FixedLayoutProps` 上包一层 `TreeContext`，并渲染 `EditorRenderer` 与工具条 `Tools`；
  - `TreeContext`（`src/contexts/tree-context.tsx`）目前仅承载 `renderLinkNode` 注入能力，用于对某些节点的「外链内容」进行自定义渲染。

## 2. 开发工作流（构建 / 测试 / 调试）
- 依赖安装：在 monorepo 根目录执行 Rush 工作流（参考 `frontend/README.md`）：
  - `rush install` 或 `rush update` 统一安装依赖；
  - 不建议在子包内直接运行 `npm install`。
- 子包脚本（见 `package.json`）：
  - `npm run build`：当前实现为 `exit 0`，仅用于流水线占位，不进行实际构建；AI 助手不应依赖其产物做行为判断；
  - `npm run lint`：使用 `@coze-arch/eslint-config`，规则 preset 为 `web`，部分 TypeScript 严格规则在本包关闭（见 `eslint.config.js`）；
  - `npm run test`：通过 Vitest 运行单测，配置来自 `vitest.config.ts` 与 monorepo 级 `@coze-arch/vitest-config`；
  - `npm run test:cov`：在 `test` 基础上开启覆盖率（`@vitest/coverage-v8`）。
- 覆盖率要求：在 `frontend/rushx-config.json` 中，本包标签为 `team-automation`、`level-3`，对应 `codecov.level-3` 要求为全局 0%，增量 0%。
  - 含义：目前对测试覆盖率没有硬性门槛，但仍建议为重要转换逻辑（如 `TreeService`、`transform-tree` 工具）补充用例；
  - AI 助手在重构/新增逻辑时，可优先为纯函数工具编写 Vitest 单测，而非尝试构建复杂渲染测试。
- 本包没有独立的 dev/preview 命令，画布行为应在应用层（如 `apps/coze-studio`）中通过集成使用来观察。

## 3. 项目约定与模式
- 技术栈与风格：
  - React 18 + TypeScript，面向浏览器，使用函数组件与 Hooks；
  - 依赖 `inversify` 和 `reflect-metadata` 提供 DI 容器能力，服务类（如 `TreeService`）通过 `@injectable()`、`@inject()` 获取依赖；
  - UI 基础与主题来自 `@coze-arch/coze-design` 与 `@flowgram-adapter/*`，本包不直接引入其它 UI 框架。
- 文件与目录结构约定：
  - `src/services`：放置与渲染引擎交互的业务服务，侵入性较强，通常以类 + DI 容器注入方式存在；
  - `src/utils`：只放通用纯函数工具（`transform-tree.ts`、`status.ts`、`node.ts` 等），禁止在此层直接访问 React 或 DI 容器；
  - `src/components`：只负责 React UI 层（`BaseNode`、`Collapse`、`Tools` 等），通过 props 和上下文接收数据，不直接操作 `FlowDocument`；
  - `src/hooks`：封装复杂配置/上下文（如 `useEditorProps`），集中对第三方 editor 的配置与插件装配；
  - `src/layers` & `src/plugins`：对 `fixed-layout-editor` 的扩展点做二次封装，所有与 editor 插件系统相关的代码放在这里；
  - `src/typings`：本包内公共类型定义与导出，与上游业务 API 类型（`@coze-arch/bot-api/workflow_api`）做隔离与适配。
- 命名与类型习惯：
  - `TreeNode`：内部抽象树节点结构，用于构建资源依赖树，与 editor 渲染结构 `FlowNodeJSON` 解耦；
  - `NodeType` / `DependencyOrigin`：统一标识节点「业务类型」与「来源」枚举，在渲染和样式中被广泛使用；
  - `CustomLine` / `EdgeItem`：区分「逻辑连边」与「渲染连线」；前者用于去重和拓扑关系，后者映射到 canvas 上的线段形态。
- 代码风格细节（从规则与实现中反推）：
  - 允许适度使用 `any`、非空断言等，以保证与第三方 editor API 对接的灵活性（见 `eslint.config.js` 中关闭的 TS 规则）；
  - 服务类（如 `TreeService`）可以适度复杂，内部通过拆分若干私有方法（`transformDuplicateInfo`、`dfsTreeJson` 等）来控制复杂度；
  - 纯工具函数文件通常只导出命名导出，不在内部维护组件状态。

## 4. 关键组件与外部依赖集成
- `@flowgram-adapter/fixed-layout-editor`：
  - 提供核心画布能力：`FlowDocument`（状态模型）、`EditorRenderer`（React 渲染器）、`PlaygroundReactProvider`（上下文容器）；
  - 本包通过 `FixedLayoutEditorProvider` 抽象配置 preset 和 plugin context，任何对 editor 插件/常量的修改应经由此处；
  - `useEditorProps` 中的 `onReady` 和 `onAllLayersRendered` 是挂载自定义服务的主入口：
    - `TreeService.transformSchema(json)` + `treeToFlowNodeJson()` 完成初次渲染；
    - `CustomLinesManager.initLines()` 根据 `TreeService.edges` 补齐自定义连线。
- `@flowgram-adapter/free-layout-editor`：
  - 当前仅用于 `createMinimapPlugin`，作为缩略图能力；
  - 配置位于 `useEditorProps` 中 `plugins` 返回数组最后一项，调整参数时注意不要改变已有 canvas 行为（大小、颜色等）。
- 业务 API：`@coze-arch/bot-api/workflow_api`：
  - `DependencyTree` / `DependencyTreeNode` 结构用于描述某个 workflow 的资源依赖；
  - `KnowledgeInfo` / `PluginVersionInfo` / `TableInfo`：分别被 `transformKnowledge`、`transformPlugin`、`transformTable` 转换为 editor 节点；
  - AI 助手在修改转换函数时，必须保持字段映射与 TreeService 的调用契合（例如：`data.id` / `data.version` / `data.depth` 会用于重复检测和布局）。
- DI 容器与服务：
  - 使用 `inversify` 容器注入 `FlowDocument`、`TreeService`、`CustomLinesManager` 等；
  - 自定义 plugin context（`FixedLayoutEditorProvider` 中）通过 `container.get<FlowDocument>(FlowDocument)` 暴露 `document`；
  - 在新增服务时，优先：
    1. 定义 `@injectable()` service 类；
    2. 在 preset / plugin 中绑定到容器；
    3. 在 `onReady` / `onAllLayersRendered` 中通过 `ctx.get()` 使用。

## 5. 流程与协作规范
- 分支与提交流程：本 repo 的通用规范见根目录文档（如 `CONTRIBUTING.md`、`README.md`），本包遵循 monorepo 统一流程，当前包内未定义额外分支策略；
- 质量控制：
  - 所有变更至少需要通过 `npm run lint` 与 `npm run test`；
  - 若新增/修改核心逻辑（特别是 `TreeService` 和 `src/utils/transform-tree.ts`），建议同时增加/更新 Vitest 用例；
  - 由于本包 codecov 要求为 0%，CI 不会强制失败，但请尽量保持现有测试绿灯。
- 依赖与发布：
  - 版本与发布由 Rush + monorepo pipeline 统一管理，本包 `version` 字段为内部使用，不建议 AI 助手擅自修改；
  - 依赖范围以 workspace 内包为主（`@coze-arch/*`、`@flowgram-adapter/*` 等），不应随意引入大型新第三方库，尤其是 UI 框架和状态管理库。

## 6. 非常规 / 需要特别注意的特性
- `TreeService` 的重复检测与环路处理：
  - 通过 `treeHistory` 与 `getNodeDuplicateFromTree` 判断是否已存在相同资源 + 版本的节点；
  - 若重复且深度匹配，则只添加一条 edge，不再重复创建节点；
  - 若重复但深度不匹配，会创建一个特殊「end」节点（`meta.isNodeEnd = true`），避免无限递归；
  - `isLoop` 会结合全局 `DependencyTree` 判断是否存在环路，用于在 UI 上特殊展示（例如图标或样式）。
- 折叠节点与延迟挂载：
  - 对于被标记为 `collapsed` 的节点，其子节点不会直接挂载到 `blocks` 下，而是通过 `dfsTreeJson` 与 `addChildrenArr` 机制延后插入；
  - `cloneNode` 会通过 `dfsCloneCollapsedOpen` 强制展开 clone 的节点，保证在被多处引用时能正确渲染所有子树；
  - 在修改节点结构或折叠逻辑时，务必保持 `treeToFlowNodeJson` 和 `dfsTreeJson` 两个阶段的一致性，否则会出现渲染缺失或多重挂载。
- 自定义连线与 hover 行为：
  - 逻辑连线存储在 `TreeService.edges`，只记录 `from` / `to` 节点 id；
  - 真正的渲染线段由 `CustomLinesManager` 与 `flow-lines-layer` 完成，可能依赖 editor 提供的节点位置信息；
  - 修改连线生成逻辑时，注意区分「拓扑关系」和「视觉呈现」，不要在 service 层引入 canvas 细节。
- 上下文扩展点：
  - `TreeContext.renderLinkNode` 提供了从外部注入 link 节点渲染 React 组件的能力；
  - 在对 `BaseNode` / `Tools` 等组件进行扩展时，应优先通过 context 或 props 传入，而非从全局单例读取数据。

## 7. AI 助手修改建议（操作性规则）
- 在本包内进行修改时，优先遵守：
  - 不重构第三方 `@flowgram-adapter/*` 接口，只在本包中做适配；
  - 不变更 `ResourceTree` 对外 API 签名（props 名称与含义保持不变），除非需求明确要求且更新了引用方；
  - 新增逻辑优先放入 `src/utils` 或新的 service 类，再由 `useEditorProps` 或现有 service 调用；
  - 避免在 React 组件中直接操作 `FlowDocument`，统一通过 service + plugin 处理；
  - 修改复杂 DFS / tree transform 逻辑时，务必补充或更新结构性单测，用抽象数据构造 `DependencyTree` 并断言输出结构（如节点数量、edge 关系、isNodeEnd 标记等）。
