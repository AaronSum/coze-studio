# Coze Studio frontend @coze-arch/logger 开发说明（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/logger）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 本包名称：`@coze-arch/logger`，位于 Rush + PNPM 单仓前端工程的架构层（arch）。
- 主要出口在 [frontend/packages/arch/logger/src/index.ts](frontend/packages/arch/logger/src/index.ts)，统一 re-export：
  - 日志：`logger`, `Logger`, `LoggerContext`, `useLogger`（来自 `src/logger`）。
  - 远程上报：`reporter`, `Reporter`（来自 `src/reporter`，绑定 Slardar）。
  - React 错误边界：`ErrorBoundary`, `useErrorBoundary`, `useErrorHandler`, `FallbackProps`, `ErrorBoundaryProps`（来自 `src/error-boundary`）。
  - Slardar 集成：`SlardarReportClient`, `SlardarInstance`, `getSlardarInstance`, `setUserInfoContext`（来自 `src/slardar`）。
  - 公共类型与枚举：`LogLevel` 以及 reporter 暴露的类型。
- 核心职责：
  - 在前端体系中提供 **统一的日志/事件接口**，同时支持浏览器控制台与远程埋点。
  - 封装 **Slardar** 错误监控与事件上报，提供一致的结构、上下文与元数据约定。
  - 提供 **React 错误捕获**（错误边界 + hooks），自动接入 remote logging。
  - 提供 **性能埋点**（多步骤耗时追踪）。
- 全局架构思路：
  - `Logger` 聚焦「本地/持久日志」的构造与派发（console + 远程客户端）。
  - `Reporter` 构建在 `Logger` 之上，负责「对外 API 友好的事件与错误上报」，附带 Slardar 初始化与 pending 队列处理。
  - `SlardarReportClient` 是 `LoggerReportClient` 的一个实现，将通用日志结构转换为 Slardar 所需格式。
  - `ErrorBoundary` 是上层 React 适配层，将 React 错误转为标准日志事件，并通过 `logger.persist` + Slardar 上报。

## 2. 关键模块与数据流

### 2.1 Logger / BaseLogger

- 位置：
  - [frontend/packages/arch/logger/src/logger/core.ts](frontend/packages/arch/logger/src/logger/core.ts)
  - [frontend/packages/arch/logger/src/logger/index.ts](frontend/packages/arch/logger/src/logger/index.ts)
- 重要类型（定义在 `src/types`，调用时作为黑盒使用即可）：
  - `CommonLogOptions`：统一的日志结构（`namespace`, `scope`, `level`, `message`, `eventName`, `meta`, `error`, `action` 等）。
  - `LogAction`：日志动作，当前主要为 `CONSOLE` 和 `PERSIST` 两类。
  - `LoggerReportClient`：日志客户端接口，必须实现 `send(options: CommonLogOptions)`。
  - `BaseLoggerOptions`：构造 Logger 时的上下文、客户端、前置处理（`beforeSend`）等配置。
- 数据流：
  1. 外部通过 `Logger` 或 `BaseLogger` 调用 `info/success/warning/error/fatal`。
  2. payload 先通过 `unwrapOptions` 规范化为 `CommonLogOptions` 然后合并：`defaultLogOptions` + `ctx` + `options`。
  3. 若配置了 `logOptionsResolvers`（`beforeSend`），依次对 payload 做变换，用于统一追加字段 / 过滤 / 规范化。
  4. 按照当前 `disableConsole` 与 `clients` 决定最终要调用的 `LoggerReportClient` 列表，并调用 `client.send(resolvedPayload)`。
- 默认行为与设计约束：
  - `Logger` 构造时会自动注入 `consoleLogClient`，确保本地开发环境总是有控制台输出；如需关闭控制台，使用 `disableConsole` 或 `logger.setup`。
  - `Logger.persist` 是带有 `action: [CONSOLE, PERSIST]` 的预设 logger，用于「会远程上报」的日志；普通 `logger` 仅 `CONSOLE`。
  - 任何新增的 `LoggerReportClient` 必须保证 **对所有字段容错**，避免在 send 内部抛错导致日志链路中断。

