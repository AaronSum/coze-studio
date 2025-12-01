# @coze-workflow/test-run-shared Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/test-run-next/shared）中安全、高效地协作开发。

## 总体架构与角色定位
- 本子包是 Coze Studio 前端 monorepo 中的一个 UI/工具共享包，为 Workflow TestRun 功能提供通用组件与工具函数。
- 包入口为 [src/index.ts](frontend/packages/workflow/test-run-next/shared/src/index.ts)，仅导出有限的公共 API：
  - 组件：`JsonEditor`、`BottomPanel`。
  - 工具函数：`safeFormatJsonString`、`safeJsonParse`、`gotoDebugFlow`。
- 源码按职责拆分：
  - [src/components](frontend/packages/workflow/test-run-next/shared/src/components) 用于 React 组件。
  - [src/utils](frontend/packages/workflow/test-run-next/shared/src/utils) 用于无状态工具函数。
- 项目通过 `@coze-editor/editor` 与 `@codemirror/*` 集成 JSON 代码编辑与校验功能，通过浏览器 `window.open` 及 URL 参数与 Workflow 调试页面进行跳转联动。

## 目录结构与关键模块
- 顶层结构（仅与开发相关部分）：
  - [src](frontend/packages/workflow/test-run-next/shared/src)
    - [index.ts](frontend/packages/workflow/test-run-next/shared/src/index.ts)：统一导出公共 API。
    - [global.d.ts](frontend/packages/workflow/test-run-next/shared/src/global.d.ts)：如有需要，放置本包的全局类型声明（保持与现有内容风格一致）。
    - [components/json-editor](frontend/packages/workflow/test-run-next/shared/src/components/json-editor)
      - [base.tsx](frontend/packages/workflow/test-run-next/shared/src/components/json-editor/base.tsx)：基于 `@coze-editor/editor` 的底层 JSON 编辑器封装（Provider + 具体编辑器组件）。
      - [json-editor.tsx](frontend/packages/workflow/test-run-next/shared/src/components/json-editor/json-editor.tsx)：对外暴露的 `JsonEditor` 组件实现，处理状态同步、schema 校验、聚焦态高度变化等行为。
      - [index.ts](frontend/packages/workflow/test-run-next/shared/src/components/json-editor/index.ts)：转出口，保持组件导出路径简洁。
    - [components/bottom-panel](frontend/packages/workflow/test-run-next/shared/src/components/bottom-panel)
      - [panel.tsx](frontend/packages/workflow/test-run-next/shared/src/components/bottom-panel/panel.tsx)：`BottomPanel` 视图与布局逻辑，通常用于 TestRun 底部调试/日志区域。
      - [use-resize.ts](frontend/packages/workflow/test-run-next/shared/src/components/bottom-panel/use-resize.ts)：封装拖拽/伸缩等尺寸调整逻辑的自定义 Hook。
      - [panel.module.less](frontend/packages/workflow/test-run-next/shared/src/components/bottom-panel/panel.module.less)：局部样式，采用 CSS Modules 约定。
      - [index.ts](frontend/packages/workflow/test-run-next/shared/src/components/bottom-panel/index.ts)：组件导出。
    - [utils](frontend/packages/workflow/test-run-next/shared/src/utils)
      - [safe-json-parse.ts](frontend/packages/workflow/test-run-next/shared/src/utils/safe-json-parse.ts)：容错 JSON 解析。
      - [safe-format-json-string.ts](frontend/packages/workflow/test-run-next/shared/src/utils/safe-format-json-string.ts)：容错 JSON 字符串格式化。
      - [debug-url.ts](frontend/packages/workflow/test-run-next/shared/src/utils/debug-url.ts)：生成并跳转 Workflow 调试 URL 的工具。
      - [index.ts](frontend/packages/workflow/test-run-next/shared/src/utils/index.ts)：工具函数聚合导出。
  - [__tests__/utils](frontend/packages/workflow/test-run-next/shared/__tests__/utils)：针对工具函数的 Vitest 单测，用于锁定解析/格式化行为。
  - 构建与配置文件：
    - [package.json](frontend/packages/workflow/test-run-next/shared/package.json)
    - [tsconfig.json](frontend/packages/workflow/test-run-next/shared/tsconfig.json)、[tsconfig.build.json](frontend/packages/workflow/test-run-next/shared/tsconfig.build.json)、[tsconfig.misc.json](frontend/packages/workflow/test-run-next/shared/tsconfig.misc.json)
    - [vitest.config.ts](frontend/packages/workflow/test-run-next/shared/vitest.config.ts)
    - [eslint.config.js](frontend/packages/workflow/test-run-next/shared/eslint.config.js)

