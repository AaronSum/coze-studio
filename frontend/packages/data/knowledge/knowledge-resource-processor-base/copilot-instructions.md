# @coze-data/knowledge-resource-processor-base 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-resource-processor-base）中安全、高效地协作开发。

## 1. 子包定位与整体角色

- 本包为「知识库资源处理基础库」，对上层产品暴露统一的上传单元组件、进度展示组件、表格/文本重切片逻辑等能力。
- 属于前端 mono-repo 中的 workspace 子包，主要输出 React 组件、业务 Hooks、Zustand Store 工厂、工具方法和类型定义，不直接负责路由或页面挂载。
- 对外导出入口为 src/index.tsx，package.json 中通过 exports/typesVersions 精细化暴露：types、constants、utils、hooks、services、components、features、layout 等子入口。
- 依赖大量同仓 workspace 包（如 @coze-data/knowledge-*-*, @coze-arch/*，@coze-common/*），本包通常被其它上层 IDE/知识库模块组合使用，而非独立运行。

## 2. 目录结构与架构概览

核心目录（位于 src/）：
- index.tsx：本包主导出文件，仅导出少量稳定 API：分隔策略常量、上传流程工具函数、上传组件等（刻意限制导出以避免首屏加载重体积依赖）。
- types/：
  - 通用类型定义（text/table/process/components 等），描述上传单元、切片策略、重切片状态机等业务域模型。
  - features/knowledge-type/* 下的 slice/interface 会引用这里的基础类型。
- constants/：
  - 业务常量与配置，如 UNIT_MAX_MB、上传进度常量、知识类型相关配置等；
  - components、text、table 等子模块根据使用场景拆分。
- utils/：
  - common.ts：
    - transformUnitList：将后端返回的 UploadFileData 与前端 UnitItem 列表合并；
    - 文件读取工具（getBase64、getUint8Array）带错误上报与全局 Toast 提示；
    - 查询参数解析（useOptFromQuery/useDocIdFromQuery），依赖 @coze-data/knowledge-stores；
    - 轮询控制（isStopPolling/clearPolling/reportFailGetProgress/reportProcessDocumentFail）。
  - 其它 util 如 convert-filter-strategy-to-params、map-pdf-filter-config、validate-common-doc-next-step 等负责将可视化配置映射为请求参数或做表单校验。
- services/：
  - index.ts 目前只透出 useListDocumentReq/useCreateDocumentReq 等 hooks，具体实现放在 common.ts，封装与 @coze-arch/bot-api 的交互。
- hooks/：
  - 共用 UI/业务 hooks，例如获取路由态、轮询、进度文案等；
  - 对上暴露统一 index.ts，注意新增 hook 时保持树形依赖简单，避免循环引用。
- components/：
  - upload-unit-file/：文件级上传组件 UploadUnitFile，是本包最重要输出之一：
    - 包装 @coze-arch/coze-design 的 Upload 组件；
    - 使用 abortable/useUnmountSignal 保障卸载安全，避免内存泄漏；
    - 使用 KnowledgeE2e/I18n 抽离 e2e 标识与文案；
    - 通过 customRequest 与 before-upload 链路接入实际上传接口与文件大小校验；
    - 将 Upload fileList 映射为 UnitItem 列表（filterFileList/filterUnitList）。
  - upload-unit-table/：按上传单元展示进度列表 UploadUnitTable：
    - getColumns 回调注入列配置（subText/actions/formatType），保持与上层页面解耦；
    - 组合 ProcessProgressItem 与 getTypeIcon，统一视觉与 icon 映射；
    - 针对失败态强调 statusDesc 与 i18n 文案（datasets_unit_upload_fail）。
  - 其它组件：
    - process-progress-item：通用进度条+状态展示单元；
    - browser-url-modal：URL 采集/解析弹窗（包含 editor-toolbar/editor-context actions 注册文件）；
    - table-format：表格结构与预览组件；
    - empty/empty-auth/upload-footer/upload-navbar 等通用布局/空态组件。
- features/：
  - knowledge-type/
    - text/：
      - index.tsx 仅导出 validateSegmentRules/getCustomValues、createTextSlice/getDefaultTextState 及一组状态/动作类型与 PDF 配置类型；
      - 实现上通常使用 Zustand + Immer 管理文本上传/切片/重切片（ADD/RESEGMENT/INCREMENTAL）状态；
      - first-party/local/custom/add 等子目录按来源/模式再拆分具体流程步骤（steps）与 store。
    - table/：
      - index.tsx 导出 UploadTableState/UploadTableAction、多个以 use 前缀命名的 hooks（如 useFetchTableSchemaInfo、useAddSegment 等）；
      - utils/slice/hooks 内部负责表格 schema 拉取、语义配置校验（semanticValidator）、创建/重切片参数组装等；
      - first-party/local/custom 目录与 text 类似，覆盖新增、增量、第三方表格等路径。
    - image/：
      - file/ 下包含步骤式流程（upload/annotation/process 等），以步骤组件+store 形式组织。
  - resegment/：
    - 区分 text/table 两条 resegment 链路；
    - steps/ 下以 configuration/processing/preview/segment 等 Step 组件组合成流程；
    - store/ 下 slice + store + types 描述重切片向导的状态机。
  - segment-strategys/：
    - document-parse-strategy：解析策略（quick-parsing/precision-parsing），含 PDF 过滤器配置表单；
    - segment-strategy：切分策略（automatic-cleaning/custom 等），为上层知识类型提供统一策略定义与 UI。
  - segment-config/：
    - base/text-local 等，用于配置某知识类型的分段规则/策略选项。
  - upload-task-list/：
    - text-local/image-local/table-local 等本地上传任务列表视图。
- layout/：
  - base/index.tsx：基础布局容器，通常用于在上层包中组合 features 与 components。
- assets/：
  - less 样式与提示图片，用于切片层级/保留标题等说明提示。

整体架构上，本包以「领域模型 + 组件 + Hook + Store」分层：
- 领域模型与类型定义收敛在 types 与 features/*/interface.ts；
- 状态管理以 per-feature slice + store 为核心，遵循最小导出原则（上层只拿工厂和类型，不直接操作内部实现）；
- UI 组件尽量无业务逻辑，仅通过 props 回调与上层调度；
- API 调用、埋点、轮询等副作用集中在 utils/services/hooks 中，便于统一调整与测试。

