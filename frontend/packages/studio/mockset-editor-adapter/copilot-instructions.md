# @coze-studio/mockset-editor-adapter · AI 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/mockset-editor-adapter）中安全、高效地协作开发。

## 1. 子包定位与全局架构

- 包名：`@coze-studio/mockset-editor-adapter`，位于 frontend/packages/studio/mockset-editor-adapter。
- 职责：为 Studio 里的「Mock 集合（mockset）」结果示例编辑能力提供一个轻量的 React 适配组件，对下游业务隐藏底层编辑器实现细节。
- 主要构成：
  - src/index.ts：对外导出入口，只做 re-export，不包含业务逻辑。
  - src/components/mockset-editor/index.tsx：核心 React 组件 `MocksetEditor` 及其 props/暴露方法定义，是本包唯一的业务实现文件。
  - 样式文件 index.module.less：承载该组件的布局和展示样式。
- 对外 API：
  - `MocksetEditor`：编辑 mock 结果示例的 UI 容器组件。
  - `MocksetEditorProps`：组件入参类型，在此包内扩展底层 `MockDataEditorProps` 后形成。
  - `EditorAreaActions`：通过 ref 暴露给父级的操作集合，目前仅包含 `getValue()`。
- 上游/下游关系：
  - 上游依赖：业务页面或上层 Studio 子包使用本包来渲染 mockset 编辑区域，不直接依赖 `@coze-studio/mockset-editor`。
  - 下游依赖：本包将大部分编辑行为委托给 `@coze-studio/mockset-editor` 的 `MockDataEditor` 组件，并使用 `@coze-studio/mockset-shared` 中的工具做大小限制等校验。

## 2. 关键依赖与数据流

- 主要依赖（见 package.json）：
  - `@coze-studio/mockset-editor`：底层 JSON/结构化数据编辑器，提供 `MockDataEditor`、`EditorActions`、`MockDataEditorMarkerInfo`、`MockDataEditorProps` 等类型和能力。
  - `@coze-studio/mockset-shared`：提供 `MAX_SUBMIT_LENGTH` 和 `calcStringSize`，用于限制粘贴内容的字节长度，防止超大 payload。
  - `@coze-arch/i18n`：用于错误提示文案 `I18n.t('mockset_toast_data_size_limit')`。
  - `@coze-arch/bot-semi`：使用 `Toast` 组件展示错误消息。
  - `classnames`：合并传入的 `className` 与模块样式类。
- 数据流与交互链路：
  1. 外部传入 `MocksetEditorProps`，其中包含：
     - 来自底层编辑器的 `MockDataEditorProps`（除去 onValidate）。
     - 可选回调：`onValidate`（校验状态变更）、`onGenerationStatusChange`（预留，当前实现未使用）。
     - 运行环境信息 `environment`（spaceId/mockSetId/basicParams），目前在组件内部未直接消费，保留给未来扩展和外部调用方使用。
  2. 组件内部基于 `mockInfo.mergedResultExample` 构造 `currentEditConfig`：
     - `current`：当前正在编辑的条目索引（默认 0）。
     - `valid`：每个条目的校验状态数组，初始为 `[true]`。
     - `data`：每个条目的结果示例字符串列表，初始为 `mockInfo.mergedResultExample ? [mergedResultExample] : []`。
  3. 渲染阶段：
     - 遍历 `currentEditConfig.data`，为每个条目渲染一个 `MockDataEditor`：
       - `mockInfo.mergedResultExample` 被替换为当前条目的 `item`，其余 mockInfo 字段保持不变。
       - `ref` 存入 `editorsRef.current[index]`，用于后续读取内容。
       - `onValidate`：收到 `markers` 后更新对应 `valid[index]`，并将更新状态数组传给外部 `onValidate`。
       - `onEditorPaste`：在粘贴前通过 `pasteHandler` 计算字节长度并做限制。
     - 通过模块样式 className 控制当前激活面板与静态/绝对布局（面板容器仅渲染当前 active 内容）。
  4. 外部 ref 能力：
     - `useImperativeHandle` 将 `getValue` 暴露给父组件，父组件可以在提交前统一收集所有条目内容。

