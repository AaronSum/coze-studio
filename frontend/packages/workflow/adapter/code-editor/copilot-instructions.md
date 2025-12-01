# @coze-workflow/code-editor-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/adapter/code-editor）中安全、高效地协作开发。

## 全局架构与职责边界
- 本包是「工作流代码编辑器适配层」，对上提供统一的 Editor/Previewer React 组件，对下封装 @coze-editor/editor（基于 CodeMirror 6）和 @coze-workflow/base 等内部能力。
- 入口文件为 src/index.tsx：
  - 注册自定义主题 `code-editor-dark`（使用 components/theme.ts 中的 createDarkTheme）。
  - 聚合导出：
    - `Editor`：业务版代码编辑器组件（来自 components/editor 下 BizEditor）。
    - `Previewer`：代码预览/执行结果视图组件（在 components/previewer 中）。
    - `convertSchema`：将 JS 对象转换为参数 Schema 的工具函数（utils/convert-schema.ts）。
    - `EditorProps`、`PreviewerProps` 类型定义（interface.ts）。
- 组件分层（src/components）：
  - components/editor/index.tsx：根据语言选择具体实现，导出 `Editor` 与 `BizEditor`。
  - components/editor/editor.tsx：
    - 负责语言选择与懒加载：
      - `language === 'python'` 时懒加载 ./python-editor。
      - 其他情况默认使用 ./typescript-editor。
    - 通过 React.lazy + Suspense 做代码分割，减轻初始包体积。
  - components/editor/typescript-editor.tsx：
    - 使用 `@coze-editor/editor/react` 提供的 `EditorProvider` 与 `Renderer` 作为核心编辑器渲染容器。
    - 使用 `initTypescriptServer`、`initInputAndOutput` 等工具初始化 TypeScript 语言服务和输入/输出变量绑定（在同目录 utils 中）。
    - 通过 `Renderer` 的 `didMount` 回调桥接内部编辑器 API 到外部 `EditorOtherProps.didMount`。
    - 监听编辑器 `change` 事件并回调 `onChange(code, defaultLanguage)`，对上游抽象为「内容+语言」更新事件。
    - 利用 CodeMirror 的 `EditorView.theme` 配置高度、聚焦样式以及等宽字体等 UI 细节。
  - components/theme.ts：基于 `@coze-editor/editor/preset-code` 的 `createTheme` 创建暗色主题，集中管理编辑器 UI 颜色（背景、行高亮、补全浮层等）。
  - components/previewer/*：负责渲染代码结果预览（代码执行结果 / 运行日志等），通常与工作流节点执行引擎集成。
- 工具与类型：
  - interface.ts：
    - 定义 `LanguageType`（目前支持 'python' | 'typescript' | 'javascript'，但 JS 已标记为历史数据，实际目前仅 python / typescript 有实现）。
    - `EditorProps` / `EditorOtherProps`：描述编辑器需要的业务上下文（uuid、spaceId、input/output 变量树、语言模板、测试按钮回调、挂载回调等）。
    - `PreviewerProps`：用于 Previewer 的最小参数集合（content + language + height）。
    - `Input` / `Output` 结构与 `@coze-workflow/base` 的变量树定义 ViewVariableTreeNode/ViewVariableType 对齐，是编辑器与工作流变量面板之间的纽带。
  - utils/convert-schema.ts：
    - 将任意 JS 对象递归转换为「参数 schema 数组」。
    - 使用数字枚举（1/2/3/4/6/99/100/101/102/103）表示不同类型（String/Integer/Boolean/Number/Object/数组变体等），与服务端或其他包中现有约定对齐。
    - 通过 `maxDepth` / `currentDepth` 防止无限递归；遇到不支持的值类型会抛出 `ContainsInvalidValue` 异常。

## 构建、测试与调试工作流
- 本包依赖 Rush + pnpm 的 monorepo 管理，不单独维护本地 node_modules。所有构建/依赖管理要优先通过仓库根目录脚本：
  - 初始化依赖：在 frontend 根目录执行 `sh scripts/setup_fe.sh` 或 `rush update`（参见 frontend/README.md 与本包 README.md）。
- 本包 package.json 中的脚本：
  - `build`: 当前实现为 `exit 0`，仅占位，真实构建通常由上层构建系统（统一 rollup/webpack）负责。
  - `lint`: `eslint ./ --cache`，使用统一规则（eslint.config.js + @coze-arch/eslint-config）。
  - `test`: `vitest --run --passWithNoTests`，通过 @coze-arch/vitest-config 提供的预设，类型为 web 前端组件测试。
  - `test:cov`: 在 test 基础上添加 coverage 输出，覆盖率结果路径为 `coverage`（在 config/rush-project.json 中声明为 test:cov 的输出目录）。
- 类型检查与增量编译：
  - tsconfig.json：
    - 本包自身不直接参与编译（exclude: ["**/*"]，仅做 references 汇总），实际编译配置在 tsconfig.build.json 和 tsconfig.misc.json 中。
  - tsconfig.build.json：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，面向浏览器环境（lib: DOM + ESNext；module: ESNext；target: ES2020；moduleResolution: bundler）。
    - typecheck 输出到 dist，并生成 tsbuildinfo，供 Rush 的 `ts-check` 使用。
    - references 指向 i18n、workflow base、eslint-config 等其他内部包，保证 TS 项之间的编译顺序由 Rush 管理。
  - Rush 集成：config/rush-project.json 将本包的
    - `operationName: "test:cov"` 与 `outputFolderNames: ["coverage"]` 绑定，用于 Rush 的增量构建与缓存。
    - `operationName: "ts-check"` 与 `outputFolderNames: ["dist"]` 绑定，用于类型检查/构建缓存。
