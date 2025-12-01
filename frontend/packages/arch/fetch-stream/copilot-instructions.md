# @coze-arch/fetch-stream Copilot 使用说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/fetch-stream）中安全、高效地协作开发。

## 全局结构与职责划分

- 本子包是一个「基于 Fetch 的 HTTP 流式读取工具」，对浏览器 `fetch` + `ReadableStream` + SSE 解析进行封装，统一超时控制与错误信息结构。
- 目录结构：
  - src/
    - index.ts：对外入口，导出 `fetchStream`、错误码枚举和类型工具函数。
    - fetch-stream.ts：核心实现，负责发起请求、管理 ReadableStream 管道、超时定时器和回调调度。
    - type.ts：公共类型与错误码枚举，定义 `FetchSteamConfig`、`FetchStreamErrorCode`、`FetchStreamErrorInfo` 等。
    - utils.ts：与流解析和错误归一化相关的工具函数（`onStart`、`validateChunk`、`getFetchErrorInfo`、`getStreamingErrorInfo` 等）。
  - __tests__/：Vitest 单元测试，主要覆盖 type 和 utils 行为，验证类型约定和错误包装逻辑。
  - config/、tsconfig*.json、eslint.config.js、vitest.config.ts：工程配置，继承 monorepo 级别的 TS/ESLint/Vitest 预设。
- 主要数据流：
  1. 调用方通过 `fetchStream(requestInfo, config)` 传入请求信息和一组回调、校验器、超时设置。
  2. 内部自动引入 `web-streams-polyfill` 和 `@mattiasbuelens/web-streams-adapter`，在旧环境中补齐 `ReadableStream`/`TransformStream` 等能力。
  3. 使用 `fetch`（默认 `window.fetch`，可注入）获取 Response，经 `onStart` 做响应合法性校验（`ok && body`），失败时抛错交给 onError。
  4. 将 `Response.body` 通过 polyfill 包装为 `ReadableStream<ArrayBuffer>`，再依次 `pipeThrough` 自定义 TransformStream（SSE 解析 + `validateChunk`）并 `pipeTo` WritableStream（调用 `validateMessage`、`onMessage`）。
  5. 整个过程由 `totalFetchTimeout` 和 `betweenChunkTimeout` 两类定时器守护；任一阶段异常会通过 `getFetchErrorInfo`/`getStreamingErrorInfo` 归一成 `FetchStreamError` 后回调给 `onError`。

## fetchStream 核心行为与调用约定

- 入口：`fetchStream<Message = ParseEvent, DataClump = unknown>(requestInfo, config)` 定义在 src/fetch-stream.ts，通过 src/index.ts 再导出。
- Promise 语义：
  - `fetchStream` 返回 `Promise<void>`，只在以下情况 `resolve`：
    - 正常完成全部流读取并触发 `onAllSuccess`；
    - `AbortSignal` 被触发（此时只清理定时器，不视为错误，不触发 `onError`）。
  - 内部错误（fetch 错误 / 响应结构非法 / 流解析异常 / 业务校验异常）不会 reject，而是统一经 `onError` 回调通知调用方，再在内部结束流程。
- 事件时序（理想路径）：
  1. `onFetchStart?(dataClump)`：开始发起 fetch 前调用。
  2. 执行 `fetch(requestInfo, { signal, ...rest })`。
  3. `onStart(response)`：调用方可自定义响应校验逻辑；默认行为由 utils.onStart 在其后兜底检查 `response.ok && response.body`。
  4. `onFetchSuccess?(dataClump)`：fetch 成功且 `onStart` 未抛错时调用。
  5. `onStartReadStream?(dataClump)`：开始处理 ReadableStream 前调用。
  6. 流式读取阶段：
     - TransformStream.start：初始化 `eventsource-parser`，为每个 ParseEvent 调用 `streamParser`（若提供）或直接推入下游。
     - TransformStream.transform：对每个 chunk 文本调用 `validateChunk`，在抛错时触发上游 error（视为业务错误，如 `{ code, msg }`）。
     - WritableStream.write：逐条调用 `validateMessage?(message, dataClump)` 和 `onMessage?({ message, dataClump })`。
  7. 所有流处理正常结束后，触发 `onAllSuccess?(dataClump)`，随后 `Promise` resolve。
- 错误路径：
  - fetch 阶段：
    - 被 `AbortError` 中断（信号取消）：静默结束，不触发 `onError`。
    - 其他任何异常：将 error 交给 `getFetchErrorInfo`（错误码 `FetchException`），再调用 `onError({ fetchStreamError, dataClump })`。
  - 流阶段：
    - 被 `AbortError` 中断：静默结束，不触发 `onError`。
    - Transform / Writable / 自定义 `streamParser` / `validateMessage` 等抛错：交给 `getStreamingErrorInfo`（默认码 `HttpChunkStreamingException` 或从 `FetchStreamErrorInfo` 中继承），再调用 `onError({ fetchStreamError, dataClump })`。