## 3. 构建、测试与开发工作流

### 3.1 子包级命令

在仓库根目录：
- 初始化依赖：rush update
- 进入子包目录：frontend/packages/data/knowledge/knowledge-resource-processor-base

package.json 中脚本：
- 构建：npm run build
  - 当前实现为 "build": "exit 0"，即占位构建脚本，不会真正产出 bundle，本包主要通过 ts 编译与上层应用的构建流程参与打包。
- 测试：npm run test
  - 使用 vitest --run --passWithNoTests；
  - 若新增逻辑较重，建议在本包添加针对关键 hooks/utils/components 的 vitest 单测或 React Testing Library 测试。
- 覆盖率：npm run test:cov
  - 在 test 基础上加 --coverage，配置来源于 workspace 公共 @coze-arch/vitest-config。
- Lint：npm run lint
  - 使用 @coze-arch/eslint-config 和 @coze-arch/stylelint-config 统一规则；
  - 遇到 lint 错误优先按仓库约定修复，而非关闭规则。

### 3.2 上层集成与 Storybook

- README 中提到 dev: npm run dev，但当前 package.json 未定义 dev 脚本，真实运行 Storybook/示例需参考 frontend 目录下统一脚手架（如 apps/* 或 scripts/* 中的配置）。
- 本包本身不提供独立 Storybook 配置，而是通过 workspace 层统一收敛，从而复用设计系统与 mock 服务。

## 4. 项目约定与编码风格

### 4.1 导出策略

- 根入口 src/index.tsx 只导出少量稳定 API（常量、基础组件与工具函数），并显式禁止导出 getUploadConfig 等会引入重型依赖的函数，以减少首屏 bundle 体积：
  - 通过文件顶部注释说明禁止直接导出 getUploadConfig，避免加载 pdf.js 等第三方库。
- 其他能力通过 package.json 的子路径 exports 暴露：
  - @coze-data/knowledge-resource-processor-base/types
  - @coze-data/knowledge-resource-processor-base/constants
  - @coze-data/knowledge-resource-processor-base/utils
  - @coze-data/knowledge-resource-processor-base/hooks
  - @coze-data/knowledge-resource-processor-base/services
  - @coze-data/knowledge-resource-processor-base/components
  - @coze-data/knowledge-resource-processor-base/features/*
  - @coze-data/knowledge-resource-processor-base/layout/*
- 新增模块时应考虑：
  - 是否需要对外暴露？若是，优先通过子入口暴露，避免 root index.tsx 无限膨胀；
  - 类型导出与运行时代码导出应保持路径对齐，方便消费方按路径补全与 tree-shaking。

### 4.2 命名与模式

- Hook：统一 useXxx 命名，避免在 components 目录下直接定义业务 Hook，应优先放入 hooks 或 features/*/hooks.ts。
- Slice/Store：
  - createXxxSlice/getDefaultXxxState 命名搭配，用于创建 Zustand slice 与默认 state；
  - interface.ts 中定义 XxxState/XxxAction/XxxStore 类型，加上特定子流程的 Action/State 类型（如 TextCustomResegmentState）。
- 组件：
  - 以业务能力命名而非 UI 细节命名，例如 UploadUnitFile、UploadUnitTable、ProcessProgressItem；
  - 尽量通过 props 提供注入点而不是在组件内部访问全局 store。
- 常量：
  - 使用全大写下划线分隔，如 UNIT_MAX_MB、SUCCESSFUL_UPLOAD_PROGRESS。
- 工具函数：
  - 以动词开头，表达清晰副作用或用途，如 transformUnitList/getProcessingDescMsg/isStopPolling/isIncremental。

### 4.3 错误处理与埋点

