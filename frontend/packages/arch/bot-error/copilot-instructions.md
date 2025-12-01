# copilot-instructions (@coze-arch/bot-error)

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-error）中安全、高效地协作开发。

## 1. 子包定位与全局架构

- 子包角色：统一管理「Bot 端前端错误」的建模、识别与上报逻辑，是 bot 前端监控与稳定性体系的一部分。
- 主要能力：
  - 定义可统一上报的业务错误类型 `CustomError`，并提供类型守卫 `isCustomError`。
  - 识别特定来源错误（Axios、HTTP API、分包加载、非 Error 实例等），统一转成监控事件并上报。
  - 通过 React Hooks `useErrorCatch` / `useRouteErrorCatch` 集成到应用生命周期中，自动捕获 `unhandledrejection`、Slardar 报错等。
- 对外导出入口：[src/index.ts](src/index.ts)：
  - `CustomError`, `isCustomError`
  - `useErrorCatch`
  - `isChunkError`
  - `useRouteErrorCatch`
- 关键依赖与边界：
  - 依赖监控与日志体系：`@coze-arch/logger` 提供 `logger` 与 `SlardarInstance`；`reporter` 用于特定错误的上报。
  - 依赖 HTTP 层：`@coze-arch/bot-http` 暴露 `isApiError` 用于识别接口错误；这些错误在本子包中仅做过滤/兜底，不重复上报。
  - 运行时环境假设：浏览器环境（使用 `window.addEventListener`、React Hooks，且依赖 Slardar 前端 SDK）。

## 2. 目录结构与核心模块

- 根配置：
  - [package.json](package.json)
    - `name`: `@coze-arch/bot-error`，`main`: `src/index.ts`（直接走 TS 源码，构建由上层工具统一处理）。
    - `scripts`：
      - `build`: 占位命令，始终退出 0，本包不维护独立打包逻辑。
      - `lint`: `eslint ./ --cache`，使用 monorepo 统一 ESLint 配置。
      - `test`: `vitest --run --passWithNoTests`，测试配置来自 `@coze-arch/vitest-config`。
      - `test:cov`: `npm run test -- --coverage`。
    - `dependencies`：
      - `@coze-arch/bot-http`: HTTP 错误类型识别（`isApiError`）。
      - `@coze-arch/logger`: 统一日志 / Slardar 抽象（`logger`, `reporter`, `SlardarInstance`）。
      - `axios`: 通过 `isAxiosError` 识别网络错误。
  - TS/ESLint/Vitest 具体配置由 monorepo 上层共享包提供（`@coze-arch/eslint-config`, `@coze-arch/ts-config`, `@coze-arch/vitest-config`），本子包本地不再重复定义。

