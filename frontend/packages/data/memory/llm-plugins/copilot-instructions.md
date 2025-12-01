# @coze-data/llmPlugins 子包协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/memory/llm-plugins）中安全、高效地协作开发。

## 全局架构与职责
- 本子包是一个 React UI 组件库，当前主要导出 `RecallSlices` 组件和类型 `LLMOutput`，用于渲染 LLM（知识召回）输出片段列表。
- 对外入口：
  - 打包入口：[index.ts](index.ts) 只转发 `RecallSlices`（来自 `./src`）。
  - 组件入口：[src/index.ts](src/index.ts) 再次从 [src/plugins/index.ts](src/plugins/index.ts) 导出 `RecallSlices` 与 `LLMOutput`。
- 核心实现位于：[src/plugins/recall-slices/index.tsx](src/plugins/recall-slices/index.tsx)：
  - 根据 `LLMOutput` 结构渲染一个或多个召回片段卡片，每条卡片包含数据集名称、文档名称、来源类型、格式类型、得分与截断后的内容。
  - 通过 `filterUnnecessaryContentFromSlice` 对原始 `slice` 文本做裁剪/清洗，再显示到界面中。
  - 使用 Less 模块样式 [src/plugins/recall-slices/index.module.less](src/plugins/recall-slices/index.module.less) 定义布局与主题细节。
- 数据与外部系统的依赖：
  - 埋点上报：依赖 `@coze-data/reporter` 的 `dataReporter` 与 `DataNamespace`，在生成知识详情链接失败时上报 `REPORT_EVENTS.KnowledgeSourceGetURL` 相关错误（`@coze-arch/report-events`）。
  - 多语言文案：通过 `@coze-arch/i18n` 的 `I18n.t` 获取所有提示文案，组件内不硬编码字符串标文案。
  - UI 组件：使用 `@coze-arch/bot-semi` 中的 `Card`、`Tag`、`Tooltip`，约定整体风格与其它 bot/studio UI 一致。
  - 知识枚举：从 `@coze-arch/bot-api/knowledge` 导入 `DocumentSource` 与 `FormatType`，用作 `source_type` / `format_type` 的枚举映射基础。
- 组件对上层使用方的职责划分：
  - 上层调用者负责构造符合 `LLMOutput` 接口的数据数组 `llmOutputs`（尤其是 `meta` 中的 dataset/document/link 信息与 `score`）。
  - 本组件只负责渲染与交互逻辑（展开/收起、跳转知识详情链接、打点上报），不直接调用远端接口。

## 关键数据流与交互逻辑
- 输入数据结构：`LLMOutput`（定义于 [src/plugins/recall-slices/index.tsx](src/plugins/recall-slices/index.tsx)）大致如下：
  - `meta.dataset.id` / `meta.dataset.name`：数据集 ID 与名称；
  - `meta.document.id` / `source_type` / `format_type` / `name`：文档标识、来源类型、格式类型与文档名称；
  - `meta.link.title` / `url`：外部链接信息（当前 UI 未直接使用，但为后续扩展保留）；
  - `score`：召回得分，渲染为 `Score: xx.xx`；
  - `slice`：被模型召回的文本片段，经过 helper 过滤后展示。
- 格式与来源文案映射：
  - `getSourceTypeDescription`：基于 `DocumentSource` 枚举，将整数 `source_type` 映射为 i18n 文案 key，例如 `chat-area-knowledge-custom-data-source`、`chat-area-knowledge-online-data-source` 等；
  - `getFormatTypeDescription`：基于 `FormatType` 枚举，将 `format_type` 映射为 i18n 文案 key，例如 `knowledge-dataset-type-table`、`knowledge_photo_025` 等；
  - 若 `source_type` / `format_type` 非枚举值或为 falsy，组件会返回 `undefined`，从而不渲染对应 Tag。
- 内容折叠逻辑：
  - `sliceContentRef` 挂在内容容器上，`useEffect` 在初次渲染完成后比较 `scrollHeight` 与 `clientHeight`，若出现溢出则将 `needCollapse` 置为 `true`。
  - 当 `needCollapse` 为真时，展示“查看全部/收起”操作文案（通过 `I18n.t('view-all-chat-knowledge-source-header')` 与 `I18n.t('collapse-chat-knowledge-source-header')`）。
  - 展开与收起通过切换不同的样式类名（`recall-slice-content-open` / `recall-slice-content-collapsed`）实现，具体行数控制在 Less 中完成。