- 定时器与超时：
  - totalFetchTimeout：整个 fetch+stream 流程的最大耗时上限，由 `setTotalFetchTimer` 统一管理：
    - 在开始 fetch 前设置定时器，到期只调用 `onTotalFetchTimeout?(dataClump)`，不会自动 abort 请求（由业务自行决定是否中断）。
    - 在流结束、异常退出或 abort 时会统一清理。
  - betweenChunkTimeout：分块间最大间隔时长，由 `setBetweenChunkTimer` 和 `clearBetweenChunkTimer` 管理：
    - 在开始读流时设置，收到每个新 chunk 时重置计时。
    - 超时只触发 `onBetweenChunkTimeout?(dataClump)`，同样不自动终止请求。

## 类型与工具函数约定

- 关键类型集中在 src/type.ts：
  - `FetchStreamErrorCode`：
    - `FetchException = 10001`：fetch 阶段错误，如网络异常、onStart 内抛错等。
    - `HttpChunkStreamingException = 10002`：流式阶段错误，如 JSON 解析合法但业务 code 非 0、校验失败等。
  - `FetchStreamErrorInfo`：
    - `{ code: FetchStreamErrorCode | number; msg: string }`，表示业务或流级别的错误信息。
  - `FetchStreamError`：扩展 `FetchStreamErrorInfo`，增加 `error: unknown` 原始错误对象。
  - `ValidateResult`：`{ status: 'success' } | { status: 'error'; error: Error }`，由 `validateMessage` 返回。
  - `FetchSteamConfig<Message, DataClump>`：
    - 继承原生 `RequestInit`，额外增加一系列回调和超时配置；所有回调大多接受 `dataClump` 透传业务上下文。
- 工具函数集中在 src/utils.ts：
  - `onStart(response, inputOnStart)`：
    - 先执行用户传入的 `onStart`（若有），允许其在内部抛错；
    - 随后若 `!response.ok || !response.body`，抛出 `Error('Invalid Response, ResponseStatus: ...')`，被上游捕获为 fetch 阶段异常。
  - `validateChunk(decodedChunk)`：
    - 尝试 `JSON.parse(decodedChunk)`，解析失败会被吞掉（流中非 JSON 片段是允许的）。
    - 若解析成功且结构为 `{ code, ... }` 且 `code !== 0`，直接 `throw json`，其类型通常被 `getStreamingErrorInfo` 识别为 `FetchStreamErrorInfo`。
  - `isFetchStreamErrorInfo(error)`：
    - 运行时 type guard，判断对象是否含有 `code` 和 `msg` 字段。
  - `getStreamingErrorInfo(error)`：
    - 默认 `msg` 为统一英文提示，`code` 为 `HttpChunkStreamingException`；
    - 若 `error instanceof Error`，覆盖 msg 为 `error.message`；
    - 若 `isFetchStreamErrorInfo(error)` 成立，则直接透传 `msg`、`code`；
    - 最终返回 `{ msg, code, error }`。
  - `getFetchErrorInfo(error)`：
    - 类似封装 fetch 阶段错误，默认 code 为 `FetchException`，msg 为英文提示或 `error.message`。
  - `isAbortError(error)`：判断是否为 `DOMException` 且 `name === 'AbortError'`，用于在 fetch/stream 阶段静默处理取消场景。

## 构建、测试与开发工作流

- 本子包脚本定义在 package.json：
  - `build`: 当前实现为 `exit 0`，即不执行真实构建；实际打包通常由上层 rush/构建流水线完成。
  - `lint`: `eslint ./ --cache`，使用 monorepo 共享的 `@coze-arch/eslint-config` 规则。
  - `test`: `vitest --run --passWithNoTests`，运行本包单测。
  - `test:cov`: `npm run test -- --coverage`，使用 `@vitest/coverage-v8` 生成覆盖率报告。
- 在 monorepo 中常见开发命令（根据整体 README 与 rush 配置）：
  - 在仓库根目录：
    - `rush update`：安装依赖。
    - `rushx test --to @coze-arch/fetch-stream` 或类似方式，仅对本包运行测试（具体命令以根目录 rush 配置为准）。
- Debug 建议：
  - 由于 `fetchStream` 强依赖浏览器环境（`window.fetch`、`DOMException`、web streams），若在 Node 环境下调试或测试，请显式注入 polyfill 或在 config 中提供自定义 `fetch` 实现。
  - 如果需要观察各阶段回调触发顺序，可在测试或 demo 中对 `onFetchStart`/`onFetchSuccess`/`onStartReadStream`/`onMessage`/`onAllSuccess`/`onError` 打印日志。

## 项目内约定与实现风格

- 错误处理：
  - 统一将内部异常（fetch 与流）封装为 `FetchStreamError`，通过 `onError` 回调对外暴露，而不是让 `fetchStream` Promise reject。
  - 取消（AbortError）被视为「正常退出」，不会进入 `onError`，也不会抛出异常。
  - 业务侧如需抛出自定义错误结构，应遵循 `FetchStreamErrorInfo` 结构，以便 `getStreamingErrorInfo` 识别并透传 code/msg。
- 业务错误判定：
  - 默认协议假设：服务端在流中按 JSON 结构返回 `{ code: number, msg: string, ... }`；
  - 当 `code !== 0` 时，`validateChunk` 会抛出该 JSON，被视为业务错误触发 `onError`，不再继续处理流。
