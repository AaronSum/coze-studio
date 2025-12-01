# @coze-agent-ide/plugin-setting-adapter 开发协作说明（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/plugin-setting-adapter）中安全、高效地协作开发。

## 1. 子包定位与职责边界

- 包名：`@coze-agent-ide/plugin-setting-adapter`，位于 Agent IDE 相关前端子域下。
- 职责：为上层 Agent IDE / Studio 提供「插件设置（plugin-setting）」能力的适配层，将 `@coze-agent-ide/plugin-setting` 暴露的组件 / 能力包装为更易于集成的入口（例如在 IDE 面板、弹窗、详情页中使用）。
- 依赖：
  - 强依赖 `@coze-agent-ide/plugin-setting`，业务逻辑和具体 UI 均在该包内实现；本包通常只做轻量封装与转发。
  - React 18 + ReactDOM 18（peerDependencies）。
  - `classnames` 用于拼接 className。
- 架构原则：
  - 尽量保持「薄适配」：不要在本包中重复实现 plugin-setting 内已有的业务逻辑。
  - 侧重对外 API 设计（组件 props、类型别名），确保嵌入不同 Agent IDE 应用时行为统一。

## 2. 代码结构与入口

- 目录结构（截至当前）：
  - package.json：包元信息、脚本与依赖配置。
  - README.md：基础模板说明（storybook/react 组件模板）。
  - src/
    - index.ts：对外主入口（组件 / 工具导出）。
    - typings.d.ts：在本包暴露的类型声明或对外增强的类型（例如全局 JSX 扩展、样式模块声明等）。
- 入口与导出约定：
  - package.json 中 `main` 指向 `src/index.ts`，编译产物路径和打包逻辑由上层工程统一处理，本包不单独维护构建脚本。
  - 所有对外 API（组件、hooks、工具函数、类型）都应从 `src/index.ts` 统一导出，调用方不要从更深路径（如 `./src/*`）直接 import。
  - 在新增导出时：优先检查 `@coze-agent-ide/plugin-setting` 是否已经提供能力，尽量只做 re-export 或简单包装。

> 提示：如需理解真正的业务行为（例如「插件设置」面板如何渲染、保存规则是什么），请前往 `frontend/packages/agent-ide/plugin-setting` 阅读其 copilot-instructions 与源码，本包只负责对其进行适配。

## 3. 构建、测试与 Lint 工作流

- 依赖安装：
  - 在仓库根目录执行 `rush update`（或脚本 `scripts/setup_fe.sh`）即可为所有前端子包安装依赖，本包不会单独安装。

- NPM Scripts（在本包目录执行）：
  - `npm run build`
    - 当前实现：`exit 0` 占位，不产生独立构建产物。
    - 实际打包：由上层应用 / 统一 bundler（如 Rspack/Vite）负责。本包只需保证 TS 正确、导出路径稳定即可。
  - `npm run lint`
    - 命令：`eslint ./ --cache`。
    - 规则：继承 `@coze-arch/eslint-config` 的 `web` 预设；新增代码需遵守 monorepo 通用规范（import 顺序、无未使用变量等）。
  - `npm run test`
    - 命令：`vitest --run --passWithNoTests`。
    - 用途：运行 Vitest 单测，当前如果尚无测试文件也会正常通过。
  - `npm run test:cov`
    - 命令：`npm run test -- --coverage`。
    - 用途：在运行测试的同时输出覆盖率报告。

- 测试与配置：
  - Vitest 配置继承自 `@coze-arch/vitest-config` 的 `web` 预设（见仓库统一配置），不在本包重复配置复杂项。
  - 如需为适配层新增行为，请在 `__tests__` 目录（需要自行创建）下为暴露的组件 / 工具函数补充单测，优先使用 `@testing-library/react` 进行组件行为测试。

## 4. 项目约定与编码风格

- 技术栈：TypeScript + React 18，函数式组件与 Hooks 为主，不使用 Class 组件。
- 组件封装约定：
  - 本包提供的组件应尽量为「受控 / 半受控」组件，props 设计与 `@coze-agent-ide/plugin-setting` 保持一致或是轻量 superset。
  - 不在适配层引入全局状态（如 Zustand、Redux），如确有需求，应由上层 Agent IDE 应用管理，适配层只通过 props / 回调对接。
  - 使用 `classnames` 合并 className，避免字符串拼接。

