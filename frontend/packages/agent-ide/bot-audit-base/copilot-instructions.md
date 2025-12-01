# @coze-studio/bot-audit-base 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-audit-base）中安全、高效地协作开发。

## 1. 子包定位与整体作用

- 本子包位于 Rush monorepo 的前端工作区下：frontend/packages/agent-ide/bot-audit-base。
- 定位：为 Agent IDE 里的「Bot 审核 / 内容合规检查」能力提供**基础 UI 组件**与**类型接口**，不直接发起网络请求，也不包含业务状态管理。
- 对外只暴露两个维度：
  - UI：AuditErrorMessage 组件（统一的审核失败提示文案与跳转链接）。
  - 类型：UseBotInfoAuditorHook、BotInfoAuditFunc 两个审核相关的 TypeScript 类型签名。
- 该子包被其他高层 adapter 或应用集成，保持无状态、无业务耦合，是审核体系中最底层的 UI/类型基础层之一。

## 2. 代码结构与架构要点

### 2.1 目录结构

- [src/index.ts](src/index.ts)
  - 统一导出：
    - AuditErrorMessage
    - UseBotInfoAuditorHook、BotInfoAuditFunc
  - 不做业务逻辑，仅作为公共入口。
- [src/components/audit-error-message](src/components/audit-error-message)
  - index.tsx：React 函数组件 AuditErrorMessage。
  - index.module.less：按模块隔离的样式文件，配合 CSS Modules 使用。
- [src/interfaces/index.ts](src/interfaces/index.ts)
  - 定义审核相关的类型接口：UseBotInfoAuditorHook、BotInfoAuditFunc。
  - 引入 @coze-arch/bot-api/playground_api 中的 BotAuditInfo、BotInfoAuditData 作为核心数据结构。
- typings.d.ts
  - 预留全局类型声明（如 CSS Modules 类型、环境变量等），若新增类型声明，优先集中于此或上层 infra。

### 2.2 核心数据流与职责划分

- 审核请求/结果数据结构：
  - 来源：@coze-arch/bot-api/playground_api
  - 类型：BotAuditInfo（审核入参）、BotInfoAuditData（审核结果）。
  - 本子包只依赖这些类型，不定义实现细节，以保持与 API 层的解耦。
- 审核执行逻辑：
  - 由上层实现 UseBotInfoAuditorHook（符合接口约定），并将 BotInfoAuditFunc 用于真正的网络请求或本地校验。
  - 本包只规定 hook 返回结构：check / pass / setPass / reset 的行为约定。
- UI 展示：
  - AuditErrorMessage 根据 I18n 文案渲染「审核失败」提示，并在文案中嵌入一段链接到内容规范文档的 <a> 标签。
  - 文案 key：audit_unsuccess_general_type、audit_unsuccess_general_type_url 由全局 i18n 管理，本子包不负责文案内容与语言切换逻辑。

### 2.3 结构设计动机

- 把「审核 UI + 类型约定」沉到基础包：
  - 避免多个业务模块重复定义 audit hook 形状和错误提示组件。
  - 上层只需要实现符合 UseBotInfoAuditorHook 接口的 hook，即可即插即用。
- 通过显式导出类型（export type ...）而不是具体实现：
  - 允许在不同应用（Studio、IDE、Workspace）内以相同接口实现不同审核策略。

## 3. 构建、测试与调试工作流

> 注意：本子包是 Rush 管理的 workspace 包，通常不会单独使用 npm/yarn。

### 3.1 项目级脚本（package.json）

- `npm run build`
  - 当前实现为 `exit 0`，构建逻辑由上层 Rush/rsbuild 统一管理。
  - AI 助手在需要时**不要**在此包内自建复杂构建脚本，除非同步修改整个前端构建体系。
- `npm run lint`
  - 命令：`eslint ./ --cache`
  - 使用仓库统一的 @coze-arch/eslint-config 规则。
  - 适用于在本包范围内快速检查代码风格与基础问题。
- `npm run test`
  - 命令：`vitest --run --passWithNoTests`
  - 通过 @coze-arch/vitest-config 统一配置 Vitest。
  - 无测试文件时代码不会失败，适合增量补测试。
- `npm run test:cov`
  - 在 test 基础上附加 coverage 报告：`npm run test -- --coverage`。

### 3.2 Monorepo 顶层工作流（摘录）

- 依赖安装 / 更新：
  - 在仓库根目录执行：`rush update`（或 `rush install`）。
  - AI 修改 package.json 后，应提示用户在根目录执行 Rush 命令，而不是在子包里直接 `npm install`。
