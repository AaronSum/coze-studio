# @coze-data/knowledge-stores 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/common/stores）中安全、高效地协作开发。

## 总览与架构

- 本包提供围绕「知识库」场景的前端状态管理能力，基于 zustand 创建多个 store，并通过 React Context 与自定义 hooks 对外暴露统一接口。
- 入口文件为 src/index.ts，对外导出 hooks（useKnowledgeStore、useProcessingStore、useKnowledgeParams 等）、Context Provider（KnowledgeParamsStoreProvider）、以及若干 slice 创建函数和类型。
- 状态按功能拆分为多个模块：
  - params-store.ts：知识页路由/查询参数及 Widget UI 状态；
  - processing-knowledge.ts：知识处理（导入/解析等）相关进度与结果；
  - knowledge-preview.ts：知识预览过滤、图片/表格等资源展示状态；
  - level-segments-slice.ts：层级/段落切分相关的状态切片（slice）；
  - storage-strategy-slice.ts：知识存储策略（如分层、增量等）相关的状态切片；
  - hooks.ts、context.tsx：统一封装各类 store 的访问与订阅方式。
- store 构建统一依赖 zustand 及其中间件（devtools、subscribeWithSelector、shallow 等），在开发环境便于调试，在消费端通过 hooks 使用，避免直接接触底层 store 实现。

## 源码结构说明

- src/index.ts：
  - 作为唯一对外 API 聚合点，新增导出时应在此集中维护，确保其他包通过 @coze-data/knowledge-stores 访问时有稳定入口。
- src/context.tsx：
  - 定义 KnowledgeParamsStoreContext 与 Provider，负责注入 params 相关的 zustand store；
  - 为消费端提供 React Context 语义，避免在组件树中显式传递 store 实例。
- src/hooks.ts：
  - 基于 useStoreWithEqualityFn + shallow 封装对各 store 的访问；
  - 典型模式：从对应的 zustand store 中选取子状态或回调函数，并保证订阅粒度尽可能细，减少重渲染；
  - 对外只暴露高层语义的 hooks（如 useKnowledgeStore、useProcessingStore、useKnowledgeParams、useDataCallbacks、useDataNavigate 等），调用方不关心内部 store 结构。
- src/params-store.ts：
  - 使用 create + subscribeWithSelector + devtools 创建 params store；
  - 管理路由/查询参数、当前知识库 id、选中资源、Widget UI 状态等；
  - 导出 IParams（在 index.ts 中别名为 IKnowledgeParams）便于跨包复用类型。
- src/processing-knowledge.ts：
  - 创建与知识处理流程相关的 store，例如处理队列、当前进行中的任务、错误信息等；
  - 一般由导入/解析流程驱动更新，UI 通过 useProcessingStore 订阅。
- src/knowledge-preview.ts：
  - 负责知识预览视图的数据与 UI 状态，例如 FilterPhotoType、预览模式、当前图片/表格详情等；
  - 典型使用场景是图片/表格列表与详情面板联动显示。
- src/level-segments-slice.ts：
  - 提供 getDefaultLevelSegmentsState 与 createLevelSegmentsSlice 等函数，用于在组合 store 时注入层级/段落切分相关子状态；
  - 通过 ILevelSegmentsSlice、ILevelSegment、IImageDetail、ITableDetail 等类型描述结构。
- src/storage-strategy-slice.ts：
  - 提供 getDefaultStorageStrategyState 与 createStorageStrategySlice，用于组织存储策略相关子状态；
  - 通过 IStorageStrategySlice 暴露类型，便于在外层 store 组合时获得完整类型推导。
- typings.d.ts：
  - 放置本包需要的全局/补充类型声明（如 Storybook 或构建工具要求的模块声明）。

## 依赖与外部集成

- React 生态：
  - 依赖 react 18 和 react-dom 18，作为 peerDependencies 暴露，调用方需在宿主应用中提供；
  - hooks 和 Provider 假设在 React 函数组件环境中使用。
- 状态管理（zustand）：
  - 使用 create 创建 store，配合 middleware/devtools、middleware/subscribeWithSelector 实现可调试、可选择订阅的 store；
  - 使用 traditional/useStoreWithEqualityFn + shallow 来优化组件订阅性能；
  - 新增 store 时应沿用同一模式：定义状态与 action 类型 -> 使用 StateCreator 构建切片 -> 在根 store 中组合，并通过 hooks.ts 暴露访问接口。
- 内部 workspace 依赖：
  - @coze-arch/bot-api, @coze-arch/bot-error, @coze-arch/bot-typings, @coze-arch/i18n, @coze-arch/report-events：
    - 在本子包中通常用于调用后端 bot/knowledge 服务、国际化文案、上报埋点等；
    - 注意：这些依赖在 monorepo 中由 rush/npm workspace 统一管理，版本固定为 workspace:*，不要手动改为具体版本号。
  - @coze-data/knowledge-resource-processor-core：
    - 提供知识资源解析/处理的核心能力，processing-knowledge 相关 store 可能会依赖其任务定义或结果结构。
