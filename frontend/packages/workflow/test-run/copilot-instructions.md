# @coze-workflow/test-run 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/test-run）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包是 Coze Studio workflow 体系中的「测试运行 / 调试」子模块，主要面向工作流节点的试运行、输入构造、日志与问题展示，不负责全局编排和路由，这些由 @coze-workflow/base 等上层包处理。
- 对外 API 统一从 src/index.ts 导出，按功能区分为：通用 UI 组件（FormPanelLayout、Testset* 等）、特性面板（ProblemPanel、NodeStatusBar、LogImages 等）、插件与服务（createTestRunPlugin、TestRunService、TestRunReporterService）、工具与类型（Tracker、typeSafeJSONParse、WorkflowLinkLogData 等）。
- 目录按「UI 组件 / 业务特性 / 插件服务 / 辅助工具」划分：
  - src/components：可复用 UI 与表单相关组件（form-engine、form-materials、testset、log-detail、collapse、resizable-panel 等），强调与 workflow 领域抽象配合。
  - src/features：面向完整业务场景的功能模块，目前包含 question（提问表单）、input（输入节点表单与文件选择）、log（执行日志与状态条）、problem（问题面板）。
  - src/plugins：test-run-plugin 目录提供测试运行整体能力，包括 TestRunService、ReporterService 以及 createTestRunPlugin，用于被 workflow 主应用注册为插件。
  - src/hooks：与 test-run 体验强相关的通用 hooks，如 useDocumentContentChange、useTestRunService、useTestRunReporterService、useFormSubmitting。
  - src/utils：通用工具（如 tracker、JSON 解析、测试数据处理），保持无 UI 依赖，便于在服务与 hooks 中复用。
  - src/constants、src/types、src/formily.ts：集中描述领域常量（如 TESTSET_BOT_NAME、FieldName）、表单 schema 类型与 Formily 相关桥接。
- 数据流总体模式：调用方（workflow 编辑器 / 运行视图）通过插件暴露的服务发起测试运行，请求经 TestRunService 下发到后端机器人 / 工作流执行 API，过程产生的事件与日志由 TestRunReporterService 汇总，再通过 React 组件（ProblemPanel、LogDetail、NodeStatusBar 等）与 stores/hooks 呈现到 UI。
- 组件间合作遵循「服务 + store + 纯展示组件」分层：复杂业务状态尽量放在 service/store 中，组件仅订阅状态并渲染，避免在 UI 内直接持久化跨组件状态。

## 开发与构建流程
- 本包由 Rush 管理，依赖通过 monorepo 根目录统一安装：
  - 首次开发：在仓库根目录执行 rush update，随后可在 frontend 子树内使用脚本（如 scripts/setup_fe.sh）初始化前端环境。
  - 单独引入本包到其他子包时，仅需在对方 package.json 中声明 "@coze-workflow/test-run": "workspace:*"，再运行 rush update 即可建立 workspace 软链接。
- 本包自身的 package.json 中脚本：
  - build：当前实现为 exit 0，实际产物通常由上层构建系统（如统一的 bundler / tsup / vite）在 workspace 级别统一处理；不要在这里加复杂构建逻辑。
  - lint：eslint ./ --cache，使用 monorepo 提供的 @coze-arch/eslint-config，建议在提交前运行，以保持风格一致。
  - test / test:cov：目前同样为 exit 0，本包暂无独立测试执行脚本，如果需要测试，请接入上层统一测试框架（如 Vitest）并在统一位置配置，而不要在本包单独绕开。
- TypeScript 配置：
  - tsconfig.json 与 tsconfig.build.json、tsconfig.misc.json 配合使用，基础配置来自 @coze-arch/ts-config；新增路径映射或严格性调整时，保持与 workspace 统一风格，不要脱离共用 preset。
  - 导出入口通过 package.json 的 exports 与 typesVersions 对齐，新增公共导出时，务必同时更新 src/index.ts 与 package.json 中的 exports / typesVersions，避免类型与运行时路径不一致。

