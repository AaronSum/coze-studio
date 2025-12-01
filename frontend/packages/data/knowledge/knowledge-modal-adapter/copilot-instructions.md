# @coze-data/knowledge-modal-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/knowledge/knowledge-modal-adapter）中安全、高效地协作开发。

## 1. 全局架构与角色定位

- 本包是一个「适配器层」子包，主要职责：对外暴露统一的知识库相关弹窗 Hook，并将调用委托给底层能力包（如 @coze-data/knowledge-modal-base、@coze-data/utils、@coze-data/knowledge-stores 等）。
- 入口文件：[src/index.tsx](src/index.tsx) 仅做 re-export：
  - `useEditKnowledgeModal`：直接从 @coze-data/knowledge-modal-base 透传。
  - `useKnowledgeListModal`、`useKnowledgeListModalContent`、`KnowledgeListModalContent`：从本包内部 knowledge-list-modal 目录导出（注意：对应源码目录不在当前 context 展示，但在实际项目中存在）。
  - `useCreateKnowledgeModalV2`：从 [src/create-knowledge-modal-v2/scenes/base/index.tsx](src/create-knowledge-modal-v2/scenes/base/index.tsx) 导出，是本包目前最核心的实现逻辑。
- 业务边界：
  - 不直接做复杂业务处理和数据计算，更多是组装 UI、表单与 API 调用，并借助上游 store / API 包完成真正的读写。
  - 约束输入输出：通过 Hook 参数、回调（如 `onFinish`、`beforeCreate`）将行为交给上层业务。
- 数据与调用流（以 `useCreateKnowledgeModalV2` 为例）：
  1. 外部调用 Hook，传入可选 `projectID`、`onFinish`、`beforeCreate`。
  2. Hook 内部通过 `useDataModalWithCoze` 创建数据弹窗，并封装 `open/close`、`modal` 渲染函数。
  3. 表单由 `CozeKnowledgeAddTypeContent` 负责渲染与字段管理，`formRef` 负责校验和取表单值。
  4. 点击按钮时触发 `createDataset`，调用 `KnowledgeApi.CreateDataset` 创建数据集；根据是否传入 `onFinish` 决定是回调给外部还是内部使用 `resourceNavigate` 跳转/上传。
  5. 通过 `useSpaceStore` 获取当前空间 ID，参与请求参数。

## 2. 开发与构建工作流

### 2.1 包级命令

- 依赖安装（在 monorepo 根目录执行）：
  - 初始化：`rush update`
- 本包 `package.json` 中的脚本：
  - `npm run build`：当前实现为 `exit 0`，即占位构建脚本；真实构建通常由上层 Rush/Vite 配置在更高层触发（例如通过统一的 FE 构建脚本）。AI 在修改此包时无需单独依赖该脚本产物。
  - `npm run lint`：使用 [eslint.config.js](eslint.config.js) 与工作区统一 eslint 配置，对整个包进行检查。
  - `npm run test`：`vitest --run --passWithNoTests`，测试入口由 [vitest.config.ts](vitest.config.ts) 提供，配置来自 `@coze-arch/vitest-config`，preset 为 `web`。
  - `npm run test:cov`：在 `test` 基础上增加覆盖率。

### 2.2 Storybook 调试

- Storybook 配置：见 [.storybook/main.js](/frontend/packages/data/knowledge/knowledge-modal-adapter/.storybook/main.js)。
  - 使用 `@storybook/react-vite` 作为框架，`viteFinal` 中合并了 `vite-plugin-svgr` 以支持 `import Icon from './icon.svg?react'` 形式的 SVG 组件。
  - stories 路径：`../stories/**/*.mdx`、`../stories/**/*.stories.tsx`，示例在 [stories/demo.stories.tsx](stories/demo.stories.tsx) 和 [stories/hello.mdx](stories/hello.mdx)。
- 运行 Storybook 通常在 monorepo 上由统一命令启动（例如 `rushx storybook` 或包级 `npm run storybook`，具体以前端根目录配置为准）。AI 在扩展 UI 能力时，应优先为新组件或新 Hook 增加 story，便于交互调试。

### 2.3 测试与类型

- 单测：
  - 测试框架：Vitest，配置由 `@coze-arch/vitest-config` 接管，默认 web 环境、JSX/TSX 友好。
  - 测试目录：[__tests__](__tests__)（当前仅有 `.gitkeep`，尚无具体测试用例）。新逻辑建议在此目录下添加 `*.test.ts(x)` 文件。
- 类型/编译配置：
  - [tsconfig.json](tsconfig.json)：通用 TS 配置，通常继承工作区 `@coze-arch/ts-config`；
  - [tsconfig.build.json](tsconfig.build.json)：构建专用配置；
  - [tsconfig.misc.json](tsconfig.misc.json)：杂项/工具配置（例如脚本、工具型代码）。
  - 额外类型声明：[src/typings.d.ts](src/typings.d.ts)（如果需要在本包内补充全局/模块声明，应集中于此文件）。

## 3. 代码结构与约定

### 3.1 目录结构要点

- `src/index.tsx`：包的公共导出入口，仅做 re-export，不在此写业务逻辑。
- `src/edit-knowledge-modal/index.tsx`：简单适配层，直接 `export { useEditKnowledgeModal } from '@coze-data/knowledge-modal-base';`。
- `src/create-knowledge-modal-v2/scenes/base/index.tsx`：
  - 实现 `useCreateKnowledgeModalV2`，是目前本包最核心逻辑。
  - 与 UI 配置样式 [src/create-knowledge-modal-v2/scenes/base/index.module.less](src/create-knowledge-modal-v2/scenes/base/index.module.less) 紧密耦合。
