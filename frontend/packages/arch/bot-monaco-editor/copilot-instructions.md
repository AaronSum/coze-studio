# bot-monaco-editor 子包协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-monaco-editor）中安全、高效地协作开发。

## 1. 全局架构与角色定位

- 本子包提供基于 Monaco Editor 的 React 封装组件，供上层 Bot/IDE 场景复用，路径为 frontend/packages/arch/bot-monaco-editor。
- 对外导出三个入口：
  - index.tsx：懒加载版本的 Editor / DiffEditor 组件（首选使用）。
  - loader.ts：独立的 loader 工具，用于在应用启动时手动初始化 Monaco。
  - types.ts：统一暴露 Monaco 相关类型，避免业务直接依赖底层库类型路径。
- 数据流与依赖关系：
  - 业务代码从本包引入 Editor/DiffEditor 组件和类型；
  - 组件内部通过 loader.config() 注入 monaco-editor 实例，并使用 @monaco-editor/react 提供的 React 包装组件；
  - 懒加载采用 React.lazy + Suspense，在首次渲染时异步加载 monaco-editor 相关代码，降低主包初始体积。
- 架构目标：
  - 提供一个统一、可配置、可惰性加载的 Monaco Editor 封装层，减少各业务对子依赖（monaco-editor/@monaco-editor/react）的直接绑定。

## 2. 目录结构概览

- src/index.tsx
  - 默认导出 Editor、DiffEditor 两个 React 组件。
  - 使用 React.lazy + Suspense 延迟加载 ./monaco-editor，并在加载前调用 loader.config() 完成 Monaco 的配置。
- src/monaco-editor.ts
  - 对 @monaco-editor/react 的 Editor 默认组件与 DiffEditor 命名导出进行简单 re-export，不做业务逻辑处理。
- src/loader.ts
  - 提供 loader.init() 与 loader.config(config?)：
    - 内部动态 import monaco-editor 以及 @monaco-editor/react 中的 loader。
    - 调用 load.config({ monaco, ...config }) 完成绑定，返回 load 供上层继续调用（例如 load.init()）。
  - 该模块是集中管理 monaco-editor 配置的唯一入口，避免在业务中直接重复配置。
- src/types.ts
  - 统一导出 monaco-editor 的 IRange、editor 命名空间；
  - 导出 @monaco-editor/react 的 Monaco、OnMount、EditorProps、DiffEditorProps；
  - 声明类型别名 MonacoEditor = typeof import('monaco-editor/esm/vs/editor/editor.api')，供需要完整 editor api 的场景使用。
- stories/demo.stories.tsx
  - Storybook 示例，演示 Editor / DiffEditor 的基本用法（宽高、语言、onMount 回调）。
  - 用于本地开发和手动验证，不直接参与生产构建。
- vitest.config.ts
  - 基于 @coze-arch/vitest-config.defineConfig，preset=web；测试行为遵循全局 Vitest 约定。
- tsconfig*.json
  - tsconfig.json 使用 composite + references 指向 tsconfig.build.json / tsconfig.misc.json，具体构建细节由工作空间统一管理。

## 3. 构建、开发与测试流程

- 包级命令（在 frontend/packages/arch/bot-monaco-editor 下执行）：
  - 开发：npm run dev
    - 启动 Storybook（storybook dev -p 6006），在浏览器中交互式调试 DemoComponent。
  - 构建：npm run build
    - 当前实现中脚本为 exit 0，实际产物构建依赖上层 Rush/rsbuild 体系；
    - AI 助手不要在本包私自重写构建逻辑，除非有明确指令，否则保持与全局构建体系一致。
  - 测试：npm run test
    - 执行 Vitest（vitest --run --passWithNoTests），主要用于单元测试与类型相关检查；
  - 测试覆盖率：npm run test:cov
    - 在 vitest 上加 --coverage 选项。
- 工作区级命令（从仓库根目录）：
  - 依赖安装和联调：rush update
    - 按 README.md 说明，初始化 / 更新 monorepo 依赖。
- 调试建议：
  - 组件行为调试推荐通过 Storybook 场景（stories/demo.stories.tsx）而非直接在业务应用中尝试，方便隔离问题。

## 4. 项目特有约定与模式

- 懒加载与初始化顺序：
  - src/index.tsx 中的 Editor / DiffEditor 必须在 loader.config() 完成后再渲染 monaco-editor 组件；
  - 任何新增入口组件，如 CustomEditor，必须沿用“先 loader.config，再 import('./monaco-editor')”的模式，避免在未完成绑定时创建 Monaco 实例。
