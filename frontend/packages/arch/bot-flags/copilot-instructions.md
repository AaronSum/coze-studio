# @coze-arch/bot-flags 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-flags）中安全、高效地协作开发。

## 全局架构与数据流

- 子包职责：提供 Bot Studio 的 Feature Flag（特性开关）拉取、缓存、上下文读取以及 React 读写接口，是前端整体 feature gating 能力的一层封装。
- 对外 API：核心导出集中于 [src/index.ts](src/index.ts)，包括：
  - `type FEATURE_FLAGS, type FetchFeatureGatingFunction`（定义开关结构和远程拉取函数签名，见 [src/types.ts](src/types.ts)）。
  - `getFlags`：同步读取当前内存中的 flag 快照，见 [src/get-flags.ts](src/get-flags.ts)。
  - `useFlags`：React Hook 形式的订阅接口，见 [src/use-flags.ts](src/use-flags.ts)。
  - `pullFeatureFlags`：负责从多种来源拉取并落库的异步管线，见 [src/pull-feature-flags.ts](src/pull-feature-flags.ts)。
- 存储与事件总线：
  - `featureFlagStorage` 封装在 [src/utils/storage.ts](src/utils/storage.ts) 中，对外经 `getFlags` / `useFlags` 使用。
  - 内部基于 `eventemitter3` 实现订阅发布，在 flag 变更时发出 `change` 事件，驱动 React 组件重新渲染。
- 拉取管线（`pullFeatureFlags`）数据流：
  - 归一化参数 `normalize`（超时、重试、轮询间隔、strict 等）。
  - `runPipeline` 构造一组异步「工作」并 `Promise.race`：
    - 优先读取：
      - 静态上下文值：`readFgValuesFromContext`（全局上下文中的同步值）。
      - 远程接口：`fetchFeatureGating`（调用方注入）。
      - 浏览器全局 Promise：`readFgPromiseFromContext`（如 window 上挂载的异步结果）。
      - 本地持久化：`readFromCache`（如 localStorage / IndexedDB 之类的封装）。
    - 最后兜底：在超时后返回空对象（`bailout`），strict 模式下直接抛错。
  - Pipeline 会在每个成功分支中调用 `saveToCache`，并在最终通过 `featureFlagStorage.setFlags` 写入内存与事件总线。
  - 日志与埋点通过 `@coze-arch/logger` 和 [src/utils/repoter.ts](src/utils/repoter.ts) 完成，统一使用 `PACKAGE_NAMESPACE`（见 [src/constant.ts](src/constant.ts)）。
- React 使用模式：
  - 初次加载通常在应用启动位置调用一次 `pullFeatureFlags`（传入合适的 `fetchFeatureGating`），之后页面组件通过 `useFlags` 订阅。
  - `useFlags` 通过监听 `featureFlagStorage` 的 `change` 事件并使用 `useState` 的 dummy 计数器触发刷新，避免直接暴露 EventEmitter 细节。

## 开发 / 构建 / 测试工作流

- 构建：
  - 当前 `package.json` 中的 `build` 命令为 `exit 0`，实际打包由上层 Rush / 构建系统处理，本包只提供源码与类型。
  - TypeScript 配置：
    - [tsconfig.json](tsconfig.json)：主编译配置，继承 `@coze-arch/ts-config`，统一 monorepo 标准。
    - [tsconfig.build.json](tsconfig.build.json)：供构建/类型检查管线使用的裁剪版本。
    - [tsconfig.misc.json](tsconfig.misc.json)：用于额外脚本或工具场景的配置（保持与 monorepo 约定一致）。
- 测试：
  - 使用 Vitest，统一配置来自 `@coze-arch/vitest-config`，详见 [vitest.config.ts](vitest.config.ts)。
  - 关键配置：
    - `preset: 'web'`，`dirname: __dirname`，并通过 `test.setupFiles` 加载 [setup](setup) 目录内的初始化逻辑（如 JSDOM / 全局变量注入）。
    - 覆盖率统计 `all: true`，但排除 `src/index.ts`, `src/types.ts`, `src/feature-flags.ts`，说明这些是较稳定或纯导出模块。
  - 测试命令：
    - `npm test` / `pnpm test`：内部执行 `vitest --run --passWithNoTests`。
    - `npm run test:cov`：在上面基础上增加 coverage 报告。
  - 测试用例集中于 [__tests__](__tests__) 目录，覆盖：
    - 缓存逻辑：`persist-cache.test.ts` / `storage.test.ts`。
    - 上下文读取：`read-from-context.test.ts`。
    - 拉取主流程：`pull-feature-flags.test.ts`。
    - React Hook：`use-flags.test.ts`。
- Lint：
  - 使用 monorepo 统一 ESLint 配置 `@coze-arch/eslint-config`，本包入口为 [eslint.config.js](eslint.config.js)。
  - 本包脚本：`npm run lint` -> `eslint ./ --cache`。

## 项目特有约定与模式

- Feature Flag 读取与更新模式：
  - 所有读操作通过 `getFlags` / `useFlags` 完成，**不要**在业务代码中直接操作 `featureFlagStorage`，以避免破坏订阅与缓存一致性。
  - 拉取动作统一走 `pullFeatureFlags(context)`：
    - `context.fetchFeatureGating`：由上层注入的真正远程请求函数（通常是调用后端接口）。
    - `context.timeout`：毫秒级超时，内部会与 `ONE_SEC` 取 `Math.max`，确保不低于 1 秒。
    - `context.strict`：严格模式开关，为 `true` 时超时或异常会直接抛错，并不会落空对象。
    - `context.pollingInterval`：重试间隔。生产和开发建议由调用方根据环境传入，默认值为 `DEFAULT_POLLING_INTERVAL`（5 秒）。
  - `pullFeatureFlags` 在 `bailout`（兜底）或 `persist`（从缓存）命中的情况下会自动重试，以争取尽快拿到在线或上下文中的真实值。
