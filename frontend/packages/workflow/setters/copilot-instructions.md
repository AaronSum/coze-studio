# @coze-workflow/setters

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/setters）中安全、高效地协作开发。

## 全局架构与角色
- 本包是工作流系统的「表单 Setter 组件库」，为 @flowgram-adapter/free-layout-editor 提供各种字段类型的配置面板（String/Number/Text/Boolean/Enum/Array/EnumImageModel 等）。
- 统一的 Setter 接口定义在 src/types.ts，通过 `Setter<Value, Options>` 约束所有组件签名（value、onChange、readonly、children、context、testId 等）。
- 包入口 src/index.ts 仅做类型与组件聚合导出，供上层包（如 @coze-workflow/nodes、@coze-workflow/playground）按需引用。
- 所有 Setter 仅关注 UI 与交互，不直接做网络请求或全局状态管理；业务上下文通过 `context`（来自 free-layout-editor 的 SetterComponentProps）下发。
- 布局与样式统一使用 less 模块（如 `string.module.less`、`array.module.less` 等），组件内部通过 classnames 组合样式。

目录大致结构：
- src/types.ts：定义通用 Setter 类型及 props 结构，是本包最重要的约束文件。
- src/index.ts：公共导出入口，按类型导出各 Setter 组件与 Options 类型。
- src/string、src/number、src/text、src/boolean、src/enum：基础标量 Setter，每个目录下通常包含 `*.tsx`、`index.ts`、`index.stories.tsx`、`index.test.tsx`、`*.module.less`。
- src/array：数组 Setter，支持多字段列、增删行、最小/最大条数限制等，是目前交互最复杂的 Setter。
- src/enum-image-model：带图片与标签的枚举 Setter，用于模型等带视觉信息的下拉选择。
- .storybook/：本包 Storybook 配置（main.js、preview.js），用于本地开发调试各 Setter。

## 与上游/下游的关系与数据流
- 上游依赖：
  - @flowgram-adapter/free-layout-editor：负责渲染节点表单，并将 `SetterComponentProps.context` 传入各 Setter；Array Setter 中依赖其 context 的 node/meta 信息生成测试 id。
  - @coze-arch/coze-design：半 UI 体系，提供 `Input`、`TextArea`、`Switch`、`Select`、`IconButton` 等基础组件及图标。
- 下游使用方：
  - @coze-workflow/nodes：注册节点字段类型时会引用本包导出的 Setter 作为具体表单控件。
  - @coze-workflow/playground：在表单扩展层使用标准 Setter 渲染右侧配置面板。
- 数据流原则：
  - Setter 始终通过 `value` + `onChange` 受控；不得在内部维护真正的业务状态，只允许本地 UI 辅助状态（如 Array 的 `currentAddIndex`）。
  - 上游数据可能为 `null` 或 `undefined`，如 Array 需兜底为 `[]`（代码中使用 `value || []`）。
  - `readonly` 仅控制交互能力与样式，不对数据做额外变换。

## 关键组件模式
### 通用 Setter 类型（src/types.ts）
- `SetterProps<Value, CustomProps>`：定义所有 Setter 共同 props，包括：
  - `value?: Value`：当前值，允许为 undefined/null。
  - `onChange?: (value: Value) => void`：值变更回调，必须使用全量新值。
  - `readonly?: boolean`：只读模式，组件需显式处理禁用交互与样式。
  - `children?: React.ReactNode`：主要用于组合型 Setter（如 Array）渲染子 Setter。
  - `context?: SetterComponentProps['context']`：从 free-layout-editor 透传的上下文（节点、字段元信息等）。
  - `testId?: string`：测试专用标识，应在有必要定位输入框/按钮的场合接入。
- `Setter<Value, CustomOptions>`：所有导出 Setter 的函数类型定义。编写新 Setter 时务必使用本类型确保签名一致。