- loader 使用约定：
  - loader.config(config?) 内部会自行 import monaco-editor，并将 monaco 实例透传给 @monaco-editor/react 的 loader；
  - 如果业务需要自定义主题、语言或 worker 配置，应通过传入 config 对象扩展，而不要在其他地方直接调用 @monaco-editor/react 的 loader.config；
  - 仅在此文件维护 Monaco 级别的全局配置，确保行为一致且易于追踪。
- 类型导出约定：
  - 新增对 monaco-editor 或 @monaco-editor/react 的类型暴露时，应集中添加到 src/types.ts，并通过 package.json 的 exports.types 映射给外部使用；
  - 业务代码优先从本包引入类型（例如 @coze-arch/bot-monaco-editor/types），而非直接从底层包 import。
- UI 与文案：
  - 懒加载占位组件为固定文案 "Loading Editor..."，如需国际化或自定义 loading，建议通过提供可配置 Fallback 组件的新入口而不是直接修改现有文案，以减少 breaking change。
- 代码风格与工具：
  - ESLint / Stylelint / TSConfig 全部继承自 @coze-arch 系列 workspace 配置，避免在本包单独定义差异化规则；
  - 保持现有的 import 顺序、TypeScript 严格配置及 no-explicit-any 规则（loader.ts 已显式局部禁用）。

## 5. 外部依赖与集成细节

- monaco-editor
  - 被 loader.ts 通过动态 import('monaco-editor') 加载，避免首屏包体膨胀；
  - 若需要扩展语言、主题或 worker 设置，应基于 loader.config 的 config 参数传入，而不是在业务中重复 import monaco-editor。
- @monaco-editor/react
  - 提供 React 组件 Editor / DiffEditor 以及 loader 对象；
  - monaco-editor.ts 只做简单 re-export，所有高级行为（懒加载、初始化顺序控制）都在 index.tsx + loader.ts 完成；
  - 若需要 onMount、beforeMount 等回调，使用 src/types.ts 中导出的 OnMount / Monaco 等类型保证一致。
- React 及 Storybook
  - peerDependencies 中要求 react/react-dom >= 18.2.0，业务侧需保证版本满足要求；
  - Storybook 仅用于本地演示和开发，不参与 runtime；确保在修改 DemoComponent 时不引入业务特定依赖。

## 6. 测试与示例规范

- 测试框架：
  - 使用 Vitest（统一配置于 @coze-arch/vitest-config），preset=web，适配浏览器环境；
  - __tests__ 目录用于存放单元测试文件，当前内容较少或空，AI 可在保持现有配置前提下补充针对 loader/index 的轻量测试。
- 示例（Storybook）：
  - stories/demo.stories.tsx 是权威使用示例：
    - 使用 OnMount 回调拿到 editor 实例并存入 ref；
    - 展示 Editor 与 DiffEditor 的基本属性（width/height/language/defaultValue/original/modified）。
  - 新增示例故事时，应继续从 ../src 导出组件和 ../src/types 中导出类型，避免耦合实现细节。

## 7. 变更建议与安全边界

- 可以安全进行的改动（优先）：
  - 在 src/types.ts 中增加对底层类型的 re-export，以满足新业务场景；
  - 在 stories 目录中增加更多演示用例，帮助验证新特性；
  - 在 loader.config 中增加可选配置项（通过 config 参数），但保持向后兼容默认行为。
- 需要谨慎或避免的改动：
  - 不要随意修改 loader.config 的调用时机或顺序，避免导致 Monaco 未正确初始化；
  - 不要在本包中引入与 Monaco 无关的复杂业务逻辑（保持为“纯 UI/编辑器封装层”）；
  - 构建脚本目前由上层统一管理，除非仓库内有明确规范更新，否则不要在 package.json 中重新定义复杂 build 流程。

## 8. 与仓库其他部分的关系

- 本包处于 arch 层（frontend/packages/arch），为上层 studio / agent-ide / data 等子包提供通用编辑器能力；
- 通过 workspace:* 依赖复用统一的 lint/test/tsconfig 配置，与其他 arch 包保持一致；
- 当其他子包需要 Monaco Editor 能力时，应优先依赖本包，而不是直接依赖 monaco-editor 或 @monaco-editor/react，以便集中管理升级和配置。
