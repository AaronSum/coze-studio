# @coze-workflow/test-run-form · Copilot Instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/workflow/test-run-next/form）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包提供「工作流测试运行表单」能力，对外暴露统一入口：src/index.ts，聚合导出表单引擎（form-engine）、UI 组件（components）、全局表单状态（context）、工具方法（utils）以及常量（constants）。
- 核心分层：
  - form-engine：基于 @flowgram-adapter/free-layout-editor 的表单引擎封装，负责表单 Schema/Field 的抽象、渲染策略及 hooks。
  - components：具象 UI 组件层，包含 TestRunForm 容器、基础表单物料（base-form-materials）、业务表单物料（form-materials）。
  - context：使用 zustand + React Context 管理单个测试表单的全局状态（schema、模式等）。
  - utils：围绕表单 Schema/值的生成、校验器构造、空属性判定、后端数据序列化等工具函数。
  - constants：与测试表单字段名相关的枚举/常量集合，用于保持调用方与本包之间的强约束。
- 数据流概览：
  - 业务侧构造 IFormSchema（通常来自工作流节点配置或 Playground 的模型生成），通过 TestRunForm 传入。
  - TestRunForm 使用 useCreateForm（封装自 form-engine/hooks）创建控制器 control 和运行时 FormSchema；底层依赖 @flowgram-adapter/free-layout-editor 的 FormModel。
  - createSchemaField 根据传入的组件映射（FormSchemaReactComponents）和 Schema 递归渲染字段：fields/* 负责不同字段类型（对象、普通字段、递归节点等）的渲染策略；shared/* 提供 Schema 上下文与通用数据结构。
  - 表单值和字段 UI 状态由 free-layout-editor 内部维护；本子包主要负责声明式 Schema 到 UI 的绑定与扩展。
  - TestRunFormProvider + useTestRunFormStore 在更外层聚合一个「当前测试运行」上下文，用于在多组件间共享 schema / 模式（form/json）等状态。
- 结构设计动机：
  - form-engine 尽量与业务解耦，偏通用 Schema 表单引擎；具体物料与业务场景放在 components 与 utils。
  - 通过 workspace:* 依赖与 @coze-workflow/base / components / test-run-shared 组合，作为 workflow/test-run-next 整体的一部分，被 main 子包引入（见 ../main/src/index.ts）。

## 开发/构建/测试工作流

- 构建：
  - package.json 中 scripts.build = "exit 0"；本子包当前不在自身目录执行真实构建流程，通常依赖上层 rush / FE 总构建（例如在仓库根或 frontend 下执行 rush build / rushx 相关命令）。
  - AI 助手在本子包内无需新增自定义构建命令，保持与 monorepo 统一流程即可。
- Lint：
  - 运行：在本包根目录执行 `pnpm lint` 或 `rushx lint` 等方式均会调用 `eslint ./ --cache`。
  - 配置：使用根级 @coze-arch/eslint-config，局部规则在 eslint.config.js 中（如需修改风格/规则，请优先查阅该文件）。
- 测试：
  - 命令：`pnpm test` / `rushx test` 映射到 `vitest run --passWithNoTests`；`pnpm test:cov` 额外开启 coverage。
  - 配置：vitest.config.ts 使用 @coze-arch/vitest-config.defineConfig，preset: 'web'，并通过 test.setupFiles = ['./__tests__/setup.tsx'] 统一注册 React 测试环境（如 JSDOM、全局组件包装等）。
  - 测试结构：
    - __tests__/components：组件级测试。
    - __tests__/utils：工具函数测试。
    - 测试文件命名遵循 Vitest 默认约定（如 *.test.ts(x) / *.spec.ts(x) 等）。
- 调试：
  - 由于 TestRunForm 严重依赖 @flowgram-adapter/free-layout-editor 和 workflow/playground 侧的生成逻辑，交互调试通常在 playground 或 main app 中进行，而不是直接在本包单独启动应用。
  - 开发/调试新字段时，建议：
    - 在 src/form-engine/fields 中新增或扩展字段渲染逻辑。
    - 在 src/components/form-materials 中增加对应的可视化组件。
    - 通过 playground（frontend/packages/workflow/playground）中的测试表单视图进行联调。

## 项目内约定与模式

- 导出聚合模式：
  - 所有对外 API 统一从 src/index.ts 再导出，不建议直接从深层路径 import（避免未来内部重构时破坏外部依赖）。
  - index.ts 将 API 按功能分块注释（Form Engine / components / context / utils / constants），新增导出时请遵循该结构。
- 表单引擎封装：
  - form-engine/index.ts 只暴露：
    - createSchemaField：接受 { components } 映射，返回一个 SchemaField 组件，用于递归渲染 Schema 描述的表单。
    - FormSchema：运行时 FormSchema 类/对象，用于控制/遍历/操作 Schema。
    - Hooks：useCreateForm、useFieldSchema、useFormSchema；所有对表单 Schema 的操作应优先通过这些 hooks，而不是在外层组件手动操作内部数据结构。
    - 类型：IFormSchema、IFormSchemaValidate、FormSchemaReactComponents 用于描述 Schema 结构、校验接口以及组件映射类型约束。
    - 直接 re-export @flowgram-adapter/free-layout-editor 的 useForm / useCurrentFieldState / FormModel；调用方如果需深入操作底层编辑器，可通过这些 API 获取更细粒度能力。
- 组件与物料约定：
  - TestRunForm（src/components/test-run-form/test-run-form.tsx）是主要对外 React 组件：
    - 默认组件映射为：InputString / InputNumber / InputInteger / InputTime / InputJson / SelectBoolean / SelectVoice / FieldItem（均来自 form-materials）。
    - 可通过 props.components 覆盖或扩展 FormSchemaReactComponents（高级用法，通常在业务侧自定义物料时使用）。
    - 支持 onFormValuesChange（表单值变更通知）和 onMounted（表单模型初始化完成回调）。
  - base-form-materials 目录暴露 FormBaseInputJson / FormBaseGroupCollapse / FormBaseFieldItem 等基础组件，用于外部以统一样式构建复合 UI。
- 全局表单状态管理：
  - context/form.tsx 使用 zustand + React Context 管理 TestRunFormState：
    - 字段：schema（当前使用的 IFormSchema）、mode（'form' | 'json'）、patch（浅合并更新）、getSchema（获取最新 schema）。
    - TestRunFormProvider 使用 ref 缓存 store，保证单例且避免重复初始化；在 Provider 作用域内通过 useTestRunFormStore(selector) 获取切片状态。
  - 只在有跨组件共享需求时才向外暴露/使用 TestRunFormProvider；简单场景可直接使用 TestRunForm，而无需显式依赖 context。
- 工具函数与数据协议：
  - utils/generate-field*.ts：根据 Schema 生成字段配置/组件，或构造字段级校验器；在扩展字段类型时应同时更新生成逻辑与校验规则。
  - utils/is-property-empty.ts：判断 Schema 属性是否为空（用于裁剪、占位或 UI 显示逻辑），编写新逻辑时尽量复用该工具，避免散落的“空判断”策略。
  - utils/stringify-form-values-from-backed.ts：将后端返回的字段值序列化为前端表单可用形式；新增/调整字段类型时需确认该函数是否需要一起更新，以防止生产环境数据不兼容。
- 常量：
  - constants/TestFormFieldName：统一声明测试表单涉及的字段名，所有对字段 key 的读写应尽量引用该常量而非硬编码字符串，以减少跨包重构的成本。

## 外部依赖与集成细节

- 与 @flowgram-adapter/free-layout-editor 的集成：
  - 本包并不实现底层表单控件/布局引擎，而是封装在 free-layout-editor 之上：
    - TestRunForm 内部 `<Form control={control}>` 即来自该包。
    - useCreateForm 返回的 control / formSchema 与 free-layout-editor 的表单模型兼容。
    - form-engine/index.ts 通过 `export { useForm, useCurrentFieldState, type FormModel }` 暴露原始 hooks 与类型。
  - 修改或扩展 form-engine 时必须保持与 free-layout-editor 的类型契约一致；若类型不兼容，会在本包 TS 编译阶段或上层集成时暴露问题。
- 与 workflow/test-run-next main 子包的集成：
  - main 子包在其 src/index.ts 中从 '@coze-workflow/test-run-form' 引入 TestRunForm 及相关导出，组合形成完整的「测试运行体验」界面。
  - 本包的 API 变更（尤其导出名、类型签名）应与 main 子包保持同步更新，必要时先搜索 main 包和 playground 中的引用再重构。
- 与 workflow/playground 的关系：
  - playground 下的 test-form-v3 等模块使用 TestRunFormModel、Mode hooks 等逻辑驱动物料和 Schema；这些逻辑虽然不在本子包中，但高度依赖 IFormSchema / TestFormFieldName 等接口契约。
  - 在调整 Schema 结构或字段命名时，需要一起检查 playground 的生成逻辑。
- 设计体系与 i18n：
  - UI 组件依赖 @coze-arch/coze-design 作为基础设计体系，同时通过 @coze-arch/i18n 在上层实现多语言；本包内部一般只使用抽象后的组件和文案 key，不直接操作原始 i18n 实现。

## 项目流程与协作规范

- 分支与提交流程：
  - 本仓库使用 rush 管理前端 monorepo，通常在 feature 分支上修改相应子包，并通过 rush change / rush version 等命令管理版本（具体细节参考仓库根 README / 前端目录下说明文件）。
  - 修改本子包时，应同步更新 README.md 中的 API 说明（尤其新增导出或重大行为变更）。
- 类型与兼容性：
  - 所有导出 API（组件、hooks、工具函数）都应具备完整的 TypeScript 类型标注；新增方法时先在 form-engine/types 或本目录类型定义中补全类型，再实现逻辑。
  - 为避免破坏主应用/Playground，在变更公共类型（如 IFormSchema）前必须全局搜索引用并评估影响范围。
- 测试与质量：
  - 为核心逻辑（如 generate-field / stringify-form-values-from-backed / context store）补充单元测试，放置在 __tests__ 对应目录下；保持与现有测试文件命名/结构一致。
  - 对于需要在浏览器环境验证的复杂交互，优先在 workflow/playground 中添加演示/回归场景，而不是在本包增加临时 demo 代码。

## 本项目的特殊点与注意事项

- build 脚本是 no-op：本包本地 `pnpm build` 实际不做任何事，构建行为完全依赖 monorepo 顶层流程；AI 助手不要在这里私自引入复杂打包逻辑，以免与整体构建体系冲突。
- 强依赖外部引擎：表单行为的很大一部分由 @flowgram-adapter/free-layout-editor 决定；在阅读/修改逻辑时要意识到：
  - 本包更多是“桥接层”和“物料层”，不要在这里重复实现底层表单能力。
  - 错误行为有时来自上游引擎或 playground 的 Schema 生成，而非本包本身，需要联动排查。
- Zustand store 的使用方式：
  - TestRunFormProvider 使用 createWithEqualityFn + shallow 比较，调用 useTestRunFormStore 时务必传入 selector，避免导致全局重渲染。
  - 不要在没有 Provider 包裹的情况下调用 useTestRunFormStore，否则会因为上下文为占位值而产生运行时错误。
- Schema 中心：
  - IFormSchema / FormSchema 是贯穿整个包的核心数据结构，所有新的能力（字段类型、校验规则、序列化逻辑）都应围绕这套 Schema 设计扩展，而不是另起一套并行的数据模型。
- Workspace 链接：
  - 许多依赖使用 "workspace:*"，意味着它们在同一 monorepo 下协同开发；修改类型/导出时，AI 助手要意识到跨包联动影响，必要时在整个 frontend/packages/workflow 下搜索引用后再重构。
