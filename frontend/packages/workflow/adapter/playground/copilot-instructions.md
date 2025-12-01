# @coze-workflow/playground-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/adapter/playground）中安全、高效地协作开发。

## 1. 全局架构与角色定位

- 本子包是工作流前端体系中的一个适配层，主要用于在上层应用中以页面形式嵌入 `@coze-workflow/playground` 提供的工作流编辑/调试 Playground 能力。
- 入口文件为 [src/index.tsx](src/index.tsx)，对外仅导出 `WorkflowPage` 组件，供上层路由或容器按需挂载。
- 核心页面组件在 [src/page.tsx](src/page.tsx) 中实现，通过组合：
  - 外部依赖 `@coze-workflow/playground/workflow-playground` 提供的 `WorkflowPlayground` 组件及其 `WorkflowPlaygroundRef`、`AddNodeRef`。
  - 本包内部 hooks（位于 [src/hooks](src/hooks)）解析 URL 参数、处理返回导航。
- 子包本身不负责复杂的业务状态管理，主要做：参数解析 → 调用 playground → 处理首屏跳转/只读模式/历史版本回滚 → 将结果通过回调交还给宿主应用。

## 2. 关键数据流与组件交互

- 页面参数解析（来源通常为路由 query）：
  - 在 [src/hooks/use-page-params.ts](src/hooks/use-page-params.ts) 中抽象出 `spaceId`、`workflowId`、`version`、`setVersion`、`from`、`optType`、`nodeId`、`executeId`、`subExecuteId` 等字段。
  - `WorkflowPage` 只依赖该 hook 的返回值，不直接耦合外部路由实现，方便在不同路由系统中复用。
- Playground 挂载及控制：
  - 使用 `useRef<WorkflowPlaygroundRef>(null)` 持有 playground 实例引用，凡是“滚动到节点”“展示执行结果”“重置到历史版本”等高级操作，都通过该 ref 进行：
    - `resetToHistory({ commitId, optType })`
    - `scrollToNode(nodeId)`
    - `showTestRunResult(executeId, subExecuteId)`
  - `sidebar` 属性被替换为本地定义的 `EmptySidebar`（[src/page.tsx](src/page.tsx) 中），以隐藏 playground 默认的侧边栏，实现“仅使用顶部工具栏添加节点”的 UI 形态。
- 只读模式：
  - `readonly` 由 `from === 'explore'` 推导，源于“流程探索模块”。AI 在新增入口来源时，若需要只读视图，应考虑在 `usePageParams` 或上层路由中新增对应 `from` 枚举，并在此处统一映射。
- 首次初始化逻辑：
  - `WorkflowPage` 使用 `initOnce` state 确保 `onInit` 回调中的副作用只执行一次（例如滚动到节点、展示执行结果），以防 playground 多次触发 `onInit` 导致重复操作。
  - 逻辑顺序为：
    1. 若存在 `setVersion && version`，优先调用 `resetToHistory` 回滚到指定版本；
    2. 若存在 `nodeId`，滚动到对应节点；
    3. 若存在 `executeId`，展示对应测试执行结果。
- 导航回退与发布：
  - [src/hooks/use-navigate-back.tsx](src/hooks/use-navigate-back.tsx)（通过 [src/hooks/index.ts](src/hooks/index.ts) 汇总导出）封装了 `navigateBack(workflowState, action)`，其中 `action` 为 `'exit' | 'publish'` 等。
  - `WorkflowPage` 在 `onBackClick` 和 `onPublish` 中分派不同的 `action`，由宿主应用决定如何切换路由/弹窗或刷新列表。

## 3. 目录结构与职责边界

- [src/index.tsx](src/index.tsx)
  - 子包对外唯一公开入口，目前仅 re-export `WorkflowPage`。
  - 若后续要新增导出（例如类型定义），建议统一从该文件聚合，保持公共 API 明确。
- [src/page.tsx](src/page.tsx)
  - 实际渲染工作流 Playground 的页面组件，实现所有与 playground 的交互细节。
  - 负责处理：
    - 参数读取结果与 props 的映射；
    - `onInit` 首次副作用；
    - 上下文来源（`from`）到只读模式的映射；
    - 回调函数中对导航 hook 的调用。
- [src/hooks](src/hooks)
  - `use-page-params.ts`：负责从 URL / 上下文中收集并标准化页面参数。
  - `use-navigate-back.tsx`：负责对“返回”与“发布后跳转”等行为的统一抽象。
  - `index.ts`：统一导出 hooks，便于其他文件引用时保持稳定路径。
- [__tests__](__tests__)
  - 当前仅有占位 [.gitkeep](__tests__/.gitkeep)，没有具体单测实现，新加测试文件时可直接使用 Vitest + React Testing Library 生态。
- [config](config)
  - 目前仅含 `rush-project.json`，用于与 monorepo 级 Rush 配置集成（例如自动发现包、统一版本管理等）。

## 4. 构建、测试与开发流程