### 2.2 Reporter

- 位置： [frontend/packages/arch/logger/src/reporter/index.ts](frontend/packages/arch/logger/src/reporter/index.ts)
- 角色：
  - 为业务方提供更语义化的 API：`info/success/warning/error`（日志）以及 `event/successEvent/errorEvent`（事件）。
  - 内部持有一个 `Logger` 实例，并以 `logger.persist` 为基础发送日志。
  - 管理 **Slardar 初始化** 与 **pending 队列**，避免业务在 Slardar 尚未 ready 时丢日志。
- 关键字段：
  - `initialized: boolean`：是否完成 `init(slardarInstance)`。
  - `pendingQueue: CommonLogOptions[]`：初始化前缓存的日志。
  - `pendingInstance: Reporter[]`：初始化前通过 `createReporterWithPreset` 创建的子 reporter 实例，在 init 时统一补 init。
  - `slardarInstance: SlardarInstance | null`：对外暴露，方便部分业务透传。
- 典型调用链：
  1. 业务创建全局唯一 reporter：`import { reporter } from '@coze-arch/logger';`。
  2. 启动时调用 `reporter.init(slardarInstance)`。
  3. 任意时刻调用 `reporter.info / reporter.event / reporter.error` 等接口。
  4. 如果在 `init` 之前调用，会进入 `check()` 返回 false，并将 payload 推入 `pendingQueue`。
  5. `init` 时：
     - 构造 `SlardarReportClient` 并作为 client 注入 `logger.persist`。
     - 将 `pendingQueue` 中的 payload 逐条按 `level` 重放。
     - 对 `pendingInstance` 中的 reporter 实例也统一执行 `init(slardarInstance)`。
- 预设化 Reporter：
  - `createReporterWithPreset(preset: ReporterConfig)` 会根据 `namespace/scope/meta` 创建新的 Reporter，尤其适合作为模块级 logger（例如 auth/login）。
  - 若此时全局 reporter 已经初始化，则会直接调用子 reporter 的 `init`；否则，加入 `pendingInstance`，在主 reporter 初始化后统一补。
- 格式转换逻辑：
  - `formatCustomLog`：将 `CustomLog/CustomErrorLog` 合并到 `CommonLogOptions`，自动注入 ctx 中的 `namespace/scope/meta`。
  - `formatCustomEvent`：构建事件型 payload（带 `eventName`，无 `message`）。
  - `formatErrorEvent`：在 `formatCustomEvent` 结果上，额外展开 `errorMessage/errorName/level`。

### 2.3 Slardar 集成

- 位置：
  - Slardar 客户端： [frontend/packages/arch/logger/src/slardar/index.ts](frontend/packages/arch/logger/src/slardar/index.ts)
  - 工具函数（用于错误提取、深度展开、实例获取等）：`src/slardar/utils.*`、`src/slardar/runtime.*`（需要时再精读）。
- `SlardarReportClient` 的核心职责：
  - 根据 `CommonLogOptions` 决定调用哪类 Slardar API：
    - 若 `level === LogLevel.ERROR && meta.reportJsError === true`：调用 `slardarInstance('captureException', error, extra, reactInfo)`，适配 React ErrorBoundary 场景。
    - else if `eventName` 存在：调用 `slardarInstance('sendEvent', { name, metrics, categories })`。
    - else if `message` 存在：调用 `slardarInstance('sendLog', { level, content, extra })`。
  - `metaToMetricsCategories` + `normalizeExtra` 负责将 meta 分成 metrics（数字）与 categories（字符串），以及保证 extra 字段类型符合 Slardar 要求。
  - 通过 `toFlatPropertyMap` 将嵌套的 meta 展平成一层，控制最大深度（当前 `maxDepth: 4`）。
