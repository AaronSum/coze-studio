# @coze-data/reporter 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/data/common/reporter）中安全、高效地协作开发。

## 总体架构与职责边界

- 本包是一个独立可发布的前端子包，用于承载「数据域」的错误兜底 UI 与埋点上报能力，包名为 `@coze-data/reporter`。
- 包含两类核心能力：
  - **React 组件级错误边界**：见 `src/components/error-boundary/error-boundary.tsx`，对数据域相关页面/组件提供统一的错误兜底展示与日志上报。
  - **非 React 场景的数据上报工具**：见 `src/reporter/data-reporter.ts` 与 `src/reporter/utils.ts`，在 TS/JS 逻辑中直接调用埋点上报。
- 数据域通过 `src/constants.ts` 中的 `DataNamespace` 枚举进行统一命名，目前包括：`KNOWLEDGE`、`DATABASE`、`FILEBOX`、`VARIABLE`、`TIMECAPSULE`、`MEMORY`。所有上报和错误边界都必须绑定到明确的 `DataNamespace`。
- 上报链路依赖上层通用基础库：
  - `@coze-arch/logger`：提供 `logger`、`ErrorBoundary`、`reporter`、`ErrorEvent`/`CustomEvent` 等通用埋点与错误边界能力。
  - `@coze-arch/i18n`：用于错误兜底文案多语言（key 如 `data_error_title`、`data_error_msg`，`module` 参数使用 `DataNamespace`）。
- 对外导出通过 `src/index.ts` 统一聚合：
  - `DataErrorBoundary`、`ErrorFallbackComponent`、`DataErrorBoundaryProps`
  - `DataNamespace`
  - `dataReporter`
- 架构设计目标：
  - 在 UI 与纯逻辑场景中均提供统一、可扩展的数据错误处理与埋点能力。
  - 将「数据域识别」「公共 meta 采集」「与底层 logger 集成」封装在本包内部，业务侧只需显式传递 `DataNamespace` 与事件结构。

## 关键模块与数据流

### 1. DataNamespace（数据域命名）

- 文件：`src/constants.ts`
- 功能：枚举所有支持的数据域，用于：
  - 区分不同数据产品线/模块（如 knowledge/database/filebox 等）。
  - 作为埋点 `namespace` 字段传入 `@coze-arch/logger`，实现按域聚合和分析。
- 变更约束：
  - 新增枚举值前需确认对应的后端/埋点分析链路是否已支持该 namespace。
  - 修改已有枚举值会影响所有上报统计，属于破坏性变更，应避免。

### 2. DataErrorBoundary（组件级错误边界）

- 文件：`src/components/error-boundary/error-boundary.tsx`
- 渲染流转：
  - 外部以 `<DataErrorBoundary namespace={DataNamespace.KNOWLEDGE}>...</DataErrorBoundary>` 包裹任意 React 子树；
  - `DataErrorBoundary` 实际渲染的是来自 `@coze-arch/logger` 的 `ErrorBoundary` 组件，并传入：
    - `onError`：调用 `logger.persist.error` 上报，`eventName` 命名为 `${namespace}_error_boundary`；
    - `errorBoundaryName`：`${namespace}-error-boundary`，用于区分不同 boundary；
    - `FallbackComponent`：内部定义的 `ErrorFallbackComponent`，会展示统一的图文兜底。
  - `ErrorFallbackComponent` 使用 `@douyinfe/semi-illustrations` 的 `IllustrationNoAccess` 展示插画，通过 `I18n.t` 渲染标题与描述文案。
- 样式约定：
  - 使用 CSS Modules + Less，样式文件为 `src/components/error-boundary/index.module.less`（路径在 TSX 中以 `./index.module.less` 引入）。
  - 类名只在组件内部使用，不对外暴露全局样式。
- 开发注意点：
  - 所有错误边界相关逻辑必须通过 `ErrorBoundary` 组件封装，不要在外层手动捕获错误并绕过上报逻辑。
  - 修改 `onError`/`eventName` 命名规则会影响埋点分析，应谨慎调整，并与数据平台同步。

### 3. dataReporter（TS/JS 场景埋点工具）

- 对外入口：`src/reporter/index.ts` 与 `src/index.ts`，最终导出 `dataReporter` 实例。
- 内部实现：`src/reporter/data-reporter.ts` 和 `src/reporter/utils.ts`。

#### 3.1 公共 meta 采集