## 组件与数据流概览
- `JsonEditor` 组件（核心交互入口）：
  - 文件： [components/json-editor/json-editor.tsx](frontend/packages/workflow/test-run-next/shared/src/components/json-editor/json-editor.tsx)。
  - 使用 `React` hook 管理内部状态：
    - `focus`：控制编辑器聚焦状态，从而影响 `height`（获得焦点时高度加大，便于编辑）。
    - `uri`：通过 `lodash-es/uniqueId` 生成的虚拟文件 URI，用于与 `json.languageService` 绑定 schema。
    - `editorRef`：`EditorAPI` 引用，用于读写编辑内容与触发校验。
  - 关键数据流：
    - 外部通过 `value`、`jsonSchema`、`onChange` 等属性控制；
    - `useEffect` 根据 `jsonSchema` 调用 `json.languageService.configureSchemas` 进行 schema 绑定，并在组件卸载时执行 `deleteSchemas` 清理；
    - 另一个 `useEffect` 负责将外部的 `value` 同步到内部编辑器，如果当前编辑器内容不同则调用 `setValue`。
  - 组件最终通过 `EditorProvider` 包裹 `JSONEditor`，传入包括 `uri`、`languageId: 'json'`、高度控制、只读/可编辑配置及回调。
  - 在协作开发中，保持 `JsonEditor` 作为“受控但包裹底层编辑器”的角色，不要在内部引入与 Workflow 具体业务耦合的逻辑；业务应由上层包在使用时实现。
- `BottomPanel` 组件：
  - 主要用于承载 TestRun 底部区域（日志、调试信息、变量面板等），组件本身仅关注：
    - 伸缩/收起逻辑（通过 `use-resize` 维护宽高）；
    - 样式布局（`panel.module.less` 中定义）。
  - 设计思路：`BottomPanel` 提供一个通用容器，内容由业务侧通过 children 控制，本子包尽量避免直接耦合具体业务字段。
- 工具函数：
  - `safeJsonParse`：
    - 对非字符串对象直接返回原值；
    - 字符串尝试 `JSON.parse`，失败时返回 `options.emptyValue`（默认 `undefined`）；
    - `needReport`/`enableBigInt` 目前未使用，仅作为预留选项，修改时需保持兼容。
  - `safeFormatJsonString`：
    - 仅对字符串处理：尝试 `JSON.parse` 后再 `JSON.stringify`，使用 2 空格缩进；
    - 解析失败时返回原值，确保 UI 不因为非法输入而崩溃。
  - `gotoDebugFlow`：
    - 封装 Workflow 调试跳转逻辑：
      - 内部 `getDebugUrl` 组合 `space_id`、`workflow_id`、`execute_id`、`sub_execute_id`、`node_id` 等 query 参数，构造 `/work_flow?...` URL；
      - 如 `op` 为 `true`，会以当前 `window.location.pathname` 为基准打开一次短链（不含 `space_id` 等参数），然后再打开完整 `/work_flow` 地址。
    - 在使用时要注意运行环境需为浏览器（依赖 `window` 与 `URLSearchParams`）。

## 开发与构建工作流
- 包级脚本（参见 [package.json](frontend/packages/workflow/test-run-next/shared/package.json)）：
  - `pnpm`/`rush` 一般由 monorepo 管理，此处只列局部命令：
  - `npm run build`：当前实现为 `exit 0`，构建流程通常由上层 Rush 构建配置统一控制。
  - `npm run lint`：使用 `eslint` 执行代码检查，命令为 `eslint ./ --cache`。
  - `npm run test`：`vitest run --passWithNoTests`，在 CI 中允许无测试文件通过。
  - `npm run test:cov`：`vitest run --passWithNoTests --coverage`，生成覆盖率报告。
- 测试配置：
  - [vitest.config.ts](frontend/packages/workflow/test-run-next/shared/vitest.config.ts) 通过 `@coze-arch/vitest-config` 的 `defineConfig` 生成统一配置：
    - `dirname: __dirname`，`preset: 'web'`，适配前端包测试环境。
    - 可选项 `{ fixSemi: true }` 表明在某些辅助脚本中可能会自动修复缺失分号，新增测试文件时需注意与此配置保持兼容。
- TypeScript 工程引用：
  - [tsconfig.json](frontend/packages/workflow/test-run-next/shared/tsconfig.json) 仅声明为 composite 工程并引用：
    - [tsconfig.build.json](frontend/packages/workflow/test-run-next/shared/tsconfig.build.json)：构建产物相关配置；
    - [tsconfig.misc.json](frontend/packages/workflow/test-run-next/shared/tsconfig.misc.json)：测试、vitest 配置等开发期辅助内容（如 `types: ["vitest/globals"]`）。
  - 修改类型或路径别名时，优先对照上层 workspace 的 tsconfig 约定，避免破坏 monorepo 级别的工程引用链。

## 项目特有约定与模式
- 导出边界：
  - 对外 API 必须通过 [src/index.ts](frontend/packages/workflow/test-run-next/shared/src/index.ts) 暴露。
  - 在新增组件/工具函数时，优先考虑是否需要对外公开；如仅在本包内部被复用，可保持在子目录内私有导出。
- React 组件风格：
  - 使用函数式组件与 Hooks；
  - 事件回调命名使用 `onXxx`/`didXxx` 约定（如 `onChange`、`didMount`），不在内部持久化外部状态；
  - `JsonEditor` 中对编辑器实例的访问统一通过 `editorRef` 与 `didMount`，不要在外部直接操作底层 DOM。