- 重要约束：
  - `LogAction.PERSIST` 才会触发 Slardar 上报；仅 `CONSOLE` 的日志不会进入 Slardar。
  - `meta.reportJsError === true` 是 React ErrorBoundary 用于捕获 JS 异常并上报 `captureException` 的标记，不要随意在普通埋点里设为 true。

### 2.4 ErrorBoundary 与 React 集成

- 位置： [frontend/packages/arch/logger/src/error-boundary/index.tsx](frontend/packages/arch/logger/src/error-boundary/index.tsx)
- 组件职责：
  - 基于 `react-error-boundary` 封装二次 ErrorBoundary，默认行为：捕获子树内抛出的异常并自动上报 Slardar。
  - 通过 `logger.persist.error` 上报两类事件：
    - `eventName: 'react_error_by_api_collection'`（错误对象为 `ApiError`）。
    - `eventName: 'react_error_collection'`（其他 Error）。
  - 携带 meta：
    - `reportJsError: true`（驱动 Slardar `captureException` 分支）。
    - `errorBoundaryName`（来源于 props）。
    - `reactInfo: { componentStack, version }`。
- `ErrorBoundaryProps`：
  - 必填：`FallbackComponent`, `errorBoundaryName`。
  - 可选：`onError`, `onReset`, `resetKeys`, `logger`。
  - 若未显式传入 `logger`，则内部通过 `useLogger({ allowNull: true })` 从 `LoggerContext` 读取；若均为 null，会 `console.warn` 提示。
- hook：
  - `useErrorBoundary` 直接 re-export 自 `react-error-boundary`。
  - `useErrorHandler` 为兼容性复制一份旧实现，用于在函数组件中抛出/处理错误并交给 ErrorBoundary。

### 2.5 性能追踪（Duration Tracer）

- 位置： [frontend/packages/arch/logger/src/reporter/duration-tracer.ts](frontend/packages/arch/logger/src/reporter/duration-tracer.ts)
- `genDurationTracer()`：
  - 内部维护 `TraceDuration`：`points: string[]` 与 `interval: Record<TracePointName, number>`。
  - 每次调用 `tracer(pointName)`：
    - 使用 `performance.mark(pointName)` 打标。
    - 如果已有前一个点，使用 `performance.measure('measure', prevPoint, currentPoint)` 计算区间耗时，并写入 `interval[pointName]`。
- Reporter 侧封装：
  - `reporter.tracer({ eventName })` 返回 `{ trace }`：
    - 每次 `trace(pointName, { meta, error })`：
      - 自动在 meta 中注入 `duration`（当前 `TraceDuration`），并构造事件 payload。
      - 经过 `check()`，只有 reporter 初始化完成才会真正发送。

## 3. 开发工作流与命令

### 3.1 本子包常用命令

- 在仓库根目录安装依赖：
  - `rush install` / `rush update`（见 [frontend/README.md](frontend/README.md)）。
- 切换到子包目录：
  - `cd frontend/packages/arch/logger`。
- 构建：
  - `npm run build`（当前 `package.json` 中实现为 `exit 0`，只作为 Rush hook 占位，真正构建通常在上层工程统一完成）。
- 测试：
  - `npm test` 或 `npm run test`：`vitest --run --passWithNoTests`。
  - `npm run test:cov`：带覆盖率。
  - 在仓库根目录可统一执行：`rush test` / `rush test:cov`，会根据 `rush.json` 按优先级调度（本包 tags: `team-arch`, `level-1`，属于高优先级核心包）。
- Lint：
  - `npm run lint`：`eslint ./ --cache`，继承 [frontend/config/eslint-config](frontend/config/eslint-config)。
- TypeScript：
  - `tsconfig.json` 仅做 references 聚合（编译入口在 `tsconfig.build.json` 与 `tsconfig.misc.json`）。
  - 具体编译参数复用 `@coze-arch/ts-config`，一般无需在子包单独调整。

### 3.2 Vitest 配置