- Storybook 调试：
  - .storybook/main.js：
    - 使用 `@storybook/react-vite` 作为运行时，stories 源在 stories/**/*.mdx | .stories.tsx。
    - 通过 `viteFinal` 挂载 `vite-plugin-svgr` 支持以 React 组件方式导入 SVG。
  - 典型工作流（在本包目录下）：
    - `npm run storybook`（具体命令需查看根级或 workspace 统一 script），用于交互式开发和组件视觉验收。

## 项目约定与代码风格
- 语言与框架：
  - 使用 React 18（函数组件 + hooks），类型系统为 TypeScript，JSX 转换为 react-jsx。
  - 编辑器封装使用 `@coze-editor/editor`，并通过 `EditorProvider + Renderer` 组合提供插件化、语言服务与 UI 能力，不直接调用 CodeMirror 低层 API（除主题配置）。
- 统一配置：
  - ESLint：eslint.config.js 使用 `@coze-arch/eslint-config` 提供的 `defineConfig({ packageRoot, preset: 'web' })`，禁止在此包内自定义大规模规则；如需特殊规则，尽量通过 preset 配置或局部 eslint-disable 注释实现。
  - Stylelint：.stylelintrc.js 使用 `@coze-arch/stylelint-config`，适配 CSS-in-JS / 组件样式约定；本包自身样式较少，多依赖上游 UI 库。
  - Vitest：vitest.config.ts 使用 `@coze-arch/vitest-config` 的 web 预设，不建议在本包中覆盖核心配置（如 alias、环境），以免破坏统一测试体验。
- 类型与命名：
  - `EditorProps` / `PreviewerProps` 等 Props 类型统一从 src/interface.ts 导出，组件实现处尽量引用这些类型，避免重复声明。
  - `LanguageType` 是关键扩展点：
    - 若新增语言（如 `sql`），应：
      - 扩展 LanguageType union。
      - 在 components/editor/editor.tsx 中增加对应懒加载组件。
      - 在 components/editor 目录下实现具体编辑器组件（如 sql-editor.tsx），沿用 TypescriptEditor 的结构（initXxxServer、Renderer、事件回调）。
  - 输入输出变量：
    - `Input` / `Output` 与工作流节点变量树对齐，不要擅自修改结构字段或含义；如需新增字段，先确认 @coze-workflow/base 中的 ViewVariableTreeNode 定义是否需要同步更新。