- `DataReporter.getMeta()`：
  - 从 `window.location.pathname` 解析 URL，使用正则：`/\/space\/(\d+)\/knowledge(\/(\d+)(\/(\d+))?)?/gi`；
  - 利用 `lodash-es/get` 和枚举 `ParamsIndex` 抽取路径中的：
    - `spaceId`（索引 1）
    - `knowledgeId`（索引 3）
    - `documentId`（索引 5）
  - 返回的 `meta` 对象形如 `{ spaceId, knowledgeId, documentId }`，下游会被合并到最终上报参数中。
- 约束：
  - 目前仅对 `/space/:spaceId/knowledge/:knowledgeId?/:documentId?` 结构做解析；如果路径结构变更，需要同步更新该正则。
  - 本工具假设在浏览器环境下运行，依赖全局 `window` 对象；不要在 Node 环境或 SSR 前置阶段直接调用。

#### 3.2 埋点封装逻辑

- 上报函数封装在 `reporterFun` 中：
  - 入参为 `type`（`error` 或 `custom`）、`namespace`、`event` 以及公共 `meta`；
  - 从 `event` 中解构出 `meta` 与其余字段，将公共 meta 与事件自带 meta 合并，优先级为 `event.meta` 覆盖公共 meta；
  - 根据 `type` 分支调用：
    - `reporter.errorEvent(...)`（错误事件）
    - `reporter.event(...)`（自定义事件）
- 对外方法：
  - `dataReporter.errorEvent(namespace, event)`：
    - 泛型参数 `<EventEnum extends string>` 对齐 `@coze-arch/logger` 的 `ErrorEvent` 类型，通常应使用预定义的事件名枚举而非任意字符串。
  - `dataReporter.event(namespace, event)`：
    - 对应普通业务事件上报，结构由 `CustomEvent<EventEnum>` 约束。
- 使用示例（概念性）：
  - `dataReporter.errorEvent(DataNamespace.KNOWLEDGE, { eventName: 'fetch_fail', error, meta: { api: '/xxx' } });`
  - `dataReporter.event(DataNamespace.DATABASE, { eventName: 'query_exec', meta: { source: 'panel' } });`
- 开发注意点：
  - 始终显式传入 `DataNamespace`，不要在外部硬编码字符串 namespace。
  - 多处调用时请做好事件名与字段的统一定义（通常在上游包中定义枚举），本包本身不维护事件名列表。

## 构建 / 调试 / 质量相关流程

### 1. 构建与打包

- `package.json`：
  - `main`: `src/index.ts`
  - `module`: `./dist/esm/index.js`
  - `unpkg`: `./dist/umd/index.js`
  - `types`: `./src/index.ts`
  - `files`: 仅发布 `dist` 与 `README.md`。
- 当前 `scripts.build` 占位为 `"build": "exit 0"`，说明：
  - 实际打包流程通常由上层 Rush / workspace 统一驱动（例如通用构建脚本），而非该子包单独配置；
  - AI 修改 build 流程前应先查看 workspace 级别构建方案（例如根目录 `rush.json` 和 frontend 内通用脚本），不要在本包私自引入新的 bundler 或打包命令。

### 2. Storybook 调试

- 命令：`npm run dev` → `storybook dev -p 6006`。
- Storybook 配置：位于 `./.storybook` 目录：
  - `main.js`：定义 stories 入口与构建集成（使用 `@storybook/react-vite`）。
  - `preview.js`：用于全局装饰器、全局样式等。
- 用途：
  - 本包主要是 UI/逻辑能力组合，推荐通过 Storybook 进行组件与边界行为验证。

### 3. Lint 与测试

- Lint：
  - 命令：`npm run lint` → `eslint ./ --cache`。
  - 配置：`eslint.config.js` 使用 `@coze-arch/eslint-config`：
    - `defineConfig({ packageRoot: __dirname, preset: 'web' })`；
    - 规则为空对象 `rules: {}`，说明具体规则由 preset 全局统一管理。
- 单测：
  - 命令：
    - `npm run test` → `vitest --run --passWithNoTests`
    - `npm run test:cov` → `npm run test -- --coverage`
  - 配置文件：`vitest.config.ts` 使用 `@coze-arch/vitest-config`：
    - `preset: 'web'`
    - `coverage.all = true`，意味着新增文件如无测试，会影响整体覆盖率。
  - 测试存放目录：`__tests__/`（遵循 workspace 通用规范）。
- 建议：
  - 新增/修改关键逻辑时，在 `__tests__` 中添加对应 vitest 测试，重点覆盖：
    - `DataReporter.getMeta` 的路径解析；
    - `reporterFun` 在 error/custom 两种分支的行为；
    - `DataErrorBoundary` 的 onError 与 fallback 渲染。

## 项目约定与风格