- 位置： [frontend/packages/arch/logger/vitest.config.ts](frontend/packages/arch/logger/vitest.config.ts)
- 用法：
  - 通过 `@coze-arch/vitest-config` 的 `defineConfig` 统一约定：
    - `preset: 'web'`：运行在浏览器环境，支持 DOM / performance API（对 duration tracer 重要）。
    - `coverage.all = true`，但显式排除 `src/index.ts` 与 `src/logger/index.ts`，因为它们只是 re-export。
- 编写测试时：
  - 优先对 `core` 与 `utils` 逻辑做单测，如 `src/logger/core.ts`、`src/reporter/index.ts`、`src/slardar/index.ts`。
  - 尽量保持已有测试文件命名风格：`*.test.ts`，与源码文件一一对应（例如 `duration-tracer.test.ts` 对应 `duration-tracer.ts`）。

## 4. 项目约定与代码风格

### 4.1 日志与事件约定

- `namespace` / `scope`：
  - 用于在整个 Coze 前端体系中定位模块与子模块，例如：`namespace: 'workflow'`, `scope: 'canvas'`。
  - `Logger` 与 `Reporter` 都支持通过 `ctx` 或 `preset` 预设这两个字段，后续调用无需重复传入。
- `meta`：
  - 面向 Slardar 的扩展字段，建议使用 **简单扁平结构** 或嵌套不超过 4 层的对象。
  - 与 `SlardarReportClient` 的处理约定：
    - 数字会被识别为 metrics，其余为 categories。
    - 非字符串/数字会经过 `safeJson.stringify` 序列化。
  - 若新增字段用于检索/过滤，应保持稳定命名，避免频繁更名导致线上报表不一致。
- `error`：
  - `error` 字段存在时才会进入 `getErrorRecord` 逻辑，并最终在 Slardar 中以异常形式出现。
  - 对于 API 层使用的 `ApiError`，会在 ErrorBoundary 中专门打上 `react_error_by_api_collection` 事件，以便后端区分。
- `action`：
  - `CONSOLE`：仅浏览器控制台输出（开发调试）。
  - `PERSIST`：会通过远程客户端（如 Slardar）上报。
  - 推荐：
    - 临时调试日志：只用 `CONSOLE`。
    - 线上埋点或关键错误：使用 `logger.persist.*`，或 reporter 的 `event/errorEvent`（已自动包含 `PERSIST`）。

### 4.2 React 相关约定

- 所有与 React 耦合的能力均集中在：
  - `src/error-boundary`（组件 + hooks）。
  - `src/logger/context.ts`（LoggerContext + useLogger）。
- 新增与 React 耦合的 API 时：
  - 避免直接耦合业务组件；保持接口层只依赖通用类型与 Logger/Reporter。
  - 注意 SSR 场景：避免在 hook 或组件初始渲染阶段访问浏览器特有对象（如 `window.performance`），应在客户端调用时使用。

### 4.3 TypeScript 与风格

- 遵循 `@coze-arch/ts-config`：
  - 严格模式开启，尽量避免使用 `any`。
  - 对外导出的类型用 `export type {...}`，实现类/函数用 `export { ... }`。
- 代码风格：
  - 使用 `eslint.config.js` 统一配置，**不要**在子包内再创建额外 `.eslintrc.*`。
  - 保持现有的 `// eslint-disable-next-line` 用法风格，仅在确有必要时添加，并写明原因（见 `core.ts` 中的 `@ts-expect-error` 例子）。
  - 不要在文件头添加新的版权头；复用已有模板。

## 5. 与外部包/系统集成的细节

### 5.1 与 @coze-studio/slardar-interface

- 通过类型 `SlardarInstance` 定义 Slardar 的调用约定：
  - 形如 `slardarInstance('sendLog', {...})`、`slardarInstance('sendEvent', {...})`、`slardarInstance('captureException', error, extra, reactInfo)`。
