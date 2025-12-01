# @coze-arch/postcss-config

本说明用于指导 AI 编程助手在本子包（frontend/config/postcss-config）中安全、高效地协作开发。

## 全局架构与设计意图

- 本子包是一个“配置即库”的 PostCSS 共享配置，主要用于前端各应用的构建链路中统一 CSS 处理能力。
- 核心导出位于 src/index.js，直接导出 PostCSS 配置对象 `{ plugins: { ... } }`，供 postcss-loader、Vite、Rsbuild 等读取。
- 插件组合强调与 Tailwind CSS 的深度集成及现代 CSS 语法兼容：按顺序依次处理 import、嵌套、Tailwind、自动补前缀和 :is() 兼容。
- 该包本身无编译产物与复杂运行时代码，更多是“约定集合”，在整个 monorepo 中作为基础构建能力被消费。

## 目录结构与关键文件

- src/index.js：唯一的运行时代码，导出 PostCSS 配置。
- package.json：声明依赖、脚本与入口 main=src/index.js；scripts 中的 build/test 目前为占位，实际构建依赖上游工具（如 rush）。
- eslint.config.js：通过 @coze-arch/eslint-config 统一 Node 侧代码风格与规则。
- config/rush-project.json：声明对 "ts-check" 操作的 dist 输出目录，用于 Rush 构建管线中缓存与增量控制。
- README.md：对外文档，说明功能、用法以及与各构建工具（Webpack/Vite/Rsbuild）的集成方式，是行为真相的重要来源。

## PostCSS 配置与数据流

- 配置对象结构：
  - `plugins['postcss-import']`: 处理 `@import` 并内联 CSS，用于统一依赖追踪与打包。
  - `plugins['tailwindcss/nesting'] = 'postcss-nesting'`: 声明 Tailwind 嵌套插件使用 postcss-nesting 实现，确保嵌套语法与 Tailwind 指令兼容。
  - `plugins.tailwindcss = {}`: 让 Tailwind 按项目根目录的 tailwind.config.* 解析指令和原子类。
  - `plugins.autoprefixer = {}`: 自动根据 browserslist 为 CSS 属性加前缀。
  - `plugins['@csstools/postcss-is-pseudo-class'] = {}`: 降级/兼容 :is() 伪类，保证老浏览器表现。
- 外部应用的数据流：
  - 构建工具（Webpack/Vite/Rsbuild 等）在 CSS 处理阶段调用本包导出的配置对象，作为 PostCSS 插件流水线。
  - 单个业务项目可以通过 `require('@coze-arch/postcss-config')` 直接采用，也可以在本配置基础上扩展或重排插件顺序。

## 开发与构建工作流

- 常规开发操作：
  - 本包代码极少，主要工作为调整 PostCSS 插件集合或顺序，及更新 README.md 说明。
  - 所有脚本需通过顶层 Rush 调度运行；在本子包目录中单独执行 npm 脚本通常不是主路径，仅用于本地调试。
- 本地脚本（package.json）：
  - `lint`: `eslint ./ --cache --quiet`，基于 @coze-arch/eslint-config 的 Node 预设，对 src 与配置文件进行检查。
  - `build`, `test`, `test:cov`: 当前实现为 `exit` 占位，不做实际工作，表示该包无独立构建/测试流水线。
- Rush 相关：
  - [config/rush-project.json](config/rush-project.json) 将 "ts-check" 操作的输出目录标记为 dist，用于 monorepo 级别的构建缓存；本子包并未实际生成 TS 产物，但需要与其他包保持统一配置形态。

## 代码与配置约定

- 语言与风格：
  - 运行时代码使用 CommonJS（require / module.exports），以契合 Node 构建环境与 postcss-loader 典型用法。
  - 保持配置对象扁平、可序列化，不引入运行时依赖逻辑或异步计算，避免在构建阶段产生副作用。
- 插件顺序约定：
  - 先 import，再 nesting，再 Tailwind，再 autoprefixer，最后 :is() 兼容插件；任何调整都需评估对 CSS 生成顺序的影响，并在 README.md 中说明。
  - Tailwind 相关插件需保持与 monorepo 其它 CSS 方案一致，以防某些子应用出现样式差异。
- 扩展方式：
  - 业务项目如需新增 postcss 插件，应在自身的 postcss.config.* 中扩展本配置，而非直接修改本子包，除非要为所有项目统一变更。
  - README.md 中的「Adding Custom Plugins」「Plugin Order Customization」段落展示了推荐的扩展模式，修改行为时优先遵循这些示例。

## 外部依赖与集成细节

- 核心依赖：
  - postcss / postcss-import / postcss-nesting / @tailwindcss/nesting / postcss-loader：共同构成 CSS 预处理与打包能力。
  - @csstools/postcss-is-pseudo-class：增强 :is() 伪类在非现代浏览器中的兼容性。
- 内部共享依赖：
  - @coze-arch/eslint-config：通过 eslint.config.js 的 defineConfig(preset: 'node') 引入统一的 lint 配置。
  - @coze-arch/ts-config：虽无 TS 源码，但在 tsconfig.*.json 中统一类型检查与编辑器智能提示设置。
- 构建工具集成模式（按 README.md）：
  - Webpack：通过 postcss-loader 自动读取项目根目录的 postcss.config.js；该文件通常简单 require 本包。
  - Vite：在 vite.config.js 中通过 css.postcss 传入本配置对象。
  - Rsbuild：通过 tools.postcss 传入本配置对象。

## 项目流程与协作规范

- 变更原则：
  - 任何影响 CSS 生成结果的插件变更（新增/删除/重排）需同时更新 README.md 中的 Default Configuration 与 Plugin Details，保持文档与实际行为一致。
  - 修改后建议在至少一个真实前端应用中进行试构建与视觉验收，确保兼容性符合预期。
- 版本与发布：
  - 当前版本号为 0.0.1，发布与版本策略遵循 monorepo 顶层 Rush/变更日志流程（在此文件中不重复描述）。
- 分支与提交：
  - 遵循仓库全局的分支命名与代码评审规则；本子包无独立的分支策略配置，默认依赖上层规范。

## 适用于 AI 助手的实践建议

- 在修改 src/index.js 时：
  - 保持导出为单一配置对象，不引入函数式工厂或动态分支，除非事实代码已经采用该模式。
  - 任何插件键名或加载方式的变更都要检查 README.md 中相关示例，保持示例代码可直接运行。
- 在新增/调整依赖时：
  - 仅引入与 PostCSS 及其生态直接相关的包，避免在此配置包中耦合非构建相关逻辑。
  - 对运行时依赖的版本变更，要留意与下游构建工具版本（尤其是 postcss-loader、Vite、Webpack）的兼容矩阵。
- 在辅助用户调试时：
  - 优先检查业务项目的 postcss.config.* 是否正确 `require('@coze-arch/postcss-config')`，以及 Tailwind 与 browserslist 配置是否符合预期。
  - 如遇到 CSS 生成异常，可通过从 README.md 中的示例临时创建最小复现配置，再逐步缩小问题范围。