- 源码目录：[src](src)
  - [custom-error.ts](src/custom-error.ts)
    - 定义业务自定义错误 `CustomError extends Error`：
      - `eventName: string`: 监控事件名，写入持久化日志与 Slardar 上报。
      - `msg: string`: 人类可读错误信息，同时作为 Error.message。
      - `ext?: { customGlobalErrorConfig?: { title?: string; subtitle?: string } }`: 对接全局错误展示（标题/副标题）的扩展字段。
    - 类型守卫 `isCustomError(error): error is CustomError`：
      - 同时兼容实例检测（`instanceof`）与 `.name === 'CustomError'` 场景（兼容 Slardar 等仅根据 name 判断类型的实现）。
  - [source-error.ts](src/source-error.ts)
    - 识别前端资源加载相关的「Chunk 错误」：
      - `isWebpackChunkError`: `error.name === 'ChunkLoadError'`。
      - `isThirdPartyJsChunkError`: `error.message` 以 `Loading chunk` 开头（第三方 JS chunk 失败）。
      - `isCssChunkError`: `error.message` 以 `Loading CSS chunk` 开头（CSS chunk 失败）。
      - `isChunkError`: 以上任一命中即认为是 Chunk 相关错误。
  - [certain-error.ts](src/certain-error.ts)
    - 负责对「特定错误类型」进行分类、过滤与上报，是本子包逻辑核心之一。
    - 关键常量与依赖：
      - `loggerWithScope = logger.createLoggerWith({ ctx: { namespace: 'bot-error', scope: 'certain-error' } })`：统一打点上下文。
      - `errorList`: 错误识别链表，顺序为：`CustomError` → `AxiosError` → `ApiError` → `ChunkLoadError` → `notInstanceError`。
    - 核心方法：
      - `getErrorName(error)`：按 `errorList` 依次尝试匹配，返回 `CertainErrorName` 或 `'unknown'`。
      - `isCertainError(error)`：仅判断是否能在 `errorList` 中识别出类型。
      - `sendCertainError(error, handle?)`：
        - 若是可识别错误：调用内部 `handleCertainError` 完成上报、日志处理，并直接返回。
        - 若不可识别：调用备用的 `handle(reason: string)` 回调（通常用于兜底上报文案）。
      - `handleCertainError(error)`（内部）：根据 `errorName` 分发：
        - `CustomError`：
          - 追加一次统一事件名 `ReportEventNames.CustomErrorReport`，补充 `originEventName`/`originErrorMessage` 等元信息；
          - 再按自定义的 `eventName` 上报一次，保证业务自定义事件仍然存在。
        - `ApiError` / `AxiosError`：认为在各自层面已上报，这里直接 return，避免重复统计。
        - `ChunkLoadError`：通过 `reporter.info` 上报，强调静态资源加载失败，由 Slardar 静态资源异常统计接管。
        - `notInstanceError`：处理「不是 Error 实例」的异常（如某些组件库抛出的对象/字符串）：
          - 尝试 `JSON.stringify`，失败时写入固定文案 `notInstanceError json is invalid`；
          - 使用 `ReportEventNames.NotInstanceError` 统一上报。
  - [use-error-catch.ts](src/use-error-catch.ts)
    - React Hook，挂载在应用初始化阶段，用于统一捕获与上报错误：
      - 创建 scope 为 `namespace: 'bot-error', scope: 'use-error-catch'` 的 logger。
    - 捕获通道：
      - `unhandledrejection`：
        - 监听 `window.addEventListener('unhandledrejection', ...)`；
        - 在 `event.promise.catch` 里拿到真实 error，先 `sendCertainError`：
          - 可识别错误：走 `handleCertainError`；
          - 否则调用回调，使用 `ReportEventNames.Unhandledrejection` 进行统一上报，并在 meta 中打 `reportJsError: true`。
      - Slardar `beforeSend` 拦截：
        - 注册 `slardarInstance.on('beforeSend', beforeSlardarSend)`；
        - 若 payload 中存在 `error` 且为 `isCertainError` 且类型不是 `notInstanceError`：
          - 调用 `sendCertainError(error)`；
          - 返回 `false` 以拦截 Slardar 默认上报，避免重复；
        - 否则透传事件。
  - [use-route-error-catch.ts](src/use-route-error-catch.ts)
    - 与路由系统集成的错误捕获 Hook（主要用于路由级加载/渲染错误统一上报），细节实现请在修改前通读源码与测试；其行为与 `useErrorCatch` 一致但触发时机绑定在路由变更/路由错误边界上。
  - [const.ts](src/const.ts)
    - 定义 `ReportEventNames`（如 `CustomErrorReport`, `NotInstanceError`, `Unhandledrejection` 等）及 `CertainErrorName` 等类型，约束错误类型字符串的取值范围。
  - [global.d.ts](src/global.d.ts)
    - 若存在全局扩展类型（如对 `window` 或错误对象的补充字段），统一放在此处，确保 TS 能识别 Hook 与错误对象上的扩展属性。

- 测试目录：[__tests__](__tests__)
  - 覆盖 `CustomError`、各类 Chunk 错误 / CertainError 判定、以及 `useErrorCatch` / `useRouteErrorCatch` 的行为，
    是理解预期行为与边界 case 的首选入口，修改逻辑前建议优先阅读并扩充用例。

## 3. 依赖集成与跨子包交互

- `@coze-arch/logger`
  - 关键 API：
    - `logger.createLoggerWith({ ctx })`：创建带 namespace/scope 的子 logger，所有日志自动带上上下文字段；本子包统一使用 `namespace: 'bot-error'`。
    - `loggerWithScope.info(payload)`：记录开发调试向的信息日志。
    - `loggerWithScope.persist.error(payload)`：持久化错误日志，并触发监控上报（对接 Slardar/日志平台）。
  - `SlardarInstance`：
    - 通过 `slardarInstance.on('beforeSend', handler)` / `off` 注册/注销事件钩子；
    - 本子包只使用 `beforeSend` 事件对错误进行二次分类与拦截，不修改其它 Slardar 行为。

- `@coze-arch/bot-http`
  - 仅依赖其导出的 `isApiError`，用于在 `certain-error.ts` 的识别链中标记 API 层错误；
  - 约定：API 错误在 HTTP 层已经有独立上报逻辑，因此在本子包中被识别后直接 return，不再重复上报。

- `axios`
  - 使用 `isAxiosError` 区分 Axios 抛出的错误；
  - 逻辑与 `isApiError` 类似：只做识别与过滤，具体上报留给 HTTP 层或调用侧。