### 标量 Setter 示例
- String（src/string/string.tsx）：
  - 通过 @coze-arch/coze-design 的 `Input` 实现单行文本输入，支持 `placeholder`、`width`、`maxCount`、`textMode` 等配置（见 StringOptions）。
  - `textMode` 为只读纯文本展示模式，避免出现“禁用输入框”风格不符合场景的问题。
  - 当设置 `maxCount` 时，后缀区域会显示 `当前长度/上限`。
- Text（src/text/text.tsx）：
  - 使用 `TextArea` 实现多行文本输入，支持 `maxCount` 与宽度配置。
  - 与 String 一样通过 classnames 控制 readonly 样式。
- Number（src/number/number.tsx，未在此文件中展开）：
  - 一般约束为数值输入，可能基于 Input 或 NumberInput 搭建，遵循相同 Setter 模式。
- Boolean（src/boolean/boolean.tsx）：
  - 使用 `Switch` 实现布尔开关，完全受控于 `value`，禁用态由 `readonly` 决定。
- Enum（src/enum/enum.tsx）：
  - 使用 `Select` 实现下拉选择，`options` 类型在 `src/enum/types.ts` 中定义（包含 label/value/disabled 等）。
  - onChange 需显式转为 EnumValue 类型再回调。

### Array Setter（src/array/array.tsx）
- 主要功能：
  - 渲染一组行，每行通过 children 渲染一个或多个子 Setter；
  - 支持新增/删除行、最大/最小条数限制、是否允许单行删除、默认追加值策略；
  - 支持在表头显示列标题（通过 `fields: Field[]` 配置）；
  - 使用 ArraySetterItemContext 提供当前行索引及最近一次新增位置给子组件使用。
- 关键 props：
  - `disableAdd`：是否禁止新增条目；
  - `getDefaultAppendValue`：新增一行时的默认值函数，若未传则默认 `{}`；
  - `maxItems`/`minItems`：条目数上下限，默认上限为 `Number.MAX_SAFE_INTEGER`，下限为 0；
  - `disableDeleteItem`：可以是布尔或函数，用于控制每行是否可删除，内部通过 `calcShowDeleteButton` 组合全局开关与逐行限制；
  - `fields`：用于生成表头列及右侧删除列宽。
- 交互要点：
  - 新增按钮显示条件：非 readonly、未 disableAdd、当前长度 < maxItems；
  - 删除按钮显示条件：非 readonly、当前长度 > minItems 且 `disableDeleteItem` 不禁止；
  - 删除/新增操作都必须通过复制数组 + splice/push 再调用 onChange，避免直接修改原引用。
  - `context` 中的 node/meta 被用于构造 `data-testid`，变更时需谨慎保持兼容性。

### EnumImageModel Setter（src/enum-image-model）
- 提供带图标/缩略图的模型选择能力，内部文件包括：
  - `enum-image-model.tsx`：主体组件，实现下拉或面板式选择；
  - `enum-image-model-label.tsx`：用于在下拉菜单和已选值处展示图文标签；
  - `types.ts`：定义包含模型 id、名称、图片 url、描述等的选项结构。
- 常用于工作流中选择 LLM 模型或图片模型，调用方需要自行传入选项列表及国际化文案。

## 本包特有的开发与运行流程
- 依赖安装统一在仓库根目录执行：
  - `rush update`：安装/更新所有子包依赖。
- 进入本子包目录后，常用命令：
  - `npm run dev`：启动 Storybook（端口 6006），用于交互式开发和调试各 Setter。Story 入口位于各组件目录的 `index.stories.tsx` 中。
  - `npm run test`：使用 Vitest 运行单元测试，测试文件通常为 `index.test.tsx` 等。
  - `npm run test:cov`：在 test 基础上输出覆盖率报告。
  - `npm run lint`：使用 @coze-arch/eslint-config 检查本包 TS/TSX 代码。
  - `npm run build`：当前实现为 `exit 0`，仅用于 Rush 流程占位；真实打包通常由上游工具统一处理。