## 3. 组件与类型设计

- `MocksetEditorProps`：
  - 继承自 `Omit<MockDataEditorProps, 'onValidate'>`，即完全复用底层编辑器的 props，只替换 `onValidate` 语义：
    - 底层：单一编辑器传回当前 markers。
    - 适配层：聚合多个编辑面板，将每个面板校验结果合并为 `boolean[]` 回传给父级。
  - 新增字段：
    - `onValidate?: (isValid: boolean[]) => void`：每次某个面板校验状态更新时调用，传入所有面板的布尔数组。
    - `isCreateScene?: boolean`：当前未在实现中使用，仅透传/预留，外部可以依靠是否传入该标记进行场景判断。
    - `onGenerationStatusChange?: (value: boolean) => void`：未消费（预留），AI 修改代码时不要删除该字段，以兼容后续接入。
    - `environment`：
      - `spaceId?: string`：空间 ID。
      - `mockSetId?: string`：Mock 集合 ID。
      - `basicParams: unknown`：上游用于构建环境的参数对象。
    - 目前环境信息只在 props 类型约束中存在，适配层本身不做处理，留给未来与后端或运行状态结合。
- `EditorAreaActions`：
  - `getValue: () => string[]`：返回从 index 0 到 `currentEditConfig.data.length - 1` 对应每个 `MockDataEditor` 的 `getValue()` 结果。
  - `forceStartGenerate?: (...params: unknown[]) => void`：当前未实现，仅在类型上兼容，避免破坏调用方已有代码结构。
  - 使用方式：
    - 上游通过 `const ref = useRef<EditorAreaActions | null>(null);` 创建引用，并在 `MocksetEditor` 上使用 `ref={ref}`；随后可在需要时调用 `ref.current?.getValue()`。

## 4. 构建、测试与本地开发流程

- 包管理与脚本（见 package.json）：
  - `build`: `exit 0`
    - 当前仅作为 Rush pipeline 的占位，本包自身不产出最终构建产物，真正打包由上层构建体系统一处理。
    - AI 助手不要在此包引入独立 bundler 或产物目录，除非同时更新整个前端构建流程。
  - `lint`: `eslint ./ --cache`
    - 使用 `@coze-arch/eslint-config` 的 web 预设；在修改 TS/TSX 文件后建议运行，以保持代码风格一致。
  - `test`: `vitest --run --passWithNoTests`
  - `test:cov`: `npm run test -- --coverage`
- 测试配置：
  - `vitest.config.ts` 使用 `@coze-arch/vitest-config.defineConfig`，`preset: 'web'`，无额外 alias/特殊设置。
  - 当前仓库中仅有 `__tests__/.gitkeep`，实际测试用例尚未补充；新增重要行为（例如多面板切换、校验聚合逻辑）时应在 `__tests__` 下增加 Vitest + Testing Library 用例。
- 本地开发常见步骤：
  - 在仓库根目录执行 `rush update` 安装依赖。
  - 按需在根目录或上层 app 内启动 dev server；本包自身 README 中的 `npm run dev` 来源于模板，当前并未配置对应脚本，可以忽略。

## 5. 约定与模式（AI 修改时需遵守）

- 入口与导出：
  - `src/index.ts` 只承担「统一导出」职责：
    - `export { MocksetEditor, type MocksetEditorProps, type EditorAreaActions } from './components/mockset-editor';`
  - 如未来新增适配组件（例如额外的 panel 或 wrapper），应：
    - 在 `src/components/` 下创建实现文件；
    - 在 `src/index.ts` 中集中 re-export；
    - 避免让外部直接从深层路径导入。