- `knowledge-list-modal` 相关目录（未在当前片段中展开）：提供知识列表弹窗及其内容组件，对外通过 `useKnowledgeListModal`、`useKnowledgeListModalContent`、`KnowledgeListModalContent` 暴露。

### 3.2 Hook 设计约定

- Hook 返回对象通常包含：
  - `modal`: 一个可渲染的 ReactNode/函数，用于包裹在页面 JSX 内；
  - `open`: 打开弹窗的方法，可能包含「重置默认状态」逻辑（如 `setCurrentFormatType(FormatType.Text)`）；
  - `close`: 关闭弹窗的方法（可选）。
- 交互逻辑尽量放在 Hook 内部，页面只负责调用 `open/close` 并渲染 `modal(...)`，保持页面干净、逻辑集中。
- 表单：
  - 使用 `coze-design` 的 `Form` 组件，通过 `ref={formRef}` 和 `formApi` 进行校验与取值。
  - 校验通过 `formRef.current?.formApi.validate()` 触发，所有依赖表单内容的网络请求前都必须校验。

### 3.3 命名与样式

- CSS/LESS 模块：
  - 使用 `index.module.less` 并通过 `import styles from './index.module.less';` 引入。
  - className 使用 `styles['create-knowledge-modal']`、`styles['create-form']` 这种索引形式，避免属性名在压缩/重构时被误改。
- E2E/测试标记：
  - 使用来自 `@coze-data/e2e` 的 `KnowledgeE2e` 常量作为 `data-testid`，保证自动化测试稳定性。例如：按钮 `data-testid={KnowledgeE2e.CreateKnowledgeModalSubmitAndImportButton}`。
- 文案与多语言：
  - 所有展示文案均通过 `I18n.t(key)` 调用 `@coze-arch/i18n`，不要在组件里写死中文/英文字符串。

## 4. 关键依赖与集成细节

- `@coze-data/knowledge-modal-base`
  - 提供基础的知识弹窗能力（如 `useEditKnowledgeModal`、`CozeKnowledgeAddTypeContent` 等）。本包对其进行轻量封装或转发。
- `@coze-data/utils`
  - 核心使用 `useDataModalWithCoze`：
    - 负责创建 Coze 风格的 Modal，并返回 `{ open, close, modal }`。
    - 接收 `title`、`className`、`onCancel`、`footer` 等配置，本包在 `footer` 中组装 `Button` 和 `LoadingButton`。
- `@coze-data/knowledge-stores`
  - 使用 `useDataNavigate` 完成数据侧路由跳转 / 上传入口：
    - `resourceNavigate.toResource?.('knowledge', datasetId);`
    - `resourceNavigate.upload?.({ type: unitType });`
  - AI 在新增功能时，如需跳转/上传，应复用该 Hook 提供的方法，而不是直接操作 React Router。
- `@coze-data/knowledge-resource-processor-core`
  - 使用枚举 `UnitType` 用于描述知识单元类别（如 `TEXT_DOC` 等），与上传逻辑绑定。
- `@coze-arch/bot-api` 与 `@coze-arch/bot-studio-store`
  - `KnowledgeApi.CreateDataset`：创建知识数据集的后端接口，参数中需带上 `project_id`、`space_id`、`format_type` 等；
  - `FormatType`：数据格式类型（如 `Text`）；
  - `useSpaceStore`：获取当前空间 ID，作为请求上下文。
- `@coze-arch/coze-design`
  - UI 组件库，当前主要用到 `Button`、`LoadingButton`、`Form`，风格应保持一致。

## 5. 项目流程与协作规范

- 代码规范：
  - eslint/stylelint 配置来自工作区共享包（如 `@coze-arch/eslint-config`、`@coze-arch/stylelint-config`），本包仅做轻量覆盖；在修改 TSX/LESS 时保持与已有代码风格一致。
  - 所有文件头部使用统一的 Apache-2.0 版权声明（参考现有 TSX 文件）。新文件应复制相同头部注释。
- 包管理与发布：
  - 通过 Rush monorepo 管理版本与依赖；本包版本以 `0.0.1` 起步，通常不会手动在子包内执行 `npm publish`，而是由统一流程控制。
  - 依赖使用 `workspace:*` 的内部包，不要随意改为固定版本，除非有明确的跨包协同计划。
- 分支与提交：
  - 具体分支策略在仓库根部文档中（如 README、CONTRIBUTING）定义，此处仅约束：在子包内修改时，确保不会破坏公共 API（`src/index.tsx` 的导出）以免影响其他包编译。

## 6. 对 AI 助手的具体建议

- 修改或新增 Hook 时：
  - 保持 Hook 的返回结构与当前模式一致（`{ modal, open, close }`），避免破坏现有调用方。
  - 对于异步操作（如创建数据集），必须在调用前完成表单校验，并对外暴露清晰的回调点（如 `onFinish`）。
- 引入新依赖前：
  - 优先查找是否已有内部包可以复用（在 `@coze-data/*`、`@coze-arch/*` 命名空间下）。
  - 如确需第三方库，应遵循前端根目录的依赖白名单/黑名单（参见 [frontend/disallowed_3rd_libraries.json](../../../../disallowed_3rd_libraries.json)）。
- 新增 UI 或交互：
  - 同步更新 Storybook 示例，便于人工/自动化回归；
  - 为关键节点添加 `data-testid`（使用已有 e2e 常量），避免随意拼字符串。
