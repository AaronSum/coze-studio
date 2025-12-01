# @coze-data/knowledge-resource-processor-adapter — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-resource-processor-adapter）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包是「知识资源处理器」前端适配层，面向 Studio 中的知识库资源上传 / 重切分 / 增量处理等场景。
- 位置：frontend/packages/data/knowledge/knowledge-resource-processor-adapter，对应包名 `@coze-data/knowledge-resource-processor-adapter`。
- 职责：
  - 从上游 Store 读取当前知识场景参数（资源类型 `UnitType`、操作类型 `OptType`）。
  - 根据类型/操作选择合适的上传配置（uploadConfig），并注入到基础布局组件 `KnowledgeResourceProcessorLayout`。
  - 不直接实现上传流程、接口调用和复杂 UI，只做「路由 + 适配」工作。
- 依赖的核心包：
  - `@coze-data/knowledge-resource-processor-core`：定义 `UnitType`、`OptType`、`GetUploadConfig`、`UploadBaseState` / `UploadBaseAction` 等核心类型与约定。
  - `@coze-data/knowledge-resource-processor-base`：提供具体的布局组件和各知识类型下的配置对象（Text/Table/Image 等的新增、增量、重切分配置）。
  - `@coze-data/knowledge-stores`：提供 `useKnowledgeParams`，用于获取当前知识场景的 `type` / `opt`。

## 模块结构与数据流
- 入口导出（src/index.tsx）：
  - `getUploadConfig`：从 `./scenes/base/config` re-export 的工具，用于根据 `UnitType` + `OptType` 选择上传配置对象。
  - `KnowledgeResourceProcessor` + `KnowledgeResourceProcessorProps`：从 `./scenes/base` re-export 的 React 组件与 props 类型，供上层页面直接使用。
- 场景实现（src/scenes/base/index.tsx）：
  - 从 `@coze-data/knowledge-stores` 读取当前知识上下文：
    - `type`：知识单元类型，例如 TEXT、TABLE、TEXT_DOC、TABLE_DOC、IMAGE_FILE 等（`UnitType` 枚举）。
    - `opt`：操作类型，例如 ADD、RESEGMENT、INCREMENTAL 等（`OptType` 枚举）。
  - 通过 `getUploadConfig(type ?? UnitType.TEXT, opt ?? OptType.ADD)` 计算得到 uploadConfig：
    - 若无对应配置（`getUploadConfig` 返回 null），则渲染空片段 `<> </>`，即在当前场景下不显示上传 UI。
    - 若存在配置，则渲染 `KnowledgeResourceProcessorLayout`，并将 `uploadConfig` 与上层传入的 `props` 合并传入。
  - `KnowledgeResourceProcessorProps` 完全透传自基础布局层 `KnowledgeResourceProcessorLayoutProps`，本包不新增额外 props。
- 配置映射（src/scenes/base/config.ts）：
  - 内部 `getConfigV2()` 返回一个二级映射对象：`{ [UnitType]: { [OptType]: Config } }`，其中 Config 类型为 `UploadConfig`（具体类型由 core/base 定义）。
  - 映射内容概览：
    - TEXT：仅支持 `OptType.RESEGMENT` → `TextResegmentConfig`。
    - TABLE：仅支持 `OptType.RESEGMENT` → `TableResegmentConfig`。
    - TEXT_DOC：
      - ADD → `TextLocalAddUpdateConfig`。
      - RESEGMENT → `TextLocalResegmentConfig`。
    - TEXT_CUSTOM：
      - ADD → `TextCustomAddUpdateConfig`。
    - TABLE_DOC：
      - ADD → `TableLocalAddConfig`。
      - INCREMENTAL → `TableLocalIncrementalConfig`。
    - TABLE_CUSTOM：
      - ADD → `TableCustomAddConfig`。
      - INCREMENTAL → `TableCustomIncrementalConfig`。
    - IMAGE_FILE：
      - ADD → `ImageFileAddConfig`。
  - `getUploadConfig` 实现：
    - 签名：`GetUploadConfig<number, UploadBaseState<number> & UploadBaseAction<number>>`。
    - 使用 `lodash-es/get` 从 `getConfigV2()` 的返回中按路径 `${type}.${optKey}` 查找配置；当 `opt` 为空字符串时默认使用 `OptType.ADD`；找不到则返回 `null`。
  - 文件顶部注释解释了 v2 配置的背景：
    - 全面去掉“更新”操作。
    - 文本重切分统一为一个配置（交互已一致）。
    - UI 有若干细节调整。
    - 所有接口迁移到 `KnowledgeAPI`。

## 构建、测试与开发流程
- 包管理：依赖 Rush + PNPM workspace 管理：
  - 在仓库根目录执行：`rush update` 完成依赖安装与 workspace 链接。
- 本包脚本（package.json）：
  - `build`: `exit 0`
    - 当前不在子包层级生成构建产物，TS 编译和打包由上层统一构建系统处理（参考 frontend 级别的构建配置）。
  - `lint`: `eslint ./ --cache`
    - 使用 `@coze-arch/eslint-config` 的 web 预设；在提交前可在本包目录执行 `npm run lint` 检查代码风格与常见问题。
  - `test`: `vitest --run --passWithNoTests`
    - 单测框架为 Vitest，配置来自 `@coze-arch/vitest-config`（见 `vitest.config.ts`），preset 为 web 场景。
  - `test:cov`: `npm run test -- --coverage`
    - 在上述测试基础上启用覆盖率统计。