- 类型与声明：
  - 类型别名与对外接口建议集中在 `typings.d.ts` 与 `src/index.ts` 中维护；内部实现可在 `src` 子目录单独定义局部类型。
  - 新增公共类型时，优先从 `@coze-arch/bot-typings` 或 plugin-setting 包中复用，避免重复定义同一业务概念。

- 命名：
  - 组件采用帕斯卡命名（如 `PluginSettingPanelAdapter`、`PluginSettingDrawerAdapter`）。
  - Hooks 使用 `useXxx` 前缀（如 `usePluginSettingAdapter`）。
  - 文件名与导出保持一致，方便全局搜索与快速定位。

## 5. 与 @coze-agent-ide/plugin-setting 的协同

- 上游能力：
  - `@coze-agent-ide/plugin-setting` 负责「插件设置」的真实业务实现，例如：
    - 渲染插件设置表单、处理校验与提交；
    - 与后端 API 交互，保存 / 拉取插件配置；
    - 提供独立组件或 hooks 供 IDE 嵌入。

- 适配层职责：
  - 统一对外接口：为上层 Agent IDE 页面提供单一入口组件（例如 `PluginSettingAdapter`），内部组合 / 包装 plugin-setting 提供的组件。
  - 处理容器约定：在 IDE 布局、模态框、侧边栏面板中注入 plugin-setting 时，负责处理容器宽高、滚动、主题 className 等适配细节。
  - 简化类型：通过类型别名隐藏 plugin-setting 内部较复杂的类型，向消费方暴露更易理解的 props（例如只暴露 `pluginId`、`spaceId`、`onClose` 等）。

- 扩展与修改建议：
  - 如需新增某种「插件设置入口」（例如在不同上下文中打开不同初始 Tab），优先在本包新增一个适配组件，将差异配置注入给 plugin-setting；避免直接在上层应用对 plugin-setting 进行复杂组合。
  - 若需要在适配层新增业务行为（如额外的埋点、权限检查），请保持逻辑简单清晰：
    - 埋点与日志优先复用 `@coze-arch/logger` / `@coze-arch/report-events`，不要在此直接 `console.log`；
    - 权限检查结果应通过 props / 回调通知上层，而不是在适配层直接跳转路由或展示全局提示。

## 6. 协作流程与注意事项（AI 助手）

- 修改前：
  - 先确认需求发生在哪一层：是 plugin-setting 自身行为需要变更，还是 IDE 嵌入方式发生变化。
  - 如果是「行为 / 表单逻辑」问题，优先前往 `@coze-agent-ide/plugin-setting` 中修改；本包只做适配调整。

- 修改适配层时：
  - 遵循当前导出模式，只在 `src/index.ts` 追加/调整导出，不随意改变导出路径和名称。
  - 避免在适配层写死与产品业务强耦合的逻辑（如具体空间 ID、插件种类常量），这些应来自上层调用方或统一配置包。
  - 为新增的适配组件编写最小单元测试（渲染 / 基本交互），使用 `@testing-library/react`，放在 `__tests__` 子目录中。

- 与其他 Agent IDE 包的关系：
  - 本包通常会与 `frontend/packages/agent-ide` 下其他 adapter / area 包共同使用（如 `plugin-content-adapter`、`workflow-modal` 等）。
  - 在修改公共 props（例如「当前空间」信息、选择的插件 ID」）时，应检查这些包的使用方式，避免产生不兼容变更。

## 7. 特殊说明与后续演进

- 构建脚本占位：
  - 当前 `npm run build` 为 no-op，本包不直接参与 bundle 产物生成；未来若需要单独打包（例如供外部系统直接引入），应配合 monorepo 统一构建工具更新 package.json 与 tsconfig，而不是在本包私自引入 rollup/webpack 配置。

- 类型演进：
  - 若 plugin-setting 包调整了对外类型 / API，本包需要作为「缓冲层」：
    - 可以先在适配层做兼容包装（例如接受新旧 props），
    - 再在上层应用逐步迁移后，最后统一清理旧接口。

- 文档更新：
  - 每次对外 API 或重要行为发生变化（例如新增主要适配组件、新增关键 props）时，应同步更新本说明文件，保持 AI 助手与人类开发者对本包职责的一致认知。