- 错误处理与边界：
  - convertSchema：
    - 对不支持类型直接抛出 Error；使用者在上层应捕获异常，并将错误反馈到 UI 或日志，而不是在此工具内进行 UI 处理。
    - 通过 maxDepth 防止循环引用/深层嵌套导致的栈溢出，调用方如有大对象需适当调整 maxDepth 入参。
  - 编辑器组件：
    - 对 didMount/onChange/onTestRun 等回调统一做「可选调用」防御（?.），避免容器未传递回调时报错。
    - language 解析逻辑统一通过 useMemo 派生，优先使用显式 props.language，其次回退到 defaultLanguage。

## 关键依赖与集成点
- @coze-editor/editor：
  - 提供跨语言、可插件化的代码编辑器基础设施。
  - 通过 `EditorProvider` 提供上下文，通过 `Renderer` 渲染代码编辑器实例并暴露 API（在 `didMount(api)` 中可拿到）。
  - 主题系统：通过 `themes.register('code-editor-dark', createDarkTheme())` 将本包暗色主题挂到全局 Theme Registry，languageId/theme 通过 options 传入。
- @codemirror/state & @codemirror/view：
  - 仅在局部用于 EditorView.theme 等扩展点，底层状态管理与视图渲染由 @coze-editor/editor 管理；不要在本包直接 new EditorView 或手动操作 EditorState。
- @coze-workflow/base：
  - 提供 `ViewVariableTreeNode`、`ViewVariableType` 等工作流变量树类型，是编辑器与工作流节点元数据互通的基础。
  - 本包不直接依赖业务 API，仅通过类型与 input/output props 与上游衔接。
- @coze-arch/i18n 与 @coze-arch/coze-design：
  - i18n：用于编辑器 UI 与按钮文案本地化。组件中如引入文案，需通过统一的 i18n hook/组件。
  - coze-design：统一 UI 组件库（按钮、布局等），在 Previewer 或编辑器容器的周边 UI 中使用。

## 开发流程与协同规范
- 分支/提交规范：
  - 整个仓库遵守统一规范（参考根目录 CONTRIBUTING.md / README.md），本包不单独定义分支策略。一般流程为 feature/xxx → 提交 MR → CI 执行 Rush + 前后端流水线。
- 与其他子包协作：
  - 工作流前端可能有多个 adapter（如 node-config-adapter、debugger-adapter 等），彼此之间在 UI/类型/行为上应保持一致：
    - 统一使用 Rush workspace 依赖引用（workspace:*），避免通过裸 npm 版本号直接依赖其他 sibling package。
    - 如需要共享工具或类型，优先抽到 @coze-workflow/base 或其他 arch 层包再复用，而不是在多个 adapter 中复制代码。
- 部署与发布：
  - 本包 version 目前为 0.0.1，实际发布与版本管理由上层 release 流程统一控制（可能通过 Rush publish / 内部发布系统完成）。不要在本地随意修改 version 字段。

## 特殊/不寻常的点
- build 脚本为 no-op：
  - package.json 的 `build: exit 0` 是刻意设计，用于兼容 Rush 的 operation 流程但不在本包内执行单独打包。编辑器最终打包通常由上游应用或统一组件打包工具处理。
- 语言支持状态：
  - interface.ts 中仍保留 `javascript` 选项，但注释已标明为历史数据；当前真正实现的仅 python/typescript。
  - 任何新增/调整语言都要保证：
    - 类型定义与实现组件一一对应。
    - Editor 入口的语言分发逻辑同步更新。
- 深度限制与错误枚举：
  - convertSchema 使用硬编码的数字常量代表类型，沿袭了历史协议；新增类型时需要确保与服务端/其他 consumer 一致，并更新注释说明。
- Storybook 与业务集成并存：
  - 本包既是可独立通过 Storybook 调试的 UI 组件，又是工作流页面中嵌入的业务组件，修改 UI 时要考虑两个场景：
    - Storybook 中的展示与交互是否合理。
    - 在 workflow playground / 实际 IDE 界面中的嵌入样式是否兼容（高度/宽度、背景色等不要与外层冲突）。
