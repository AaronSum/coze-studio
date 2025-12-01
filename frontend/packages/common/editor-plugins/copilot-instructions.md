# @coze-common/editor-plugins 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/common/editor-plugins）中安全、高效地协作开发。

## 全局架构概览
- 子包定位：本包是基于 `@coze-editor/editor` 的前端编辑器插件集合，面向 Coze Studio 前端整体架构，为富文本/代码编辑器提供主题、语言支持、语法高亮、表达式能力、输入插槽、库插入等扩展能力。
- 导出结构：通过 `package.json` 的 `exports` 显式导出多个子模块：`theme`、`types`、`input-slot`、`library-insert`、`library-variable-insert`、`language-support`、`syntax-highlight`、`expression`、`action-bar`、`actions` 等；默认入口为 `src/index.tsx`，目前仅转出 `Extension` 类型。
- 上游依赖：依赖 `@coze-editor/editor` 作为编辑器内核，使用 CodeMirror v6（`@codemirror/language/state/view`、`@lezer/common`）实现文本模型和语法高亮；UI 和交互依赖 `@coze-arch/coze-design` 以及 `@coze-arch/i18n` 等工作空间包。
- 使用场景：通常由上层应用（如 `frontend/apps/coze-studio`）或其他包通过 workspace 依赖引入，对编辑器实例进行插件化配置，添加工具栏按钮、右侧操作栏、输入插槽、变量/库选择弹层等功能。
- 目录划分：
  - `src/actions/`：编辑器动作封装（如复制、插入输入槽等），面向外部暴露可组合的 action API。
  - `src/action-bar/`：编辑器操作栏 UI 及与 actions 的组合（目录存在但此处不展开具体实现）。
  - `src/input-slot/`：输入槽相关的配置、弹层、挂件和 hooks。
  - `src/library-insert/`、`src/library-variable-insert/`：库/变量插入能力及相关组件。
  - `src/language-support/`、`src/syntax-highlight/`：语言配置、语法高亮与 CodeMirror 扩展。
  - `src/expression/`：表达式解析/编辑相关能力。
  - `src/theme/`：编辑器主题/样式扩展。
  - `src/shared/`：通用 hooks 与工具函数（`hooks/`、`utils/`）。

## 源码结构与关键模块
- 根文件
  - `src/index.tsx`：包的主入口，目前主要导出 `Extension` 类型；未来如需新增统一注册函数，应从此文件向外暴露，保持对外 API 收敛。
  - `src/types.ts`：统一定义对外通用类型：
    - `Extension`：允许嵌套的扩展声明（单个、对象包裹、只读数组等），与 `@coze-editor/editor` 的扩展机制兼容；新增编辑器插件类型时应考虑复用或扩展此类型，而不是各自定义不兼容的 shape。
    - `SelectionInfo`：抽象编辑器选区信息（`from/to/anchor/head`），是多个子模块共享的 selection 结构，涉及光标范围/多光标要统一此类型。
- actions
  - 目录：`src/actions/` 下按功能再拆分（如 `copy/`、`insert-input-slot/`），`src/actions/index.ts` 作为对外整理入口。
  - 典型职责：封装对编辑器实例的操作（插入文本、复制节点、打开弹层等），供 action-bar、快捷键或上层业务调用；实现时遵循「无副作用 UI，纯逻辑操作 editor 状态」优先。
- input-slot
  - 目录：`src/input-slot/`，包含 `action/`、`hooks/`、`input-config-popover/`、`input-slot-widget/` 等；`index.ts` 作为聚合出口。
  - 角色：提供在编辑区域中插入“输入槽”的能力（例如参数占位、变量位点），包括：
    - 行为：插入/删除/定位输入槽的 actions 和 hooks。
    - 视图：配置弹层（config popover）、实际在文档中渲染的 widget。
  - 约定：input-slot 相关组件和逻辑不直接依赖上层业务，只依赖编辑器模型和通用 UI 组件；业务定制通过外部 props / 配置注入。
- library-insert & library-variable-insert
  - `src/library-insert/`：负责通用“从资源库插入内容”的能力，目录包含 `assets/`、`hooks/`、`library-block-widget/`、`library-search-popover/`、`types.ts`、`utils/`，通过组合搜索弹层 + widget 渲染实现。
  - `src/library-variable-insert/`：专注“变量库”插入，结构相对轻量（`content-search-popover/`、`types.ts` 等）；适配上游数据形态（变量列表、命名空间等）。
  - 通用模式：
    - 数据获取与搜索逻辑写在 hooks/ 或 utils 中，便于单测与复用。
    - 视觉与交互组件拆在 `*-popover/`、`*-widget/` 目录中，做到「逻辑和 UI 解耦」。
- language-support & syntax-highlight
  - 基于 CodeMirror v6 的 `@codemirror/language/state/view` 与 `@lezer/common`。
  - 封装语言包（语言模式、补全、诊断）与高亮主题，在本子包抽象，供上游仅通过简化的注册接口使用，而不需要直接操作 CodeMirror 原始 API。
- expression
  - 提供表达式相关的高亮、校验或编辑辅助（具体实现见 `src/expression/` 下代码）。
  - 要求与 `@coze-arch/idl`、`@coze-arch/bot-api` 等协议包对齐，避免自行造语义模型。