## 4. 开发、测试与调试流程

> 所有依赖管理与构建均由仓库根目录的 Rush/PNPM 统一管理，以下命令默认在根目录完成 `rush update` 之后再执行。

- 安装依赖：
  - 在仓库根目录执行：`rush update`。

- 在本子包内进行开发：
  - Lint：
    - 进入本子包目录：`cd frontend/packages/arch/bot-error`。
    - 执行：`npm run lint`。
  - 单元测试：
    - 执行：`npm test`（底层使用 `vitest`，配置来自 `@coze-arch/vitest-config`）。
  - 覆盖率：
    - 执行：`npm run test:cov`。
  - Build：
    - `npm run build` 当前为 no-op（`exit 0`），构建由上层打包/应用构建流程负责。

- 与应用集成调试：
  - 在实际业务应用中引入：
    - 错误类型：`import { CustomError, isCustomError } from '@coze-arch/bot-error';`
    - 全局错误捕获：`import { useErrorCatch } from '@coze-arch/bot-error';`
  - 调试 `useErrorCatch` 行为时：
    - 确保在 App 初始化阶段调用 `useErrorCatch(slardarInstance)`；
    - 通过手动触发 `Promise.reject`、抛出 `new CustomError(...)` 或模拟 Chunk 加载失败来验证日志与上报是否符合预期。

## 5. 约定、模式与实现细节

- 错误分类优先级与扩展：
  - `errorList` 在 [certain-error.ts](src/certain-error.ts) 中定义，顺序非常重要：越靠前的类型优先级越高。
  - 若需要新增某类错误（例如框架特定错误）：
    - 在 `errorList` 中追加 `{ func, name }`，同时在 `const.ts` 中扩展 `CertainErrorName`；
    - 在 `handleCertainError` 中增加对应分支，明确是否需要上报、如何上报以及是否拦截默认行为。
  - 修改 `errorList` 顺序可能会改变已有错误的归类结果，需谨慎并配合测试用例更新。

- 上报与日志规范：
  - 所有新增加的错误类型上报：
    - 应该使用统一的 `ReportEventNames` 常量；
    - `eventName` 与 `message` 务必可读，便于监控平台检索；
    - `meta` 字段中需要携带足够的上下文（如 `name`, `originEventName`, `originErrorMessage`, `stack` 等），但避免包含隐私/敏感数据。

- React Hook 使用约定：
  - `useErrorCatch` / `useRouteErrorCatch` 仅负责订阅与转发，不在内部捕获/屏蔽非 CertainError 之外的错误：
    - 对于不可识别错误，仅调用回调/兜底上报，由上层决定是否展示给用户；
    - 不应在 Hook 内吞掉同步抛出的异常。
  - Hook 的依赖数组目前固定为 `[]`，意味着只在组件挂载/卸载时注册/注销监听；如需依赖外部变量（如 slardar 实例替换），需要格外关注重复注册与泄漏风险。

- 非 Error 实例处理：
  - `notInstanceError` 用于兜底 semi 等第三方库抛出的非 Error 对象：
    - 优先 `JSON.stringify`，失败时记录降级文案；
    - eventName 固定为 `ReportEventNames.NotInstanceError`，用于在监控平台上单独过滤。

## 6. 协作开发与安全边界

- 修改流程建议：
  - 在调整错误分类/上报逻辑前，先阅读：
    - 对应实现文件（如 [certain-error.ts](src/certain-error.ts), [use-error-catch.ts](src/use-error-catch.ts)）。
    - 相关测试文件（如 [__tests__/certain-error.test.ts](__tests__/certain-error.test.ts), [__tests__/use-error-catch.test.ts](__tests__/use-error-catch.test.ts)）。
  - 为新增错误类型或 Hook 行为调整补充测试，确保：
    - 上报的 `eventName`、`message`、`meta` 字段符合现有约定；
    - 错误分类优先级不被意外打乱。

- 与其它子包的边界：
  - 错误「产生与携带」通常在业务代码或 HTTP 层（`@coze-arch/bot-http`）；
  - 本子包专注于「识别、归类与上报整合」，不直接改写请求/响应，也不维护独立异常类型枚举（只通过 `const.ts` 中的类型约束字符串）。

- 分支、发布与版本管理：
  - 分支策略、变更集与发布流程均由 monorepo 顶层 Rush 流程管理；
  - 修改本子包时遵循仓库根目录 [CONTRIBUTING.md](../../../../CONTRIBUTING.md) 中的规范，按需创建变更集并走统一 CI。