- 语言与运行时：
  - TypeScript + React 18，构建/调试基于 Vite/Storybook 与 Vitest。
  - 运行环境默认是浏览器端（依赖 `window.location`），不直接支持 Node/SSR。
- 代码组织：
  - `src/components/**`：React 组件，使用 `.tsx` + CSS Modules (`.module.less`)；
  - `src/reporter/**`：与具体 UI 解耦的 TS/JS 工具逻辑；
  - `src/index.ts`：统一导出公共 API，其他子模块不直接从内部路径导入（对外使用方应统一走 `@coze-data/reporter` 入口）。
- 第三方依赖：
  - `@coze-arch/*` 系列为 workspace 内部共享基础设施（eslint/ts/vitest 配置、logger、i18n 等），请按其提供的 API 使用，避免在本包中重复实现类似功能。
  - `lodash-es` 仅用于轻量的工具函数（当前只用到 `get`），新增依赖前需评估是否有必要引入更多函数。
- 样式与 UI：
  - 使用 `@douyinfe/semi-illustrations` 提供的插画作为视觉兜底，不在本包中维护复杂 UI 体系。
  - 国际化文案通过 `@coze-arch/i18n` 统一管理，本包只负责传递 key 与必要的参数（如 `module`）。

## 与外部系统的集成

- 日志与埋点：
  - 所有与埋点/错误相关逻辑通过 `@coze-arch/logger` 集成：
    - `ErrorBoundary`：组件级错误捕获与展示；
    - `logger.persist.error`：关键错误的持久化上报；
    - `reporter.errorEvent` / `reporter.event`：埋点事件发送。
  - 本包不直接调用浏览器原始上报 API（如 `fetch`、`navigator.sendBeacon` 等），所有 IO 由 logger 统一封装。
- 国际化：
  - 错误页文案通过 `I18n.t('data_error_title', { module: namespace })` 与 `I18n.t('data_error_msg')` 获取；
  - 新增错误页面或提示时，应沿用相同 i18n 模式，不在组件内硬编码文案。

## 团队流程与协作注意事项

> 本子包没有单独的分支/发布流程定义，一般遵循仓库根目录与 frontend 级别的通用规范。以下为在本包内编码时 AI 需要特别注意的点：

- 分支与提交：
  - 遵循仓库统一的分支策略和提交规范（请参考仓库根目录的 `CONTRIBUTING.md` 等文档）。
  - 在本包进行变更时，应保证：
    - Lint / 测试在本子包内可通过；
    - 与上游库（如 `@coze-arch/logger`、`@coze-arch/i18n`）的类型及 API 兼容。
- 变更类型：
  - **非破坏性优先**：避免随意变更导出的类型名、模块路径、事件命名等公共接口。
  - 若必须调整对外 API（例如新增新的导出或参数），应保持向后兼容（增加而非替换），并在 README 或上层文档补充用途说明。

## 特殊/非典型特性说明

- `tsconfig.json` 中 `exclude: ["**/*"]`，并仅通过 `references` 指向 `tsconfig.build.json` 与 `tsconfig.misc.json`：
  - 说明该包在 workspace 中通过增量工程引用来参与整体构建，AI 不要随意修改此结构；
  - 新增 TS 文件时，只要放在现有 src 目录下，通常能被对应的 build/test 方案覆盖，无需手动调整根 tsconfig。
- `scripts.build` 为 no-op：
  - 表明构建流程可能委托给更上层的统一脚本（如 Rush 任务或根级别 `build_fe.sh` 等），本包无需也不应重复配置打包链路，除非在整体架构调整后同步更新。
- `dataReporter.getMeta` 使用正则直接从 URL 提取业务字段：
  - 这是一种「约定大于配置」的设计，隐含依赖 URL 结构；
  - 改动该逻辑会对所有基于 URL 的公共埋点 meta 产生影响，属于高风险修改，AI 修改前务必评估上下游影响。

## 对 AI 助手的具体建议

- 在本子包新增/修改代码时，优先考虑：
  - 复用 `DataNamespace` 与现有上报封装（`DataErrorBoundary`、`dataReporter`、`reporterFun`），不要绕过统一链路。
  - 任何新增的错误处理逻辑，尽量与 `@coze-arch/logger` 保持一致风格，而不是引入新的日志/埋点实现。
- 进行重构或新特性开发前，建议先：
  - 阅读 `@coze-arch/logger`、`@coze-arch/i18n` 在 workspace 中的实现或使用示例；
  - 在 Storybook 中验证 UI 行为，在 Vitest 中验证逻辑。
- 如果需要扩展本包（如新增更多数据域、增加新的 reporter 能力），应优先在现有结构下扩展而非另起新模块，以保持包职责清晰与对外 API 稳定。