# @coze-studio/mockset-editor — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/mockset-editor）中安全、高效地协作开发。

## 一、子包定位与全局架构

- 位置与名称：本包位于 frontend/packages/studio/mockset-editor，对应 npm 包名 @coze-studio/mockset-editor，是 Studio 中「Mock 集合（mockset）」相关的 JSON 编辑器组件。
- 职责边界：
  - 提供基于 Monaco 的 JSON 编辑器/对比编辑器，用于编辑和校验 mock 返回示例数据。
  - 不负责 mock 元数据的拉取/保存，也不直接发请求；只消费上游传入的 mockInfo 数据结构并通过回调输出校验结果。
  - 样式与交互遵循 Studio 统一规范，通过 @coze-arch/bot-monaco-editor 和 @coze-arch/bot-semi 进行封装。
- 主要导出：
  - 源码入口 src/index.ts 仅做 re-export：
    - MockDataEditor：核心 React 组件。
    - MockDataEditorProps：组件 props。
    - MockDataEditorMarkerInfo：校验结果结构。
    - EditorActions：通过 ref 暴露的实例方法（目前只有 getValue）。
  - 对外使用方应一律从包入口引入，而不要直接引用内部组件路径。

## 二、代码结构与模块说明

- 目录概览：
  - src/index.ts：统一导出 MockDataEditor 及相关类型。
  - src/components/mockset-editor/index.tsx：MockDataEditor 组件实现。
  - src/components/mockset-editor/editor.module.less：主样式文件。
  - src/components/mockset-editor/light-theme-editor.module.less：亮色主题装饰样式。
  - __tests__：Vitest 测试目录（目前可能为空，可在此补充用例）。
  - .storybook：Storybook 配置，用于本地调试组件（结构与仓库内其他组件包保持一致）。

### MockDataEditor 组件行为（核心文件）

- 关键依赖：
  - @coze-studio/mockset-shared：
    - MockDataInfo：mockInfo 的类型定义，包含 mock 配置、合并后的示例数据、schema 信息、兼容标记等。
    - parseToolSchema(schema)：将后端提供的 schema 转换为 Monaco JSON 语言服务可识别的结构。
    - FORMAT_SPACE_SETTING：格式化时使用的缩进空格数（tabSize）。
  - @coze-arch/bot-monaco-editor：
    - Editor（重命名为 MonacoEditor）和 DiffEditor 封装。
    - Monaco / editor 类型定义来自 @coze-arch/bot-monaco-editor/types。
  - @coze-arch/bot-semi：Skeleton 组件，用于编辑器加载占位。
  - ahooks：useDebounceFn，用于防抖 model decorations 变化事件。
  - classnames：合并样式类名。

- props 与 ref：
  - mockInfo: MockDataInfo
    - mock：包含 responseExpect.responseExpectRule 等字段，用作编辑器基础内容。
    - mergedResultExample：与 mock 数据合并后的示例 JSON，用于展示「期望 vs 实际」差异。
    - schema：mock 数据的 JSON schema，用于启用 Monaco JSON 校验。
    - incompatible：标识当前 mock 与合并结果是否不兼容；为 true 时使用 DiffEditor 展示差异，否则使用单编辑器模式。
  - readOnly?: boolean：只读模式，影响编辑器 readOnly、滚动行为以及是否允许粘贴后自动格式化。
  - className?: string：容器额外类名。
  - onValidate?: (markers: MockDataEditorMarkerInfo[]) => void：
    - 每次模型装饰变化（包含 JSON 校验错误）时回调；
    - 入参为 { message: string }[]，由 Monaco markers + 额外 "no data" 提示组成。
  - onEditorPaste?: () => undefined | boolean：
    - 粘贴时调用；如返回 false，则不自动执行格式化；否则在 onDidPaste 回调中触发 editor.action.formatDocument。
  - onEditorReady?: () => void：
    - Monaco 初始化完成时回调，适合在外部执行首帧逻辑（如聚焦）。
  - ref: EditorActions：
    - getValue(): string | undefined：获取当前编辑器内容；对单编辑器和 diff 模式统一返回「修改后的内容」。