## 代码风格与项目特有约定
- 语言与技术栈：React 18、TypeScript 5、Zustand 状态管理、@formily/react 表单引擎、react-query 进行异步数据 / 请求状态管理。
- 组件划分约定：
  - src/components 偏向「可在多个 features 之间复用的 UI/表单构件」，要求尽量无副作用，业务逻辑通过 props、回调以及外部 store/service 注入。
  - src/features 是「面向具体业务任务的组合」，可以依赖多个 components、hooks、services，并处理跨组件协调逻辑（比如问题面板 ProblemPanel 聚合多个错误来源）。
  - 引入新能力时，优先在 features 创建场景层，再在 components 中提炼可通用的子组件，避免把高度定制代码直接放入 components 根目录。
- 命名与导出：
  - 公共组件要求有清晰、领域相关的命名（例如 TestsetManageProvider、TestsetSelect、InputFormEmpty），严禁使用模糊名如 CommonPanelX。
  - 所有对外可用实体必须经由 src/index.ts 集中导出；内部使用的私有实现只在各自 feature / component 子目录内导出，避免被误用。
  - 类型导出单独加上 type 前缀（type TestsetSelectProps 等），保持与 monorepo 其它子包一致的显示 type-only export 风格。
- 样式与 UI：
  - UI 基础组件和布局通常依赖 @coze-arch/coze-design 以及 @coze-workflow/components 等库，新增视图时优先复用这些基础组件，而不是手写样式。
  - 文件图标、状态色、布局比例等尽量与现有 FileIcon、FileItemStatus、FormPanelLayout 等保持一致，如需新增变体，优先在原组件扩展 props，而不是新建重复组件。
- 表单与校验：
  - 统一通过 Formily （@formily/core、@formily/react）搭建复杂表单，formily.ts 提供项目级配置与桥接；新增复杂表单场景时应优先复用 LazyFormCore、form-materials 下的现有字段组件。
  - 校验与 schema 类型统一集中在 src/constants、src/types 或各 feature 内的 types.ts，不要在组件内部随意硬编码 schema 定义。

## 插件与服务集成细节
- Test Run 插件入口：
  - src/plugins/test-run-plugin/index.ts 是统一导出中心，暴露 TestRunService、TestRunReporterService、createTestRunPlugin 与 useTestFormService。
  - createTestRunPlugin：用于在 workflow 宿主应用内注册测试运行能力，一般会被上层插件系统调用；新增能力时，如果需要对外暴露配置项，应在此处扩展统一的插件创建参数，而非在业务页面直接 new Service。
- TestRunService：
  - 负责发起、管理单次或多次测试运行请求，处理输入数据、变量替换等逻辑；通常会依赖 @coze-workflow/base、@coze-workflow/nodes、@coze-workflow/variable 以及 @coze-arch/bot-api 等基础包，与后端通讯协议保持一致。
  - 任何与「调用工作流运行 / 机器人执行」相关的逻辑，应优先放入此 service，而不是散落在组件或 hooks 中；组件仅通过 hooks/useTestRunService 访问封装后的 API。
- TestRunReporterService：
  - 负责接收来自后端或运行时的事件（成功、失败、日志、trace、问题等），转换成前端易用的 ReporterParams，并向 UI 层推送。
  - ReporterEventName、PickReporterParams、ReporterParams 等类型定义在同目录下，扩展事件类型时务必同时更新这些类型与对应的处理逻辑，保证事件枚举与 payload 对齐。
- useTestFormService：
  - 为表单相关特性提供访问 TestRunService / ReporterService 的统一 hook，使表单组件可以在不关心底层实现细节的前提下提交测试、响应事件。
  - 新增表单型 feature 时，优先复用该 hook，而非直接依赖服务实例。
- 日志与问题面板集成：
  - src/features/log 暴露 NodeStatusBar、LogImages 等组件，用于展示节点状态与相关图片日志；这些组件假设上游已经通过 TestRunReporterService 提供结构化日志数据。
  - src/features/problem 提供 ProblemPanel，用于聚合和展示问题；扩展问题类型时，应在其内部 types.ts、constants 和 utils 中扩展映射逻辑，而不是在外部直接向组件传入不同 shape 的数据。