- 多源数据合并策略：
  - 优先级：静态上下文 > 远程接口 > 浏览器全局 Promise > 本地缓存 > bail-out 默认值。
  - 每个阶段成功后都会调用 `saveToCache`，保证刷新后能至少从缓存恢复。
  - 所有来源都通过 `isObject` 做基础校验，非对象结果会被视为异常并记录日志。
- 事件与日志：
  - 日志统一使用 `logger.persist.*` 接口，带 `namespace: PACKAGE_NAMESPACE` 字段，便于后端汇总归档。
  - `reporter.tracer` 用于记录 `load-fg` 相关埋点，常见节点：`start` / `finish`。
  - 任何新增日志请保持相同字段结构与命名习惯（`message` 简明描述，`error` 传入原始 Error 对象）。
- React Hook 约定：
  - `useFlags` 返回 `[FEATURE_FLAGS]`（包裹在数组中而非对象），此为既有 API，请保持兼容。
  - Hook 内部不会触发拉取动作，只监听 storage；拉取应由上层应用负责（例如在 App 初始化或路由切换处调用 `pullFeatureFlags`）。

## 与外部模块的集成细节

- `@coze-arch/logger`：
  - 用于记录拉取结果、异常与上下文读取失败等情况。
  - 重要调用点集中在 [src/pull-feature-flags.ts](src/pull-feature-flags.ts) 中的 `runPipeline` 与外层 try/catch。
  - 日志级别：`success` / `info` / `error`，请按语义选择。
- `eventemitter3`：
  - 封装在 [src/utils/storage.ts](src/utils/storage.ts) 中，作为 feature flag store 的事件机制。
  - 对外公开的订阅接口通常是 `on('change', cb)` / `off('change', cb)`，`useFlags` 依赖这一约定。
- 全局上下文读取：
  - [src/utils/read-from-context.ts](src/utils/read-from-context.ts) 封装了从浏览器全局（如 `window.__FG__` 或某个 Promise）中取值的逻辑。
  - 在 Node / 测试环境下需通过测试 setup 或 mock 提前注入，实际值格式必须满足 `FEATURE_FLAGS` 约束。
- 持久化缓存：
  - [src/utils/persist-cache.ts](src/utils/persist-cache.ts) 负责落盘与读取，具体实现可以依赖 localStorage、indexedDB 或其他封装，但对外只暴露 `readFromCache` / `saveToCache`。
  - 修改持久化策略时务必保证 `readFromCache` 在缓存缺失场景返回 `undefined` 或 `null`，而不是抛异常；异常统一在 `runPipeline` 中捕获。

## 项目流程与协作规范

- 包管理与安装：
  - 本仓库使用 Rush 管理多包，bot-flags 子包在上层通过 `workspace:*` 依赖方式使用。
  - 安装或更新依赖统一使用仓库根目录下的 `rush update` / `rush install`（具体以根级 README 为准），不要在子包中单独跑 `npm install`。
- 分支与提交：
  - 参考 monorepo 根部的贡献指南 [CONTRIBUTING.md](../../../../CONTRIBUTING.md) 与团队既有分支策略（如是否采用 `feat/xxx` 命名、是否需要变更集等）。
  - AI 助手在生成改动时应保持最小化 diff，避免无意义的格式化或跨文件重构。
- 代码风格与检查：
  - TypeScript/ESLint 规则由 `@coze-arch/eslint-config` 和 `@coze-arch/ts-config` 统一管理，请不要在本包中随意添加局部覆盖，除非已有模式（如单行 `eslint-disable-next-line`）。
  - 测试覆盖率已有基础门槛设置，新功能尽量在 [__tests__](__tests__) 中补充对应用例，复用现有的 mock / helper。

## 本子包的特殊点与注意事项

- 多通道竞速拉取：
  - `runPipeline` 使用 `Promise.race` 合并多种来源，**任何新增来源都必须**：
    - 在异常时等待 `waitTimeout()`，防止过早 resolve 影响整体时序；
    - 在成功后调用 `saveToCache`；
    - 返回 `{ values, source }` 结构，其中 `source` 为区分日志与埋点的字符串常量。
- 超时与重试行为：
  - 默认超时 `timeout: 2000` ms，实际使用时允许调用方覆盖，但最低为 `ONE_SEC`（防止过短导致 pipeline 逻辑紊乱）。
  - `bailout` / `persist` 命中后会触发 `retry`，在网络抖动或后端短暂不可用时能自动恢复；strict 模式下则由调用方自身决定如何处理异常。
- Hook 返回值形态：
  - `useFlags` 目前返回只含一个元素的数组 `[flags]`，而非 `{ flags }` 或多个值的 tuple，这是既有公开 API，修改会影响大量上层调用方。
  - AI 助手在重构相关代码时请保持该签名不变，新增能力可通过补充新的 Hook 或工具函数实现。
- 日志与命名空间：
  - 所有日志都应使用统一 `PACKAGE_NAMESPACE`，便于后续在日志平台中按包聚合筛选。
  - 新增日志字段时，请尽量保持 Key 使用小写+下划线或小写+连字符风格，与现有格式保持一致。