- 本包不负责创建实例，只负责消费实例：
  - 外部系统（通常是 app 层或 foundation 层）负责初始化 Slardar，并在准备好后调用 `reporter.init(slardarInstance)`。
  - 若需要在别处直接使用 Slardar，可通过 `getSlardarInstance`/`setUserInfoContext` 这类 runtime 工具进行交互（详见 `src/slardar/runtime.*`）。

### 5.2 与 @coze-arch/bot-env / @coze-arch/bot-typings

- 这些依赖主要提供：
  - 环境配置（如当前运行环境、是否启用 console 输出等）。
  - 通用类型定义（如统一的错误类型，后续在 ApiError 等工具中使用）。
- 本包的整体设计假设 **环境配置在外层统一处理**，本包仅通过 `ctx` 或 `setup` 方式读取；新增功能时不要在此包中硬编码环境判断（如 `if (NODE_ENV === 'production')`），统一交给 bot-env / 调用方注入。

## 6. 测试与修改注意事项

- 单测目录： [frontend/packages/arch/logger/__tests__](frontend/packages/arch/logger/__tests__)。
  - 已覆盖：console client、console-disable、duration tracer、logger、reporter、slardar、utils 等。
- 修改/新增逻辑时：
  - 若改动现有行为（尤其是 `Reporter`、`SlardarReportClient` 或 `ErrorBoundary`）：
    - 必须同步更新对应的 test 文件，保证行为与预期保持一致。
    - 注意 Vitest 使用 `web` preset，可以访问 `performance` API 等浏览器特性。
  - 对于公共导出（index.ts）变动：
    - 更新 README 中的 API 文档： [frontend/packages/arch/logger/README.md](frontend/packages/arch/logger/README.md)。
    - 若有新类型/新方法，是被外部包依赖的，需要在调用侧进行一次全局搜索确认未破坏现有调用。

## 7. 仓库流程、分支与发布（与整体前端共用）

- 单仓管理：
  - 通过 Rush 管理依赖与构建，`@coze-arch/logger` 作为 `frontend` 子项目的一部分，不单独发布命令，而是跟随前端整体版本。
  - 依赖版本多为 `workspace:*`，统一由根目录的 `rush.json` 与 `pnpm-lock` 控制。
- 团队标签：
  - 在前端工程中，此包被标记为 `team-arch` + `level-1`：
    - `team-arch`：归属架构组维护，强调稳定性与向后兼容。
    - `level-1`：高优先级/高重要性组件，修改前建议评估对全局的影响。
- 分支与提交流程：
  - 遵循仓库根部的贡献规范：[CONTRIBUTING.md](CONTRIBUTING.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。
  - 一般流程：新建 feature/bugfix 分支 → 修改 + 补充测试 → 本地 `rush lint` / `rush test` → 提交 PR。

## 8. 对 AI 助手的具体建议

- 在本包内进行修改时：
  - 优先在现有架构下扩展能力，不要轻易改变 `Logger` / `Reporter` / `SlardarReportClient` 的对外 API 形态。
  - 如需新增日志类型或事件：
    - 先在 `types` 或 `Reporter` 层添加新的语义方法（如 `criticalEvent`），再按既有模式拼装到 `CommonLogOptions`。
  - 如需修改错误上报策略（例如增加某类错误的专门事件名）：
    - 优先在 `ErrorBoundary` 的 `onError` 内扩展分支逻辑，同时保证 meta 中的 `reportJsError` 与 `reactInfo` 结构不被破坏。
- 在调用侧（其他包）使用 logger/reporter 时：
  - 优先使用 `createLoggerWith` / `createReporterWithPreset` 固定 `namespace/scope`，避免在每次调用时填错或打错字。
  - 对需要精准统计的埋点，统一定义 `eventName` 枚举类型，在对应模块导出，避免字符串散落各处。
- 遇到不确定的行为：
  - 先查找对应的 test 文件与 README 中的示例；本包整体文档齐全，优先遵循已有示例风格。
  - 若要新增较大能力（例如新的上报后端或新的日志管线），建议通过新增 `LoggerReportClient` 的方式实现，而不是在 `SlardarReportClient` 内做过多分支。