- theme
  - 目录：`src/theme/`；对 `@coze-arch/coze-design` 的视觉体系做编辑器层复用（如字体、色板、交互态等）。
  - 新增主题时，应以可组合的配置导出，而非硬编码到各业务插件中。

## 开发与构建流程
- 本子包不单独启动 dev server，通常通过上层应用引用使用；如确需独立调试 UI，可参考根 README 中的 `npm run dev`（如在 storybook 或示例应用内）。
- 常用脚本（在 `frontend/packages/common/editor-plugins` 目录下执行）：
  - 安装依赖：在 monorepo 根目录运行 `rush install` / `rush update`，本包依赖由 Rush+PNPM 统一管理。
  - Lint：`npm run lint`（等价 `eslint ./ --cache`），需遵守 `@coze-arch/eslint-config` 规则。
  - 单测：`npm run test`（`vitest --run --passWithNoTests`）；新增模块时尽量为 hooks 和纯函数在 `__tests__/` 下添加 Vitest 用例。
  - 覆盖率：`npm run test:cov`。
  - Build：当前 `package.json` 中 `build` 脚本为 `exit 0`，表示本子包自身不参与独立产物打包，依赖上层构建系统（Rsbuild / 应用 bundler）按源码消费。
- 测试与运行环境：
  - Node 版本、Rush/PNPM 版本遵循 `frontend/README.md`；
  - 测试工具链使用 monorepo 共享配置：`@coze-arch/vitest-config`、`@coze-arch/ts-config`、`@coze-arch/eslint-config` 等。

## 项目约定与风格
- TypeScript & React
  - 本包使用 TS + React 18，严格遵守工作区 TS 配置（见 `tsconfig.json`、`tsconfig.build.json`、`tsconfig.misc.json`）。
  - 对外 API 尽量通过类型导出而非运行时对象（如 `Extension`、`SelectionInfo`）。
- 目录命名
  - 功能模块以中划线命名（如 `input-slot`、`library-insert`）；
  - UI 组件与弹层以 `*-widget`、`*-popover` 命名；
  - 逻辑复用以 `hooks/`、`utils/` 目录承载。
- 样式与 UI
  - 依赖 `@coze-arch/coze-design` 和 Tailwind 配置（`tailwind.config.ts`），注意不要在本包中引入与全局主题冲突的 reset 或全局样式；
  - 若需要新增样式，倾向以局部 className + 设计体系变量实现，不直接写死颜色/间距 magic number。
- 国际化
  - 国际化能力通过 `@coze-arch/i18n` 实现；新文案需遵循上层 i18n key 约定，不在本包写死多语言字符串映射表（除非是纯本地提示且不会被业务翻译系统接管）。

## 与外部系统的集成
- 编辑器内核：
  - 所有对编辑器实例的操作应通过 `@coze-editor/editor` 提供的标准接口实现；避免直接操作 DOM，除非是 CodeMirror 扩展或 widget 渲染的必要场景。
  - 插件输出应以 Extension 形式与编辑器主实例组合，而不是在业务侧重新创建 Editor 对象。
- 业务协议与数据：
  - 涉及 Bot 或 workflow 业务时，通过 `@coze-arch/bot-api`、`@coze-arch/idl`、`@coze-arch/bot-typings` 等协议/类型包获取类型定义，不在本包重复定义字段结构。
  - 变量、库内容等数据源通常由上层通过 props 或 context 注入，本包不直接发起网络请求。
- UI 生态：
  - 按需使用 `@coze-arch/coze-design` 组件库（如弹层、按钮、列表）；保持风格统一和交互一致。

## 开发流程与协作规范
- 代码组织
  - 新增插件/能力时优先考虑是否属于已有模块（如 input-slot、library-insert），避免在 `src/` 根目录创建过多平级文件。
  - 公共逻辑抽离到 `src/shared/` 下的 hooks 或 utils 中；如被多个插件共用，应在此集中维护。
- 分支与提交
  - 全局仓库遵循主仓库约定（见根级贡献文档），在本子包内不要增加额外分支策略；AI 助手在生成说明/提交信息时应保持简短且围绕单一改动。
- 依赖管理
  - 新增第三方依赖前，应优先查找 `frontend/config`、`frontend/infra`、`frontend/packages` 中是否已有统一封装；
  - 所有依赖使用 `workspace:*` 或版本号写入根 Rush/PNPM 管理，禁止在本包中直接使用 `npm install` 写死本地 node_modules 状态。

## 特殊注意事项
- `build` 脚本为 no-op：构建过程依赖上层应用和 Rsbuild，不要在此包中增加复杂 bundling 逻辑，以免与 monorepo 构建流水线冲突。
- CodeMirror 版本：本包锁定 CodeMirror v6 相关依赖版本（见 `package.json`），编写扩展/插件时务必参考对应大版本文档，避免使用 v5 旧 API。
- 类型导出兼容：`typesVersions` 已对 TS 路径进行了适配（`theme`、`language-support`、`syntax-highlight` 等），新增导出时需同步更新 `package.json` 中的 `exports` 与 `typesVersions`，以保证编辑器/IDE 友好性。
- 测试要求：对于复杂 hooks（如搜索、过滤、选区计算）和纯函数，建议在 `__tests__` 下以 Vitest + React Testing Library 编写用例，确保行为在编辑器内核升级时可被回归。