- 状态管理：
  - 当前组件使用 React 本地 state：
    - `useState<EditDataConfig>` 管理当前索引、校验状态、数据列表。
    - `useRef<(EditorActions | null)[]>` 管理底层编辑器实例数组。
  - 没有跨组件全局 store；若未来需要在多个区域共享 mockset 编辑状态，建议在上层容器创建 store，而非在本适配层引入全局状态管理库。
- 校验与提示：
  - 校验结果完全依赖底层 `MockDataEditor` 提供的 markers：
    - `markers.length === 0` 视为有效，反之为无效。
    - 适配层只做布尔化与聚合，不解释 markers 内容。
  - 粘贴大小限制：
    - 通过 `calcStringSize(value)` 计算字符串实际大小（可能按字节或字符数计算，具体以 `@coze-studio/mockset-shared` 实现为准）。
    - 若超过 `MAX_SUBMIT_LENGTH`，则使用 `Toast.error(I18n.t('mockset_toast_data_size_limit'))` 弹出错误消息，并返回 `false` 阻止粘贴。
    - AI 在扩展粘贴行为（如自动截断）时，应保持「拒绝 + 提示」为默认分支，避免静默丢失数据。
- 布局与样式：
  - 样式文件采用 CSS Modules：`import s from './index.module.less';`。
  - 容器类名：
    - `mock-tab-container`：整体编辑区域容器。
    - `mock-tab-panels`：内部面板列表容器。
    - `mock-tab-panel_visible` / `mock-tab-panel_invisible`：控制当前可见/隐藏面板。
    - `mock-tab-panel_static` / `mock-tab-panel_absolute`：区分第一个面板和后续面板的布局策略。
  - 修改 UI 时应保持这些语义化类名不变或在样式文件内扩展，避免在 TSX 中硬编码过多内联样式。

## 6. 与其他子包的协作与扩展点

- 与 `@coze-studio/mockset-editor` 的集成：
  - 本适配层不创建/管理 editor 内部的 schema 或高阶逻辑，只负责：
    - 把环境/props 按原样传递给 `MockDataEditor`。
    - 订阅 `onValidate` 与 `onEditorPaste` 回调。
    - 将 `mockInfo.mergedResultExample` 替换为当前条目的内容。
  - 若需要调整编辑器行为（如支持多 schema、动态校验规则），优先在 `@coze-studio/mockset-editor` 包中扩展对应能力，再在本包中做轻量接入，而不是在此包中「绕过」底层 API 自行实现。
- 与 `@coze-studio/mockset-shared` 的协作：
  - 任何与 mock 数据大小、格式相关的约束应尽量放在 shared 包中，以便在多个适配/业务场景重用；本包只调用约定好的工具函数和常量。
  - 新增约束时，建议：
    - 在 shared 包中新增常量/工具；
    - 在本包中只做调用和错误提示，不写重复逻辑。
- i18n 与提示：
  - 所有用户可见文案都应通过 `I18n.t` 获取；`mockset_toast_data_size_limit` 是现有 key 的示例。
  - 新增提示信息时，请在相关 i18n 资源包中补充对应 key，不要在适配层硬编码字符串。

## 7. 对 AI 助手的操作建议

- 在本包内新增或修改逻辑时：
  - 保持 `MocksetEditor` 作为轻量「外壳」的定位：只做多面板聚合、校验聚合和粘贴大小限制，不在此编写复杂业务流程（如网络请求、mockset 列表管理）。
  - 如需增加多条 mock 结果编辑、切换 Tab 等高级交互，优先在本包内扩展 `EditDataConfig` 及渲染逻辑，但仍复用 `MockDataEditor` 作为单条编辑器。
  - 调整 `MocksetEditorProps` 或 `EditorAreaActions` 时，必须考虑所有可能的外部引用，优先通过增加可选字段/方法的方式实现兼容扩展，而不是删除或重命名已有字段。
- 需要理解底层编辑器行为时：
  - 前往 `frontend/packages/studio/mockset-editor` 包内查看 `MockDataEditor` 的具体实现和 props 约束，再决定在适配层如何调用。
  - 不在适配层重新实现 JSON 编辑、校验或高亮等能力。