- 跳转知识详情页与异常上报：
  - 组件从 `window.location.href` 解析当前 `space` 路径片段，获取 `spaceId`，并拼出 `/space/{spaceId}/knowledge/{dataset.id}?first_auto_open_edit_document_id={document.id}` 的跳转 URL。
  - 若路径中找不到 `space` segment 或 `spaceId` 不符合数值正则 `/^[1-9][0-9]+$/`，会用 `dataReporter.errorEvent` 上报错误，`eventName` 为 `REPORT_EVENTS.KnowledgeSourceGetURL`。
  - 正常情况下调用 `window.open(targetURL, '_blank')` 在新窗口打开知识数据集详情页。

## 开发与构建工作流
- 包管理与依赖：
  - 本仓库整体由 Rush 管理（根目录有 `rush.json`），本子包在 [config/rush-project.json](config/rush-project.json) 中登记；
  - 推荐先在仓库根目录执行 `rush update` 安装依赖，避免直接在子包目录使用 `npm install` 破坏工作区结构。
- 本子包常用脚本（在本目录执行）：
  - `npm run build`：当前配置为 `exit 0`，用于占位的构建脚本；真实打包由上层工具（例如 rsbuild 或统一构建脚本）完成。
  - `npm run lint`：调用 `eslint`，配置来自 [eslint.config.js](eslint.config.js)，preset 为 `web`，会读取上层共享规则 `@coze-arch/eslint-config`。
  - `npm run test`：使用 Vitest 运行单测，配置来自 [vitest.config.ts](vitest.config.ts) 与共用 preset `@coze-arch/vitest-config`，`--passWithNoTests` 允许无测试文件时通过。
  - `npm run test:cov`：在测试基础上增加覆盖率统计（`@vitest/coverage-v8`）。
- Storybook / Demo：
  - 组件 Demo 与使用示例位于 [stories](stories) 目录，例如 `demo.stories.tsx` / `demo.tsx`，可作为开发交互参考；
  - Storybook 配置位于 `.storybook` 目录下（若后续增加），遵循仓库统一的 React 组件模板规范。
- TypeScript 配置：
  - 顶层 [tsconfig.json](tsconfig.json) 仅作为 solution-style 配置，`exclude: ["**/*"]`，实际编译走 [tsconfig.build.json](tsconfig.build.json) 与 [tsconfig.misc.json](tsconfig.misc.json)。
  - `tsconfig.build.json` 继承自 `@coze-arch/ts-config/tsconfig.web.json`，指定 `rootDir: src`、`outDir: dist`，并通过 `references` 声明依赖的其它 workspace 包（i18n、report-events、bot-api、reporter 等），用于 TS 项目引用和增量构建。
  - `tsconfig.misc.json` 包括入口文件、测试文件、stories、配置脚本等，方便在编辑器中获得类型检查与跳转能力。

## 项目内约定与编码规范
- 技术栈与语法：
  - 使用 React 18 函数组件，Hooks 为主（`useState`、`useEffect`、`useMemo`、`useRef` 等），不使用 class 组件。
  - 样式采用 Less Modules，类名通过 `styles['xxx']` 的形式访问，避免硬编码字符串和全局污染；全局样式覆盖通过 `:global` 选择器嵌套到本组件容器下实现。
  - 组件 Props 和内部数据结构使用 TypeScript 强类型定义，所有公开类型（如 `LLMOutput`）须放在对外导出的路径下（当前在 `recall-slices/index.tsx` 中导出再透传）。
- 命名与文件组织：
  - 功能较为完整的插件以子目录形式存在于 [src/plugins](src/plugins) 下，例如 `recall-slices`；后续新增插件建议沿用此模式（一个子目录内包含 `.tsx` + `.module.less` + `helpers/`）。
  - helpers 目录用于承载与 UI 相对解耦的纯逻辑函数（例如 `filter-unnecessary-content-from-slice`），方便单测与复用。
  - 样式类名统一使用 `recall-slice-*` / `recall-slices` 形式，便于搜索和定位相关代码。
- i18n 约定：
  - 所有用户可见文案均通过 `I18n.t(key)` 获取，本子包不新增硬编码中文或英文字符串；
  - 新增文案 key 时，要与现有命名空间保持一致，例如 `chat-area-knowledge-*`、`knowledge-dataset-type-*` 等，由上游 i18n 仓库提供具体文案映射。