- 编辑/校验逻辑：
  - 初始化：
    - editorDidMountHandler / diffEditorDidMountHandler：
      - 记录 editorRef 和 monacoRef。
      - 若 mockInfo.schema 存在，则调用 parseToolSchema(schema)，并通过 monaco.languages.json.jsonDefaults.setDiagnosticsOptions 注册 JSON schema：
        - uri 为 https://plugin-mock-set/tool_schema_${model.id}（与具体文件无关的虚拟地址）。
        - fileMatch 为当前 model 的 uri.toString()，确保只对当前编辑器生效。
      - 注册事件：
        - onDidBlurEditorText：失焦时触发 editor.action.formatDocument（JSON 自动格式化）。
        - onDidPaste：执行 onEditorPaste，若结果不为 false，则再次格式化 JSON。
        - onDidChangeModelDecorations：触发防抖的 modelDecorationsChangeHandler，进而读取 markers 并调用 onValidate。
      - 设置 tabSize 为 FORMAT_SPACE_SETTING，统一缩进风格。
      - 调用 onEditorReady，并在下一 tick 设置 ready = true 显示编辑器（隐藏 skeleton）。
  - 校验：
    - modelDecorationsChangeHandler 内：
      - 通过 monaco.editor.getModelMarkers(model.id) 获取所有 markers，并过滤出 item.resource.path === model.id.replace('$model', '/') 的条目（只保留当前文档）。
      - 交给 validateHandler 处理：
        - 将 markers 映射成 { message: string }。
        - 若当前文本内容为空（trim 后长度为 0），额外 push { message: 'no data' }。
        - 调用 onValidate 回传。
    - 注意：markers 获取/过滤依赖 Monaco 的 model id 与 path 约定，修改 ID 结构时要同步调整过滤逻辑。

- 渲染模式：
  - 统一容器：
    - 外层 div 使用类：
      - editor-container：基础布局。
      - editor-container_disabled：只读态样式修饰。
      - lightTheme.light：亮色主题包裹，覆盖 Monaco 默认主题部分细节。
    - 未准备完成时显示 Skeleton.Image 占位，与编辑器重叠，通过 editor_hidden 类控制编辑器在 ready 之前隐藏。
  - Diff 模式（incompatible && !readOnly）：
    - 使用 DiffEditor：
      - original：mock.responseExpect.responseExpectRule。
      - modified：mergedResultExample。
      - language: "json"，theme: "vs-dark"。
      - 关闭 minimap、contextmenu，启用自动换行 wordWrap: "on"，Paste/Type 格式化开启，滚动到最后一行关闭。
  - 单编辑器模式（其它情况）：
    - 使用 MonacoEditor：
      - value：mock.responseExpect.responseExpectRule || mergedResultExample。
      - 选项与 Diff 模式类似，额外配置 scrollbar.alwaysConsumeMouseWheel 在只读模式下关闭，以避免滚轮被编辑器吞掉。

## 三、开发与测试工作流

- 包管理与构建：
  - 本仓库使用 Rush + PNPM 管理依赖，首次在前端仓库工作时需在根目录执行 rush update。
  - 本包 package.json 中：
    - build: exit 0（仅占位，真实打包由上层应用/构建系统统一处理）。
    - lint: eslint ./ --cache，规则来自 eslint.config.js 中的 @coze-arch/eslint-config（preset: web）。
    - test: vitest --run --passWithNoTests。
    - test:cov: 在 test 基础上加 --coverage。
- TypeScript 配置：
  - tsconfig.json：
    - 设置为 composite 项目并排除所有源文件，真正编译配置在 tsconfig.build.json 与 tsconfig.misc.json 中。
  - tsconfig.build.json：
    - 继承 @coze-arch/ts-config/tsconfig.web.json，rootDir: src，outDir: dist。
    - module: ESNext，target: ES2020，moduleResolution: bundler。
    - references 显式依赖：
      - arch/bot-monaco-editor、arch/bot-typings、components/bot-semi。
      - config 层的 eslint-config、stylelint-config、ts-config、vitest-config。
      - studio/mockset-shared。
  - tsconfig.misc.json：
    - 覆盖 __tests__、vitest.config.ts、stories 等非产出文件，保证 IDE 类型提示一致。