- JSON Schema 校验：
  - 统一通过 `json.languageService.configureSchemas` 进行 schema 设置：
    - 每次渲染使用独立的 schema URI（`file:///${uniqueId()}`），并在 `useEffect` 清理函数中调用 `deleteSchemas`，防止全局污染；
  - 新增使用 schema 的组件时，应复用此“创建 schema -> 配置 -> 组件卸载时删除”的生命周期模式。
- URL 与调试跳转：
  - 调试 URL 的参数命名使用后端接口对齐的小写下划线风格：`space_id`、`workflow_id` 等；
  - `gotoDebugFlow` 已经封装了大部分细节，其他包需调试跳转时应优先使用此方法，而不是自行拼 URL，以保持参数格式一致。
- 错误容忍策略：
  - 对用户输入的 JSON 文本采取“尽量不抛错”的策略：
    - `safeJsonParse`/`safeFormatJsonString` 在解析失败时返回兜底值或原值，而非抛异常；
    - UI 层组件（如 `JsonEditor`）依赖这些工具保证在异常输入下界面仍可渲染。

## 外部依赖与集成要点
- 编辑器相关：
  - `@coze-editor/editor`：提供编辑器核心能力与 `EditorAPI` 类型。
    - `JsonEditor` 通过 `EditorProvider` 和 `JSONEditor` 组合使用；
    - 扩展语言支持通过 `@coze-editor/editor/language-json` 的 `json` 对象实现，包括 `languageService` 配置。
  - `@codemirror/*`、`@lezer/common`：这些依赖通常在底层编辑器内部使用，子包代码本身不直接操作；如需新增编辑特性，优先在 `base.tsx` 内封装，而不是直接在业务组件里引入 CodeMirror API。
- UI 与工具：
  - `@coze-arch/coze-design`：设计系统组件库，本子包的底部面板或其他 UI 如需控件，优先复用它提供的组件；
  - `ahooks`：在 Hook 层复用通用副作用工具（如节流、防抖、尺寸监听等），适合放在 `use-resize` 或未来新增 hooks 中。
  - `lodash-es`：只按需引用，例如 `isString`、`uniqueId`，保持 tree-shaking 友好。
- 测试栈：
  - 使用 `vitest` + `@coze-arch/vitest-config` 保持 monorepo 内一致的测试风格；
  - 测试文件路径放在 [__tests__](frontend/packages/workflow/test-run-next/shared/__tests__) 下，与源码相对独立。

## 过程与协作规范
- 代码风格与 Lint：
  - 统一使用 `@coze-arch/eslint-config` 和 monorepo 级别的 ESLint 规则，[eslint.config.js](frontend/packages/workflow/test-run-next/shared/eslint.config.js) 中可能有额外覆写；
  - 在提交前应保证 `npm run lint` 通过；AI 修改代码时需尽量遵循已有模式（如 import 顺序、函数命名）。
- TypeScript：
  - 严格依赖现有 tsconfig；新增类型时优先在局部文件内声明，只有在跨模块共享时再考虑放入 [global.d.ts](frontend/packages/workflow/test-run-next/shared/src/global.d.ts) 或上层 shared typings 中。
- 测试：
  - 已存在的 utils 单测位于 [__tests__/utils](frontend/packages/workflow/test-run-next/shared/__tests__/utils)，新增/修改工具函数时应同步补充对应测试；
  - 测试使用 `describe/it/expect` 等 Vitest 全局 API（通过 tsconfig.misc 中的 `types: ["vitest/globals"]` 注入）。
- 与 monorepo 的关系：
  - 本包通过 Rush 管理依赖，其他子包通过 `"@coze-workflow/test-run-shared": "workspace:*"` 进行依赖声明；
  - AI 在修改依赖版本或新增依赖时，应考虑整个 monorepo 的一致性，避免在子包中直接锁死与全局不兼容的版本。

## 非常见/需要注意的特性
- `gotoDebugFlow` 的双窗口打开行为：
  - 当 `op` 为 `true` 时，会先在当前 pathname 上打开一次带调试参数的 URL，然后再打开 `/work_flow?...`，这可能用于兼容旧路由或保留某些参数；
  - 如需调整行为，应检查上层依赖调用方式及后端路由逻辑，避免破坏现有调试链路。
- JSON schema 生命周期：
  - 使用随机 schema URI 并在组件卸载时删除是为了避免多实例编辑器之间的 schema 污染；
  - 新增编辑器实例时务必沿用这一模式，避免对 `json.languageService` 造成全局副作用。
- 浏览器依赖：
  - 少数工具函数（如 `gotoDebugFlow`）强依赖浏览器环境（`window`、`URLSearchParams`），在 SSR 或 Node 测试环境中直接调用会报错；
  - 在测试或服务端渲染上下文中使用这些 API 前，要么打桩/mock `window`，要么将相关逻辑放在 `useEffect` 等仅在客户端运行的生命周期中。