- 前端整体构建 & 运行命令在 [frontend/README.md](../../README.md) 与顶层 [README.md](../../../..//README.md) 中有更详细说明，如需跨包联调请参考这些文档。

## 4. 项目内约定与代码风格

### 4.1 TypeScript / React 约定

- 函数组件：
  - 使用命名函数形式 `export function AuditErrorMessage(...) { ... }`，不使用匿名默认导出。
  - 避免在基础包中引入繁重的状态管理或副作用逻辑；保持组件纯展示或轻量逻辑。
- 类型定义：
  - 审核相关类型集中于 [src/interfaces/index.ts](src/interfaces/index.ts)。
  - 对外导出的仅是类型别名与函数签名，不在此处写实现。
  - 对 @coze-arch/bot-api 的依赖通过 `import type` 引用，保持打包体积最小化。

### 4.2 样式与 CSS Modules

- 使用 `.module.less` 搭配 CSS Modules：
  - 组件内通过 `styles['error-message']`、`styles.link` 访问 className。
  - 不在 JSX 中硬编码字符串类名，确保样式名可安全重构。
- 若新增样式文件：
  - 命名规则：`<component-name>.module.less`。
  - 避免在基础包中引入全局样式或覆盖上层应用主题。

### 4.3 i18n 约定

- 统一使用 `@coze-arch/i18n` 提供的 `I18n.t`：

  ```tsx
  I18n.t('audit_unsuccess_general_type', {
    link: <a ...>...</a>,
  });
  ```

- 文案 key 应遵循全局命名策略（如 `audit_*`），且实际文本存放在统一 i18n 资源仓库，**不要在本包硬编码用户可见文案**。

## 5. 重要依赖与集成点

- `@coze-arch/bot-api`：
  - 提供 BotAuditInfo / BotInfoAuditData 类型。
  - 本包假设这些类型已在上层服务中对接真实后端审核 API。
- `@coze-arch/i18n`：
  - 提供国际化文案与多语言能力。
  - AuditErrorMessage 完全依赖其返回的字符串或 ReactNode，AI 在修改时应保持调用方式不变。
- `classnames`：
  - 已加入依赖，但当前代码未显式使用。
  - 若未来需要按条件组合类名，可直接在组件中使用 `classnames`，符合仓库通用实践。

## 6. 测试策略

- 测试工具：Vitest + @testing-library/react：
  - 适合编写组件渲染与交互测试，例如：
    - 校验 AuditErrorMessage 是否渲染 i18n 文案与链接。
    - 模拟不同 link 参数带来的 href 变化。
- 当前 __tests__ 目录下可按 `*.test.tsx` 组织测试文件，测试配置由 [vitest.config.ts](vitest.config.ts) 与上层 @coze-arch/vitest-config 提供。

## 7. 仓库流程与协作规范（与本子包相关部分）

- 分支与提交：
  - 整体仓库使用 Rush 管理多包，通常遵循「feature 分支 + PR 合并」流程（具体规范见仓库根目录 CONTRIBUTING.md）。
  - 在本子包内新增/修改功能，应保持 API 向后兼容；如需破坏性变更，需要同步更新使用方并调整版本策略（当前版本为 0.0.1，仍在早期阶段）。
- 依赖变更：
  - 新增依赖时优先使用 workspace:* 指向内部包，避免重复版本。
  - 修改依赖后，需要在仓库根目录重新执行 `rush update` 并确保构建通过。

## 8. 非常规 / 需要特别注意的点

- 仅定义类型，不提供默认实现：
  - UseBotInfoAuditorHook 是 `declare type`，AI 不要在本包内直接给出实现；实现应放在上层 adapter 或应用包中。
- 审核文案逻辑完全交给 i18n：
  - 不要在组件中拼接多语言文案或引入条件分支翻译逻辑。
  - 如果需要新增文案 key，应在全局 i18n 资源中扩展，而不是在本包中硬编码默认回退文案。
- 构建命令是占位实现：
  - `build: exit 0` 说明本包构建由外部统一驱动，AI 不应随意在此添加打包工具（例如直接加 Vite/Rollup 配置），以免与现有 monorepo 工具链冲突。

## 9. AI 助手在本包的推荐操作范围

- 可以做的：
  - 新增/重构基础 UI 组件（保持无状态、可复用）。
  - 扩展审核相关类型（在保持向后兼容前提下）。
  - 补充单元测试和简单 Storybook 示例（若仓库中存在对应集成）。
- 谨慎/避免的：
  - 在本包内引入业务逻辑（调用实际审核接口、管理复杂全局状态等）。
  - 改动公共类型签名（UseBotInfoAuditorHook、BotInfoAuditFunc）而不检查所有使用方。
  - 在构建脚本中引入与 monorepo 不一致的工具或命令。