- 测试：
  - vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig，preset: "web"，dirname: __dirname，测试环境与其他前端包保持一致。
  - 建议在 __tests__ 下为以下场景增加用例：
    - onValidate 在无内容/有 JSON 错误时的行为。
    - incompatible 切换时 DiffEditor/MonacoEditor 渲染分支是否正确。
    - onEditorPaste 返回 false 时不自动格式化。

## 四、项目约定与模式

- 技术栈与风格：
  - React 18 函数组件 + TypeScript，使用 forwardRef + useImperativeHandle 暴露实例方法。
  - 强依赖 @coze-arch/bot-monaco-editor 提供的 Editor/DiffEditor，不直接使用裸 Monaco API，除非通过 monacoRef 操作语言服务或模型。
  - 样式使用 *.module.less + classNames 组合；亮色主题样式单独放在 light-theme-editor.module.less 中，避免污染其他编辑器实例。
- JSON 编辑体验约定：
  - 统一采用 "vs-dark" 主题配合外层 lightTheme 包裹；新增主题或样式变更时优先在 light-theme-editor.module.less 中调整。
  - 自动格式化触发点：
    - 失焦（onDidBlurEditorText）。
    - 粘贴（onDidPaste，除非 onEditorPaste 显式返回 false）。
  - 校验错误不直接打断输入，只通过 markers 提供文案；由调用方决定如何展示（如在 Panel/表单旁边集中显示）。
- 与 mockset-shared 的协作：
  - 不在本包内解析复杂的 mock schema/业务字段，所有 schema 相关逻辑由 @coze-studio/mockset-shared 提供：
    - 若需要扩展 schema 行为，应首先在 mockset-shared 中新增/调整 parseToolSchema 等工具。
  - MockDataInfo 是上游聚合后的结构，本包只解构出：mock、mergedResultExample、schema、incompatible；如需新增字段，应在 mockset-shared 中调整定义，并在本组件内部显式解构使用。

## 五、外部集成与使用建议

- 典型使用方式：
  - 在上层 mockset 编辑页面中引入：
    - 从 @coze-studio/mockset-editor 导入 MockDataEditor、MockDataEditorProps、EditorActions。
    - 通过 useRef<EditorActions | null>() 持有实例，按需调用 getValue() 获取当前编辑内容。
    - 将后端/状态管理中的 mockInfo（MockDataInfo）传入 mockInfo 属性。
    - 在 onValidate 中接收 markers，并在周边表单/Panel 中展示校验结果。
  - 对只读场景（如历史版本/审阅）：
    - 传入 readOnly:boolean，并根据需要屏蔽外层「保存」按钮；组件内部会：
      - 禁用编辑行为。
      - 修改滚动条行为，避免滚轮被编辑器完全拦截。

- 与其它 Studio 包的关系：
  - @coze-studio/mockset-shared：提供数据结构和 JSON schema 工具，是本包的直接上游依赖。
  - @coze-arch/bot-monaco-editor / @coze-arch/bot-semi：
    - 前者承载编辑器实现与类型，后者提供 Skeleton 等设计系统组件。
    - 新增交互时应优先查阅这些包是否已封装对应能力（如快捷键、自定义命令等），避免在本包重复实现 Monaco 底层逻辑。

## 六、对 AI 助手的特别提示

- 修改 MockDataEditor 时请注意：
  - 不要在组件内部新增与后端直接耦合的逻辑（如直接发请求或依赖全局 window 状态）。
  - 与 JSON schema 相关的改动要优先在 @coze-studio/mockset-shared 中实现，然后只在这里调整 schema 绑定方式。
  - 如需调整校验策略，应保持 onValidate 回调签名不变，尽量通过扩展 message 文案或增加字段而非修改结构。
- 新增功能的推荐路径：
  - 若是编辑器行为（自动补全、格式化策略、快捷键等）：
    - 优先在 bot-monaco-editor 中寻找可复用能力；必要时通过 monacoRef 进行局部增强，但需保证不影响其他使用该编辑器的子包。
  - 若是围绕 mock 数据的业务逻辑（如「一键重置为示例」）：
    - 建议由上层容器组件负责按钮/交互，本包只暴露 getValue 和接受新的 mockInfo/value，从而保持 MockDataEditor 纯粹专注于编辑体验。