- Storybook 配置在 [.storybook/main.js](frontend/packages/workflow/setters/.storybook/main.js) 与 [.storybook/preview.js](frontend/packages/workflow/setters/.storybook/preview.js) 中，扩展/新增 stories 时应保持与现有配置兼容。

## 工程与代码风格约定
- TypeScript：
  - 本包 tsconfig 继承自工作区 @coze-arch/ts-config，并通过 tsconfig.json 中的 `paths` 将 `@/*` 指向本包 `src/*`，但当前代码主要使用相对路径；新增文件时可按现有风格继续使用相对导入。
  - 禁止在 Setter 外暴露 any；必要时可在内部用 `any`（如 Array 的默认追加值），但对外类型需明确（Options/Value）。
- 命名：
  - 组件名与目录保持一致，采用大写驼峰（String、Number、Text、Boolean、Enum、Array、EnumImageModel）。
  - Options 类型命名形如 `XxxOptions`，与组件一同从 `src/index.ts` 导出，方便调用方类型推导。
- 样式：
  - 使用 `*.module.less` + CSS Modules，类名统一通过 `styles.xxx` 或 `styles['xxx']` 引用。
  - 只读样式统一命名为 `.readonly` 或 `text-mode` 等有语义的类名，避免直接写内联颜色。
- 依赖：
  - UI 组件必须优先使用 @coze-arch/coze-design，而不是直接依赖 @douyinfe/semi-ui，保证主题统一；
  - 若需要图标，优先从 `@coze-arch/coze-design/icons` 引入（如 Array 使用 IconCozPlus/IconCozMinus）。

## 测试与 Story 约定
- 单元测试：
  - 使用 Vitest + @testing-library/react，对外行为进行黑盒测试，文件通常置于同目录的 `index.test.tsx`。
  - 常见断言包括：受控行为（输入变更是否触发 onChange）、readonly 是否禁用交互、选项列表渲染是否正确。
- Storybook：
  - 每个 Setter 目录下有对应 `index.stories.tsx`，Story 标题遵循 `workflow setters/<ComponentName>` 格式，保障在 Storybook 侧边栏中分组一致。
  - 新增 Setter 时务必补齐基础 story 以便设计与产品联调。

## 与工作流整体的协同点
- 与 @coze-workflow/base：
  - base 层处理节点运行与数据结构，本包只负责表单录入，不应在内部依赖 base 的运行逻辑；二者通过 free-layout-editor 的节点配置协议解耦。
- 与 @coze-workflow/nodes：
  - nodes 包在定义节点 schema 时会指定字段使用何种 Setter（例如 String、Enum、Array 嵌套等）；新增 Setter 通常需要在 nodes 中注册对应的字段类型/渲染策略。
- 与 @coze-workflow/playground：
  - playground 中的 `form-extensions/setters` 会适配业务需求到标准 Setter；修改本包的公共接口（如 SetterProps、Options 字段）需同步检查相关适配层代码。

## 团队流程与注意事项
- 分支与发布（从 Rush 工作区惯例推断）：
  - 本包 version 为 0.0.1，作为内部库由 Rush 统一管理版本与构建流程；
  - 如需对外发布，需要配合上层 `@coze-workflow/playground` 与 `@coze-studio/app` 做联动测试（Story 及集成测试）。
- 修改注意事项：
  - 避免在 Setter 内部依赖运行时环境（如 window、document）或后端接口，保证在 Storybook、测试环境和工作流宿主中都可运行；
  - 变更 `Setter` 类型或 props 时，优先保持向后兼容，必要时通过可选属性扩展，而非修改现有字段语义；
  - 调整 Array/EnumImageModel 等核心 Setter 的行为时，请同时更新：
    - 对应 story，用于演示新交互；
    - 对应测试用例，覆盖新增逻辑与边界情况；
    - playground 中依赖这些 Setter 的桥接代码（若行为语义发生变化）。