- 本子包完全依赖 monorepo 级工具链（Rush、Vite、Vitest 等）。常用命令：
  - 安装依赖与联邦链接：在仓库根目录执行 `rush update`。
  - 单包测试：在本目录执行 `npm test`（等价于 `vitest --run --passWithNoTests`），可用 `npm run test:cov` 查看覆盖率。
  - Lint：`npm run lint`，实质调用 `eslint ./ --cache`，配置由 [eslint.config.js](eslint.config.js) 中的 `@coze-arch/eslint-config` 预设提供。
  - 构建：`npm run build` 目前为 `exit 0` 占位实现；在集成或完善打包流程时，需要同步更新此脚本并确保与 monorepo 通用规范兼容。
- 测试配置：
  - [vitest.config.ts](vitest.config.ts) 使用 `@coze-arch/vitest-config` 的 `defineConfig({ dirname: __dirname, preset: 'web' })`，意味着：
    - 测试默认运行在浏览器/DOM 环境，适配 React 组件测试；
    - 断言与快照等行为遵循统一预设，无需在本包重复配置。
- TypeScript 配置：
  - [tsconfig.json](tsconfig.json) 与 [tsconfig.build.json](tsconfig.build.json)、[tsconfig.misc.json](tsconfig.misc.json) 组合使用，通常继承 `@coze-arch/ts-config` 预设，确保：
    - 源码编译目标、模块解析方式与仓库中其他 web 子包保持一致；
    - 构建、测试与 IDE 类型检查共享统一的基础配置。

## 5. 项目约定与代码风格

- 通用规范：
  - Lint/格式化规则来源于 `@coze-arch/eslint-config` 与 `@coze-arch/stylelint-config`，不要在本子包中随意覆盖核心规则，仅在确有需要时通过 [eslint.config.js](eslint.config.js) 增量配置。
  - 所有新文件需添加 Apache-2.0 版权头，格式可参考 [src/page.tsx](src/page.tsx) 与 [vitest.config.ts](vitest.config.ts)。
- React 约定：
  - 使用 React 18 函数组件写法，返回类型一般显式标注为 `React.ReactNode`。
  - 通过 `React.forwardRef` 与外部组件交互时，应遵循类型定义（如 `AddNodeRef`），即使当前示例 `EmptySidebar` 返回 `null`，也保持类型签名完整。
  - 状态与副作用要尽量集中在页面级组件中，hook 负责对外部世界（路由、导航、宿主应用 API）的封装，保持 `WorkflowPage` 易于测试与复用。
- 参数/状态命名：
  - `spaceId`、`workflowId`、`executeId` 等字段是 workflow 域内统一命名，不要在新代码中更换为其他语义相同但命名不同的字段，以免与其他子包交互时混淆。
  - `from` 字段用于标识入口/来源场景，新增取值时需与其他 workflow 相关子包协商并更新对应路由与文档。

## 6. 外部依赖与集成细节

- Playground 依赖：
  - `@coze-workflow/playground` 提供：
    - UI 组件 `WorkflowPlayground`；
    - 类型定义 `WorkflowPlaygroundRef`、`AddNodeRef`；
    - 一系列对工作流节点/执行记录的操作方法（如 `resetToHistory`、`scrollToNode`、`showTestRunResult`）。
  - 本包仅在 UI 层封装这些能力，不负责数据持久化或网络请求，相关逻辑均由 playground 自身或更上层的服务承担。
- 基础架构依赖：
  - `@coze-workflow/base` 与 `@coze-arch/*` 系列包（`bot-error`、`bot-hooks`、`i18n`、`logger` 等）虽在 `dependencies` 中声明，但当前页面实现中尚未直接使用；
  - 在扩展功能（例如埋点、错误提示、国际化文案）时，应优先通过这些基础包提供的统一能力接入，而不是直接引入第三方库。
- UI 与状态库：
  - 虽然 `@coze-arch/coze-design`、`ahooks` 等依赖在本包中可用，但当前页面实现中尚未引用。
  - 如需构建复杂交互（例如浮层、多步骤表单），建议优先复用 coze-design 组件库与 ahooks 常用 hooks，以与其他前端子包保持风格一致。

## 7. 协作与变更注意事项

- 本子包处于 monorepo 的 workflow 体系中，任何对参数结构或回调行为的修改（例如新增 `from` 枚举、改变 `onPublish` 的调用时机）都极有可能影响其他包（如 `@coze-workflow/playground`、上层应用容器等）。
- 在改动下列内容前，请优先检索全仓库：
  - `usePageParams` 的返回字段签名；
  - `navigateBack` 的参数结构与调用方式；
  - `WorkflowPlayground` 的 props/回调接口。
- 对外 API：
  - 目前对外仅暴露 `WorkflowPage` 组件，如需新增导出，应评估是否作为通用能力被其他包复用，并在 README 或相关文档中更新说明。
- 部署与环境：
  - 最终打包、部署流程由上层应用控制，本子包只需保证在构建系统中能通过类型检查、lint 和单测（未来补齐）即可。