## 常用 Hook 与状态管理模式
- useDocumentContentChange：
  - 提供对文档内容变化的监听，用于在输入编辑器 / markdown 编辑器场景中触发测试刷新、保存提示等；调用方需保证传入的内容源是可控、可比较的（如受控组件 state 或 store 中的值）。
- useTestRunService / useTestRunReporterService：
  - 通过内部容器 / store 提供单例或作用域化的 service 引用；不要在组件中直接 new Service，而是始终通过这些 hooks 获取实例，以便未来在 DI / 生命周期上做统一管理。
- useFormSubmitting：
  - 封装表单提交流程的加载状态、错误处理等，建议用于所有复杂表单提交流程，避免在每个组件中重复写 loading / try-catch。
- Zustand 与 React-Query：
  - 本包可使用 zustand 维护局部全局状态（例如测试数据缓存、问题列表等），并配合 react-query 管理异步获取与缓存；请遵循「react-query 负责 server state，zustand 负责 UI 协调与 session 级别 client state」的分工。

## 外部依赖与适配
- 与工作流体系其它包的集成：
  - 通过 @coze-workflow/base、@coze-workflow/components、@coze-workflow/nodes、@coze-workflow/variable 获取节点元数据、变量定义与通用 UI；在新增功能时，优先寻找是否已有对应能力，而不是在本包重复造轮子。
  - 与 @flowgram-adapter/* 系列包协作，以适配具体编辑器或 free-layout-editor 的交互；不要在本包硬编码编辑器实现细节，而是通过这些 adapter 间接集成。
- 与机器人 / 后端的协议：
  - 通过 @coze-arch/bot-api、@coze-arch/bot-error、@coze-arch/bot-flags、@coze-arch/report-events、@coze-arch/logger 等包完成网络请求、错误处理、埋点上报；本包不直接处理低层 HTTP 细节。
  - 与 Markdown / 富文本相关的展示能力通常依赖 @coze-common/md-editor-adapter、@coze-arch/bot-md-box-adapter、remark-parse、unified 等库，新增渲染路径时要注意性能与首屏体积（例如 trace 相关功能目前刻意不在根入口暴露，以避免 visactor 等重量依赖首屏加载）。

## 协作流程与注意事项
- 分支与提交：
  - 遵循 monorepo 统一的分支策略（通常为 feature/*、fix/* 等），变更 test-run 包时建议在提交信息中明确前缀，如 "workflow-test-run: ..."，便于后续回溯。
  - 修改公共导出（src/index.ts 或 plugins/test-run-plugin）时，务必确认不会破坏其他子包的现有调用；可通过在依赖方简单搜索 import '@coze-workflow/test-run' 检查影响范围。
- 变更范围控制：
  - 在本包内改动时，优先将影响限制在局部 feature / component 目录内，不要跨目录大范围重构，除非有明确需求；如果需要跨目录调整，先在 copilot-instructions 或 README 内补充约定，再执行迁移。
  - 引入新外部依赖前，确认 monorepo 其它包是否已经使用相同依赖版本，尽量保持版本一致，避免 workspace 冲突。
- 性能与首屏加载：
  - 由于 test-run 可能出现在工作流编辑器的首屏区域，需谨慎引入大体积三方库（尤其是图形、可视化相关的，如注释中提到的 visactor）；如果必须使用，考虑按需动态加载，并避免从根入口直接 re-export。

## 为 AI 助手的具体操作建议
- 修改或新增导出时：
  - 同时更新 src/index.ts 与 package.json 的 exports / typesVersions，保持类型与运行时路径一致；如涉及插件，再同步更新 src/plugins/test-run-plugin/index.ts。
- 扩展某个特性（如 ProblemPanel 或日志展示）时：
  - 优先在对应 feature 目录下添加 types/constants/utils，再更新 index.ts 聚合导出，最后在 src/index.ts 暴露新的 React 组件或工具函数。
- 新增业务场景时：
  - 如果是测试运行相关的新 UI 面板或流程，创建新的 feature 子目录，并通过服务 / hooks 与现有 TestRunService/TestRunReporterService 集成，而非重复实现运行逻辑。
- 自动重构或大规模格式化前：
  - 避免跨包修改；如果仅在本包内重构，需确保 lint 通过且不改变对外导出的签名或语义。
