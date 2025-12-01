# 本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/history）中安全、高效地协作开发。

本包为工作流编辑器提供撤销/重做历史栈、快捷键接入和操作上报能力，是 free-layout-editor 能力在 Coze 工作流域内的适配层。

## 全局架构
- 入口 [src/index.ts](frontend/packages/workflow/history/src/index.ts#L1-L25) 只做导出聚合：
  - 暴露 `WorkflowHistoryContainerModule`、`useClearHistory`、`WorkflowHistoryConfig`、`createOperationReportPlugin` 等本包定义的能力；
  - 透传 `HistoryService`、`createFreeHistoryPlugin`，实际实现来自 `@flowgram-adapter/free-layout-editor`，本包不实现底层历史栈，只做组合与集成。
- DI 容器模块 [workflow-history-container-module.ts](frontend/packages/workflow/history/src/workflow-history-container-module.ts#L17-L35)：
  - 通过 `bindContributions`（来自 `@flowgram-adapter/common`）将 `WorkflowHistoryShortcutsContribution` 注册为 `@coze-workflow/render` 的 `WorkflowShortcutsContribution` 扩展；
  - 同样方式将 `WorklfowHistoryOperationsContribution` 注册为 `OperationContribution` 扩展到 free-layout-editor；
  - 将 `WorkflowHistoryConfig` 绑定为单例配置对象，控制是否禁用历史能力。
- 历史相关“操作元信息”集中在 [src/operation-metas](frontend/packages/workflow/history/src/operation-metas/index.ts#L17-L25)，目前只定义 `addNode` / `addLine` 两类操作，对应 add/delete 反向操作、apply 逻辑和合并策略 `shouldMerge`；
- 快捷键集成在 [workflow-history-shortcuts-contribution.ts](frontend/packages/workflow/history/src/workflow-history-shortcuts-contribution.ts#L17-L78)：对 `WorkflowCommands.UNDO/REDO` 注册快捷键和执行逻辑；
- 操作上报能力由 [services/workflow-operation-report-service.ts](frontend/packages/workflow/history/src/services/workflow-operation-report-service.ts#L17-L135) 实现，再通过 [create-operation-report-plugin.ts](frontend/packages/workflow/history/src/create-operation-report-plugin.ts#L17-L39) 以插件形式接入 free-layout-editor；
- 配置类 [workflow-history-config.ts](frontend/packages/workflow/history/src/workflow-history-config.ts#L17-L22) 目前只有 `disabled` 字段，作为运行时开关，可被其他模块注入后控制是否响应快捷键和上报。

## 关键构建 / 测试 / 调试流程
- 依赖安装与通用流程同前端 monorepo，需在仓库根目录按 [frontend/README.md](frontend/README.md#L47-L78) 所述执行：
  - `rush install` / `rush update` 管理 workspace:* 依赖；
- 本子包自身 `package.json` 中脚本较精简（见 [package.json](frontend/packages/workflow/history/package.json#L1-L39)）：
  - `build`: `exit 0`，不会产出构建结果，本包不负责打包，只参与类型检查和运行时；
  - `lint`: `eslint ./ --cache`，通常通过 `rushx lint` 从根目录调用。
- Rush 额外配置放在 [config/rush-project.json](frontend/packages/workflow/history/config/rush-project.json#L1-L8)：
  - 定义 `ts-check` operation，输出目录为 `./dist`，用于 Rush pipeline 中的 TS 编译检查；
  - 在 CI 或本地想进行类型检查时，可通过 Rush 统一命令触发（例如 `rushx ts-check`，具体命令以根配置为准）。
- TypeScript 构建配置：
  - 顶层 [tsconfig.json](frontend/packages/workflow/history/tsconfig.json#L1-L11) 只声明 composite 与 references，并 `exclude` 所有文件，实际编译分别由 `tsconfig.build.json` 与 `tsconfig.misc.json` 驱动；
  - [tsconfig.build.json](frontend/packages/workflow/history/tsconfig.build.json#L1-L43) 负责编译 `src` 到 `dist`，继承 `@coze-arch/ts-config/tsconfig.web.json`，并通过 `references` 显式依赖 bot-flags、bot-typings、workflow/base、flowgram-adapter 等；
  - [tsconfig.misc.json](frontend/packages/workflow/history/tsconfig.misc.json#L1-L22) 主要覆盖 `__tests__` 与 `vitest.config.ts` 等非产出文件，保持编辑器类型提示一致。
- 当前包内未配置 Vitest，也没有 `test` 脚本，调试代码时通常依赖消费侧应用（如 workflow playground）加载本包，在浏览器或上层调试器里观察行为；历史栈行为可通过快捷键和日志验证（见下文“上报服务”）。

## 项目约定与模式
- 依赖注入：统一使用 Inversify：
  - `WorkflowHistoryContainerModule` 中通过 `new ContainerModule(bind => { ... })` 注册绑定；
  - `WorkflowHistoryShortcutsContribution`、`WorklfowHistoryOperationsContribution`、`WorkflowOperationReportService` 都用 `@injectable()` 装饰 + `@inject()` 字段注入（参见对应源码文件）。
- 扩展点注册模式：
  - 与 free-layout-editor 交互时，总是通过接口类型 `OperationContribution`、`OperationRegistry` 和 `OperationMeta`，不直接操作内部实现；
  - 新增历史相关操作时，需要在 [operation-metas/index.ts](frontend/packages/workflow/history/src/operation-metas/index.ts#L17-L25) 将 meta 加入 `operationMetas` 数组，再保证 `WorklfowHistoryOperationsContribution` 会统一注册；
  - 快捷键扩展依托 [@coze-workflow/render](frontend/packages/workflow/render) 提供的 `WorkflowShortcutsRegistry`，遵循 `commandId + shortcuts + isEnabled + execute` 的模式。
- 历史合并策略：
  - 共享工具 [utils/should-merge.ts](frontend/packages/workflow/history/src/utils/should-merge.ts#L17-L20) 会在 500ms 内将相同元素上的多次操作合并到一个历史记录中，避免频繁编辑导致历史栈爆炸；
  - 所有新加的 `OperationMeta` 建议复用该 `shouldMerge`，除非确有不同分组需求。
- 代码风格：
  - ESLint 配置在 [eslint.config.js](frontend/packages/workflow/history/eslint.config.js#L1-L9) 继承 `@coze-arch/eslint-config` `web` 预设，仅显式关闭 `import/no-duplicates`，其他规则遵循全局规范；
  - `sideEffects` 在 [package.json](frontend/packages/workflow/history/package.json#L5-L10) 中声明了样式文件，确保构建 tree-shaking 时不会误删样式相关 import（尽管当前包本身未包含样式文件，这一约定与 workflow 系列其它包保持一致）。

## 关键集成点与外部依赖
- `@flowgram-adapter/free-layout-editor`：
  - 提供 `HistoryService`、`OperationService`、`OperationMeta`、`WorkflowDocument`、`WorkflowLinesManager`、`FreeOperationType`、`definePluginCreator` 等核心类型与服务；
  - 历史操作（例如 [add-node](frontend/packages/workflow/history/src/operation-metas/add-node.ts#L17-L48)、[add-line](frontend/packages/workflow/history/src/operation-metas/add-line.ts#L17-L52)）全部通过该包暴露的 `PluginContext` 和文档对象进行；
  - 插件 [create-operation-report-plugin.ts](frontend/packages/workflow/history/src/create-operation-report-plugin.ts#L17-L39) 也是用其 `definePluginCreator` 包装，注入/初始化/销毁 `WorkflowOperationReportService`。
- `@flowgram-adapter/common`：
  - 提供 `bindContributions`、`DisposableCollection`、`Operation` 等基础工具（见 [workflow-history-container-module.ts](frontend/packages/workflow/history/src/workflow-history-container-module.ts#L17-L35)、[workflow-operation-report-service.ts](frontend/packages/workflow/history/src/services/workflow-operation-report-service.ts#L25-L37)）；
  - 历史钩子 [use-clear-history.ts](frontend/packages/workflow/history/src/hooks/use-clear-history.ts#L17-L38) 通过 `useService<HistoryService>` 获取统一的 `HistoryService` 实例。
- `@coze-workflow/render`：
  - 提供 `WorkflowShortcutsContribution`、`WorkflowShortcutsRegistry` 和 `WorkflowCommands` 等抽象，历史快捷键注册完全基于该接口（参见 [workflow-history-shortcuts-contribution.ts](frontend/packages/workflow/history/src/workflow-history-shortcuts-contribution.ts#L17-L78)）。
- `@coze-workflow/base`：
  - 暴露 `reporter`，用于日志与监控上报；
  - 在快捷键执行时记录 `workflow_undo`/`workflow_redo`（同一文件），在 [workflow-operation-report-service.ts](frontend/packages/workflow/history/src/services/workflow-operation-report-service.ts#L66-L105) 中对每次操作生成 `workflow_*` 事件名，并根据操作类型填充详细信息。
- 第三方库：
  - `inversify`：DI 容器；
  - `lodash-es`：`cloneDeep` 与 `snakeCase` 用于操作复制和事件名归一化。

## 过程规范与协作
- Git 流程、PR 规范与提交信息约定遵循仓库根目录的 [CONTRIBUTING.md](CONTRIBUTING.md#L1-L41)：
  - 使用 git-flow/FDD 分支模型；
  - 提交信息遵循 Angular 风格，便于自动生成 Release Notes。
- 修改本包时建议的最小验证流程：
  - 在仓库根目录执行 `rushx lint --to @coze-workflow/history`（或等价命令）确保 ESLint 通过；
  - 在加载该包的上层应用中（例如 workflow playground、agent-ide workflow）实际触发新增/修改的历史操作，观察撤销/重做行为及控制台上报是否符合预期。
- 与其它 workflow 包的依赖关系：
  - [tsconfig.build.json](frontend/packages/workflow/history/tsconfig.build.json#L17-L41) 中显式依赖 `@coze-workflow/base`、`@coze-workflow/render`、`@flowgram-adapter/*`，保证 TS 项目引用顺序；
  - 调整这些依赖或引入新 adapter 包时，要同步更新 `tsconfig.build.json` 的 `references`，避免 Rush 的 `tsc --build` 出现依赖顺序问题。

## 特殊 / 区别性特征
- 本包不产生构建产物：`build` 只是 `exit 0`（见 [package.json](frontend/packages/workflow/history/package.json#L13-L15)），因此：
  - 类型检查与增量构建完全依赖 Rush 的 `ts-check` 和上层应用构建；
  - 不要在 CI 中直接依赖本包的 `dist` 输出。
- 历史合并策略通过 `shouldMerge` 使用 `Date.now()` 做简单时间窗口判断（500ms 内合并），与 free-layout-editor 自身历史实现耦合较松；
  - 如果需要对某类操作改变合并窗口，需要在 [should-merge.ts](frontend/packages/workflow/history/src/utils/should-merge.ts#L17-L20) 内统一调整，而不是在单个 `OperationMeta` 中硬编码。
- 操作上报有防抖逻辑：
  - `WorkflowOperationReportService` 在 `shouldReport` 中缓存 `lastOperation`，对同一节点同一路径的连续 `changeNodeData`/`changeFormValues` 只上报一次（见同文件第 114–131 行），以降低埋点噪音；
  - 新增需要上报的 `FreeOperationType` 时务必同时更新 `getMessageByOperation`，否则会退化为只上报事件名。
- 为了保证所有快捷键与历史行为可被整体关闭，新增的历史相关逻辑应尽量通过 `WorkflowHistoryConfig.disabled` 或 DI 进行控制，而不是在各处直接判断业务状态。