- 埋点与监控：
  - 出错场景统一通过 `dataReporter.errorEvent` 上报，需指定 `DataNamespace` 与对应 `REPORT_EVENTS` 枚举值；
  - 若在本组件内新增重要交互事件（例如点击更多信息、复制片段），优先复用既有事件枚举，或在 `@coze-arch/report-events` 内新增后再引用，避免使用魔法字符串。

## 与仓库其它模块的集成关系
- 与聊天区域组件的集成：
  - 在上层聊天 UI 中，本子包通过 `import { RecallSlices } from '@coze-data/llmPlugins';` 的方式集成，例如：[frontend/packages/common/chat-area/chat-area/src/components/fuction-call-message/function-call-content/knowledge-recall/index.tsx](frontend/packages/common/chat-area/chat-area/src/components/fuction-call-message/function-call-content/knowledge-recall/index.tsx)。
  - 上层组件负责将后端返回的 LLM 知识召回结果转换成 `LLMOutput[]`，并将该数组传入 `RecallSlices`。
- 与数据/知识子域的关系：
  - 本子包不直接依赖后端 API 调用，只依赖 `@coze-arch/bot-api/knowledge` 中的类型/枚举，以保持对知识系统的抽象；
  - 如需扩展到其它类型的 LLM 插件（例如工具调用结果展示），建议在 `src/plugins` 下新增子目录，而不是在 `recall-slices` 内塞入多种展示形态。
- 与共享 infra 包的关系：
  - `@coze-arch/ts-config`、`@coze-arch/eslint-config`、`@coze-arch/vitest-config` 等作为统一规范入口，AI 助手编写配置时应尽量复用这些 preset，而避免自定义重复配置。

## 测试与质量保障
- 测试框架：
  - 使用 Vitest 作为测试运行器，`@testing-library/react` 与 `@testing-library/jest-dom` 作为 React 组件测试工具；
  - 目前 `__tests__` 目录中仅有占位文件（`.gitkeep`），新增测试时建议紧贴业务场景，例如：
    - `LLMOutput` 入参为空数组时不渲染任何卡片；
    - 不同 `DocumentSource`/`FormatType` 枚举值下，Tag 显示是否正确；
    - 长内容下折叠/展开交互是否满足预期。
- 样式与 ESLint：
  - Stylelint 配置由 `@coze-arch/stylelint-config` 提供，建议在新增 Less 文件后运行仓库级别 lint，而不是在本子包单独跑 stylelint。
  - ESLint 规则以 `@coze-arch/eslint-config` 为主，保持与其它前端包的一致性；AI 助手在自动修复时应避免禁用已有规则。

## 流程与协作规范提示
- 分支与提交（推断自仓库整体约定）：
  - 本子包遵循仓库统一的分支/CI 流程（通常为 feature 分支 + PR + CI），具体细节参见仓库根目录的 CONTRIBUTING 文档；
  - 在本子包进行较大改动（尤其是类型或导出接口变化）时，应主动检查上游依赖包（例如 chat-area、knowledge-* 等）是否需要同步调整。
- 发布与版本：
  - `version` 当前为 `0.0.1`，依赖采用 `workspace:*`，说明发布通常通过 monorepo 的统一发布脚本执行；
  - 若需要对外发布（例如 npm registry），请遵循根仓库的 release 流程（通常由 CI pipeline 负责打包与发布），不要在子包目录直接 `npm publish`。

## 对 AI 助手的具体操作建议
- 在本子包中进行开发时，请优先遵守以下要点：
  - 新增插件：在 `src/plugins` 下建新目录，并在 [src/plugins/index.ts](src/plugins/index.ts) 与 [src/index.ts](src/index.ts) 中显式导出，保持扁平的公共 API；
  - 修改 `LLMOutput` 结构或展示逻辑前，先检索全仓 `LLMOutput` / `@coze-data/llmPlugins` 的使用点，确保不破坏上层依赖；
  - 操作 `window.location`、`window.open` 等副作用时，保持错误上报逻辑完整（`dataReporter.errorEvent`），不要吞掉潜在路径解析异常；
  - 避免在组件中直接写死 URL 或环境路径，所有与 space/knowledge 相关的路由生成逻辑应与当前实现保持一致或复用封装函数（若后续抽离）。