- 通用工具：
  - ahooks：辅助编写复杂 hooks（视具体文件使用情况）；
  - classnames：在需要时组合 CSS class；
  - utility-types：在类型层面做 Partial/DeepPartial 等变换，常见于 store 类型定义。

## 构建、测试与调试流程

- 本子包的 package.json 中 scripts：
  - build: 目前为 "exit 0"，表示实际构建由上层工具统一处理（如 rush build 或顶层 FE 构建脚本）；本地直接跑 build 不会产出 dist。
  - lint: 使用 monorepo 统一的 eslint 配置（eslint.config.js 与 @coze-arch/eslint-config），执行方式：
    - 在子包目录下：npm run lint
    - 或在仓库根目录通过 rush 子命令（参考 frontend/README.md 和 rush.json）。
  - test: 使用 vitest（配置见 vitest.config.ts 与 @coze-arch/vitest-config），运行所有单测：
    - 在子包目录下：npm test
  - test:cov: 在 test 基础上开启 v8 覆盖率：npm run test:cov
- 典型开发流程（建议给 AI agent）：
  - 在 monorepo 根目录执行 rush update，确保依赖安装完毕；
  - 若需 Storybook 级调试，可在 frontend 根目录查阅通用 storybook 配置（本子包带有 stories/ 目录，用于演示 store 使用方式）；
  - 调试 zustand store 时可启用浏览器 devtools 插件，通过 middleware/devtools 追踪状态变更。

## 代码风格与约定

- 类型与命名：
  - 状态接口以 I 开头（如 IParams、ILevelSegmentsSlice、IStorageStrategySlice），与 workspace 其他包保持一致；
  - 对外导出的枚举或常量（如 FilterPhotoType）直接从功能文件导出，并在 index.ts 聚合；
  - hooks 命名统一使用 use 前缀，并表达清晰语义（如 useKnowledgeParamsStore 与 useKnowledgeParams 的区分）。
- store 设计：
  - 优先使用切片模式（slice）拆分复杂 store，将不同功能区的状态与 action 分开实现，再在根 store 中组合；
  - 当某 slice 需要在不同包中复用时，通过导出 createXXXSlice + getDefaultXXXState 的组合来复用；
  - 所有对外可见的状态/动作都应有明确的 TypeScript 类型，以保证消费方获得完善的类型提示。
- hooks 使用约定：
  - 不鼓励调用方直接使用底层 zustand store 实例，统一通过 hooks.ts 与 context.tsx 中暴露的 API 访问；
  - 选择器函数应尽量只返回必要字段，并使用 shallow 或自定义比较函数减少重渲染。
- 国际化与埋点：
  - 涉及 UI 文案时，应通过 @coze-arch/i18n 进行国际化，而非写死字符串；
  - 关键用户操作（如开始/完成知识处理）应结合 @coze-arch/report-events，在对应 action 中统一上报。

## 项目流程与协作规范

- 版本与发布：
  - 版本号与发布流程由仓库根目录的 rush.json 与 common/autoinstallers 配置统一管理，本子包不应独立修改 version 策略；
  - 发布前会通过 monorepo 统一的构建与测试流水线，确保所有子包的 lint/test 通过。
- 分支与提交流程：
  - 仓库整体遵循统一的 Git 工作流（参考根目录 README.md 与 CONTRIBUTING.md），本子包不定义额外分支策略；
  - 在提交涉及本子包的改动时，建议在提交信息中注明 [knowledge-stores]，便于后续 git blame/查阅。
- 代码评审：
  - 新增 store、slice 或对外导出时，应在 MR/PR 中附带简单的使用示例或变更说明，尤其是会影响到其他 knowledge 模块的 API 变更。

## 对 AI 编程助手的特别提示

- 在修改或新增 store 时：
  - 请保持与现有 zustand 模式一致（使用 devtools、subscribeWithSelector、切片模式与类型前缀 I）；
  - 优先在 hooks.ts 与 context.tsx 中扩展访问入口，不要在业务组件中直接 import 内部 store 文件。
- 在调整 API 或类型导出时：
  - 同步维护 src/index.ts 的导出列表，避免出现「实现存在但未对外导出」或「导出已删除实现」的情况；
  - 注意 IKnowledgeParams 是 IParams 的别名，如需要扩展参数结构，请先修改 params-store.ts 再更新别名使用场景。
- 在引入新依赖时：
  - 优先复用 monorepo 中已有的 workspace:* 包；确有必要新增第三方依赖，需要同时评估 bundle 体积与 tree-shaking 影响，并更新 disallowed_3rd_libraries 配置（若涉及）。