- TypeScript 工程配置：
  - 顶层 [tsconfig.json](tsconfig.json) 仅启用 composite 并引用：
    - `tsconfig.build.json`：面向产出代码的编译配置。
    - `tsconfig.misc.json`：面向测试与杂项脚本的配置（未在此文件中详列）。
  - [tsconfig.build.json](tsconfig.build.json)：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，统一 web 前端编译规范。
    - `rootDir: src`，`outDir: dist`，`jsx: react-jsx`。
    - `module: ESNext` + `moduleResolution: bundler`，与现代打包器（Vite/Rspack 等）对齐。
    - 通过 `references` 显式依赖：
      - `arch/bot-typings`、`data/common/stores`、`config/*` 工具包。
      - `knowledge-resource-processor-base` 与 `knowledge-resource-processor-core`，用于保证 TS project references 顺序正确。

## 项目约定与编码风格
- 技术栈：
  - React 18 函数组件 + TypeScript，严格按 `@coze-arch/ts-config` 编译。
  - hooks 使用 `useXxx` 命名，组件使用帕斯卡命名（`KnowledgeResourceProcessor`）。
- 职责划分：
  - 本包不负责持久化任何业务状态，仅从 `useKnowledgeParams` 读取并根据配置渲染 UI。
  - uploadConfig 的具体表现（字段定义、步骤流、接口调用）都在 `@coze-data/knowledge-resource-processor-base` / `core` 内实现；如果需要调整具体交互，应前往对应基础包实现修改，而不是在本适配器中增加逻辑分支。
- 配置扩展约定：
  - 新增知识类型或操作时，优先在 `core` 和 `base` 包中增加对应的 `UnitType` / `OptType` 枚举值与配置对象，然后在本包的 `getConfigV2` 中补齐映射。
  - `getUploadConfig` 使用 `UnitType` + `OptType` 作为 key 组合，避免使用 string literal，确保与核心枚举保持一致。
- 返回空视图的语义：
  - 当某组合暂不支持上传能力（如还未实现某 UnitType + OptType），`getUploadConfig` 将返回 `null`，`KnowledgeResourceProcessor` 会直接渲染空片段；
  - 上层场景如果需要对“不支持”做特殊提示，建议在消费端包裹一层（例如在页面级组件中判断该组合是否应该存在），本包保持简单的「无配置则不渲染」策略。

## 与其他包的集成关系
- `@coze-data/knowledge-stores`：
  - `useKnowledgeParams` 暴露当前知识场景上下文，通常由路由或全局状态设置，包括：
    - `type`: 来自 `UnitType` 的值，标识知识单元类型（文本、表格、图像等）。
    - `opt`: 来自 `OptType` 的值，标识当前操作（新增、重切分、增量等）。
  - 该 hook 是本包的唯一业务输入源；不要在本包中直接依赖路由/URL/全局 store。
- `@coze-data/knowledge-resource-processor-core`：
  - 提供：
    - `UnitType`, `OptType` 枚举。
    - `GetUploadConfig`, `UploadBaseState`, `UploadBaseAction` 类型，用于约束 `getUploadConfig` 的签名与泛型参数。
  - 当 core 层升级（例如新增操作类型或改变泛型参数）时，本包需要同步更新 `getUploadConfig` 类型参数，确保 TS 编译通过且语义一致。
- `@coze-data/knowledge-resource-processor-base`：
  - 提供基础布局与具体配置：
    - `KnowledgeResourceProcessorLayout` / `KnowledgeResourceProcessorLayoutProps`。
    - 各种 `*Config`：文本/表格/图片的重切分、本地新增、自定义新增、增量处理等配置对象。
  - 本包只是将这些配置进行组合，不应创建新的 Config 类型或中间态；若需要新的流程，应在 base 包内定义完备的配置后再在此处接入。

## 工程流程与协作建议
- 在本包内改动前，可先查看：
  - `@coze-data/knowledge-resource-processor-base` 中对应 Config 的实现方式和 UI 行为。
  - `@coze-data/knowledge-resource-processor-core` 中 `UnitType` / `OptType` 与 `GetUploadConfig` 相关定义。
  - `@coze-data/knowledge-stores` 中 `useKnowledgeParams` 的来源（通常由某个路由/上层页面设置）。
- 常见改动场景：
  - **新增知识类型/操作**：
    - 在 core/base 中定义新枚举值与配置对象。
    - 在本包 `getConfigV2` 中为新组合映射对应 Config。
    - 根据需要在上层页面设置 `type` / `opt`，即可复用 `KnowledgeResourceProcessor` 渲染新场景。
  - **调整默认行为**：
    - 当前默认当 `type` 为空时使用 `UnitType.TEXT`，`opt` 为空字符串时使用 `OptType.ADD`；如需改变默认值，应直接修改 `KnowledgeResourceProcessor` 和 `getUploadConfig` 中的兜底逻辑，并确认所有调用方预期。
- 测试建议：
  - 为新增/调整的映射逻辑（`getConfigV2` / `getUploadConfig` 组合）补充简单的 Vitest 单测：
    - 给定 `UnitType` + `OptType` 时，返回对应 Config 类型。
    - 不支持的组合返回 `null`。
  - 通过上层应用（知识库管理页面）进行联调，验证 UI 和接口行为是否符合产品设计。

## 本子包的特殊点与注意事项
- 构建脚本为 no-op：
  - `npm run build` 实际不生成产物，一切编译由 monorepo 顶层完成；
  - 不要在本包中引入额外 bundler 逻辑，以免与整体构建流程冲突。
- 轻量适配层定位：
  - 本包代码量少，逻辑集中在配置映射和简单组件封装；
  - 在添加逻辑时，应避免把领域判断、接口调用或复杂 UI 写入此处，而是把它们放到 core/base/stores 或上层页面中。
- 默认值行为：
  - `getUploadConfig` 对空字符串 `opt` 做了特殊处理（视为 ADD），这是历史迁移的兼容设计，修改时需审慎确认是否仍有旧调用方依赖该行为。