- 统一使用 @coze-arch/bot-error 的 CustomError 包装异常，并通过 @coze-data/reporter 上报：
  - reportFailGetProgress/reportProcessDocumentFail 在拉取进度/处理文档失败时上报 KNOWLEDGE 域事件；
  - 错误 meta 中通常包含 failIds/failDocumentIds，便于后端排查。
- 用户可见错误通过 Toast（@coze-arch/coze-design）提示，并使用 I18n.t() 获取多语言文案。
- 轮询/长任务：
  - isStopPolling 用于判断是否结束进度轮询（上传成功或失败）；
  - clearPolling 需在组件卸载或状态完成时主动调用，避免残留定时器。

### 4.4 国际化与测试标记

- 所有用户可见文本需要通过 I18n.t(key, params) 获取，避免硬编码中文/英文。
- 关键节点添加 KnowledgeE2e 常量作为 data-testid 或数据标记，便于 e2e 测试稳定识别：
  - 如 UploadUnitFile/UploadUnitTable 内的 data-testid 拼装规则。

### 4.5 样式

- 使用 Less Modules（*.module.less）按组件粒度拆分样式；
- className 通常通过 classNames 组合，避免字符串拼接；
- 不要在业务逻辑中直接依赖具体 className 字符串，应从样式模块引入。

## 5. 与外部依赖的集成要点

### 5.1 知识库 & 上传核心

- @coze-data/knowledge-resource-processor-core：
  - 定义 UnitItem、UploadStatus、OptType、UnitType 等核心实体与枚举；
  - 本包中的 transformUnitList/isIncremental/isThirdResegment 等逻辑需要与该核心包保持一致，一旦核心枚举变更，本包需同步调整。
- @coze-data/knowledge-stores：
  - useKnowledgeParams 提供带业务约定的查询参数（如 opt/docID），扩展时不要绕过该 Hook 直接读 URL。
- @coze-arch/bot-api/knowledge 与 developer_api：
  - DocumentInfo/DocumentProgress/UploadFileData 等类型定义后端协议；
  - 所有新建/重切片/上传接口封装应放在 services/common.ts，并对外通过 services/index.ts 暴露 Hook API。

### 5.2 UI & 设计系统

- @coze-arch/coze-design：
  - 使用其中的 Upload、Toast 以及 Icon 系列，保证交互与视觉一致；
  - 不要直接使用第三方组件库，而应通过 coze-design 包装版本。
- @douyinfe/semi-illustrations & semi-icons：
  - 作为补充插画/图标能力使用（如 UploadUnitFile 中成功 illustration）。

### 5.3 状态与工具库

- Zustand：
  - 通过 createXxxSlice 工厂模式构建 slice，避免在组件中直接使用 create() 定义 store；
  - 若需要跨 feature 共享状态，应交由上层 knowledge-stores 或其它更高层 store 管理。
- lodash-es：
  - 仅按需引入（如 get），避免一次性导入全部。
- @coze-data/utils：
  - 使用 abortable/useUnmountSignal 等工具安全处理异步；
  - 新增异步逻辑时尽量复用上述工具，减少重复封装。

## 6. 开发流程与协作规范

> 本节描述的是从本仓已有实践中推导出的惯例，而非新规则。

- Git 分支与提交：
  - 仓库整体遵循 Rush monorepo 流程，具体分支命名规范参考根仓库文档（本包内部无额外特殊约定）。
  - 在本包内修改时，优先保持变更局部化，避免无关文件格式化/重排。
- 类型优先：
  - 先在 types 或 features/*/interface.ts 中补齐类型，再实现逻辑；
  - 对外导出的 API 尽量以类型为主，再辅以工厂函数/组件，方便其它包消费。
- 依赖管理：
  - 新增跨包依赖优先使用 workspace:* 版本号，与仓库整体版本管理保持一致；
  - 若需要直接引入第三方库（如 dnd-kit、react-pdf），参考现有依赖版本，避免多版本并存。

## 7. 对 AI 助手的具体建议

- 修改/新增对外导出时：
  - 同步更新 package.json 的 exports 与 typesVersions，并确保 src/index.tsx 或对应子入口文件有明确导出；
  - 避免在根入口直接 re-export 重型依赖模块。
- 新增上传/切片相关组件时：
  - 优先复用现有 UnitItem 模型与 UploadUnitFile/UploadUnitTable 组合模式；
  - 进度/错误展示统一通过 ProcessProgressItem 与 I18n/Toast 完成。
- 扩展重切片流程时：
  - 在 features/resegment/* 下新增步骤组件与 store，保持 steps + store + utils 组织方式；
  - 确保 isStopPolling/clearPolling 等基础逻辑仍被正确调用。
- 所有新增用户可见文案必须通过 I18n.t；
- 任何新增长时间/异步操作应考虑：
  - 组件卸载安全（使用 abortable/useUnmountSignal）；
  - 完成条件与轮询终止条件是否明确；
  - 是否需要埋点上报失败情况（参考 reportFailGetProgress/reportProcessDocumentFail）。