- 回调风格：
  - 所有回调参数形态尽量统一为 `{ message, dataClump }` 或 `params?: DataClump`；
  - 建议调用方将与当前请求绑定的业务上下文封装成一个 `dataClump` 对象，避免在闭包中捕获过多游离变量。
- polyfill 策略：
  - 在运行时动态 `import('web-streams-polyfill/ponyfill')` 和 `import('@mattiasbuelens/web-streams-adapter')`，降低对构建环境的假设；
  - 通过 `createReadableStreamWrapper(ReadableStream!)` 适配浏览器和 polyfill 场景，确保后续 `pipeThrough`/`pipeTo` API 一致可用。
- 代码风格：
  - 遵循 monorepo 全局 ESLint 规则，如 `@coze-arch/max-line-per-function` 等，必要时在文件头以 `/* eslint-disable ... */` 显式关闭；
  - 函数命名偏向语义化（`getFetchErrorInfo`、`getStreamingErrorInfo` 等），保持类型和实现一一对应。

## 与外部依赖的集成细节

- `eventsource-parser`：
  - 用于解析 SSE（Server-Sent Events）格式的流，将原始文本 chunk 解析为 `ParseEvent` 结构；
  - `streamParser` 回调直接接收这些 `ParseEvent`，调用方可以：
    - 将感兴趣的事件映射为业务类型 `Message` 并返回；
    - 使用 `terminate()` 主动中止流处理；
    - 使用 `onParseError(error)` 抛出解析错误（已标记为 deprecated，更推荐使用业务错误返回机制）。
- `web-streams-polyfill` 与 `@mattiasbuelens/web-streams-adapter`：
  - 确保在不原生支持 WHATWG streams 的环境中仍可使用标准 `ReadableStream`/`WritableStream`/`TransformStream` 接口；
  - 通过 `createReadableStreamWrapper` 将 polyfill ReadableStream 适配至后续的管道处理链。
- Node/非浏览器环境注意事项：
  - 本库默认使用 `window.fetch`，在 Node 中必须通过 `fetch` 配置项注入 polyfilled fetch；
  - `DOMException` 在 Node 环境可能不存在，`isAbortError` 的行为依赖于全局实现，若你在 Node 中使用 AbortController，需自行确保兼容性。

## 测试与质量保证约定

- 测试位置：
  - `__tests__/type.test.ts`：验证错误码枚举取值与 `ValidateResult` 等类型预期行为。
  - `__tests__/utils.test.ts`：覆盖 `isFetchStreamErrorInfo`、`getStreamingErrorInfo`、`getFetchErrorInfo`、`validateChunk` 等工具函数的主要分支。
- 测试风格：
  - 使用 Vitest，断言风格为 `expect(...).toBe(...)` 等标准写法。
  - 测试用例多为行为驱动（「应该识别有效的 FetchStreamErrorInfo」等），增加新能力时应遵循同样的语义命名。
- 当你修改以下逻辑时，请优先补充/更新对应测试：
  - `FetchStreamErrorCode` 枚举值；
  - `validateChunk` 的业务错误识别规则；
  - `getStreamingErrorInfo`/`getFetchErrorInfo` 的封装策略；
  - `fetchStream` 中关于定时器、Abort、错误分支的控制流程。

## 团队协作与提交规范（本子包相关）

- 本仓库使用 monorepo + Rush，通常不在子包内单独改动 lockfile 或依赖版本，新增依赖应遵循仓库整体依赖管理策略。
- 分支与提交规范在仓库根部文档中统一规定；在本子包内开发时需遵守以下约束：
  - 保持公共导出接口（src/index.ts）稳定，若需破坏性变更，应在上层应用与文档（[frontend/README.md](frontend/README.md) 等）中同步更新。
  - 优先通过增加配置项和回调扩展行为，而不是在现有回调中加入隐式副作用。
  - 修改流控制逻辑（pipeThrough/pipeTo、超时、abort）时要注意不破坏已有语义：
    - Abort 始终视为非错误路径；
    - 业务错误应尽量结构化为 `FetchStreamErrorInfo`，保持上层可判别性。

## 适用于 AI 助手的开发建议

- 在本子包中进行变更时，AI 助手应重点关注：
  - 保持 `fetchStream` 的 Promise 行为和回调语义不变（resolve 只表示流程结束，不携带结果；错误通过 onError 暴露）。
  - 不要随意更改 `FetchStreamErrorCode` 的数值，这些枚举可能被上游服务或前端逻辑依赖。
  - 扩展配置项时，将其添加到 `FetchSteamConfig` 并在 src/fetch-stream.ts 中完整贯通；必要时补充 utils 中的封装函数。
  - 在引入新的外部依赖时，评估是否与现有 polyfill/流式处理逻辑兼容，并遵守 monorepo 的依赖管理策略。
- 在自动修复 ESLint 问题时，请尊重已有的文件级 `eslint-disable` 注释，避免无意改变函数结构或控制流，只修复与当前改动直接相关的告警。
