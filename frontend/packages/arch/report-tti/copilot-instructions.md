# @coze-arch/report-tti 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/report-tti）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是 Coze Studio 前端 monorepo 中的一个「架构级」子包，专注于**页面 TTI（Time To Interactive）性能埋点与上报**。
- 对外主要能力：
  - React Hook：`useReportTti`（入口在 src/index.ts），供上层页面/应用在合适时机调用，用于上报当前路由的 TTI。
  - 性能上报工具：`reportTti` 及相关常量/枚举（位于 src/utils/custom-perf-metric.ts），实现具体的性能事件计算与上报逻辑。
- 职责边界：
  - **本包只负责计算与上报 TTI 相关指标**，不直接依赖具体路由实现或业务 UI，仅通过 `performance` API 中的 mark/paint 事件和路由 mark（`route_change`）来推断场景。
  - 日志与上报依赖统一的日志包 `@coze-arch/logger`，复用 monorepo 统一的埋点与自定义性能指标上报通道（`getSlardarInstance`, `reporter`, `logger`）。
- 数据流：
  - 页面/容器在「可交互」时机设置 `isLive = true` 调用 `useReportTti`。
  - Hook 内部触发 `reportTti(extra, scene)`；
  - `reportTti` 使用浏览器 `performance` API + 自定义 mark（`route_change`）和 FCP(`first-contentful-paint`) 计算 TTI/TTI_HOT；
  - 通过 `getSlardarInstance()?.('sendCustomPerfMetric', ...)` 以及 `logger.info(...)` 将指标上报到监控与日志系统。

## 关键源码与模块说明

- 入口导出：
  - [src/index.ts](src/index.ts)
    - 导出 `useReportTti` Hook 和 `ReportTtiParams` 类型。
    - `scene` 参数默认值来自 `REPORT_TTI_DEFAULT_SCENE`，确保同一路由同一场景只上报一次。
    - 依赖关系：`useEffect`(React) + `reportTti`（utils 层）。
- 性能指标实现：
  - [src/utils/custom-perf-metric.ts](src/utils/custom-perf-metric.ts)
    - `CustomPerfMarkNames.RouteChange = 'route_change'`：约定外部路由逻辑会以此名称打 performance mark，并在 `detail.location.pathname` 中携带路由信息。
    - `PerfMetricNames`：
      - `TTI`：冷启动 TTI（首次路由）。
      - `TTI_HOT`：热启动 TTI（后续路由切换）。
    - `reportTti(extra?, scene?)`：
      - 使用 `performance.getEntriesByName('route_change')` 获取最后一次路由切换 mark；记录到 `lastRouteNameRef` 以避免同一路由 + 同场景重复上报。
      - 若 `document.visibilityState === 'hidden'`，认为当前 Tab 在后台，FCP/TTI 不可靠，写入 `reporter.info({ message: 'page_hidden_on_tti_report', namespace: 'performance' })` 后直接放弃上报。
      - 冷/热区分：
        - `routeChangeEntries.length > 1` 时视为热启动，`value - lastRoute.startTime` 作为 TTI_HOT 值，走 `executeSendTtiHot`。
        - 否则视为冷启动：
          - 若已存在 FCP entry，则取 `max(perf.now(), fcp.startTime)` 作为 TTI；
          - 否则用 `PerformanceObserver` 监听 `paint` 类型（FCP）后再上报。
      - 兼容逻辑：针对部分浏览器 `PerformanceObserver.observe` 需要 `entryTypes` 字段的情况，使用 try/catch + `PerformanceObserver.supportedEntryTypes` 做降级并用 `reporter.info` 记录错误信息。
    - `executeSendTti` / `executeSendTtiHot`：
      - 统一通过 `getSlardarInstance()?.('sendCustomPerfMetric', { value, name, type: 'perf', extra })` 上报自定义性能指标；
      - 同时用 `logger.info({ message: 'coze_custom_tti(_hot)', meta: { value, extra } })` 打日志，方便排查。

## 构建、测试与调试流程

- 本包自身构建：
  - package.json 中 `"build": "exit 0"`，说明本包目前**没有单独构建产物**或由上层工具统一打包，一般不直接在此子包执行构建逻辑。
- 测试：
  - `npm test` / `pnpm test`（在 monorepo 语境下一般通过 rush 或统一脚本调用）：
    - 实际执行：`vitest --run --passWithNoTests`。
    - Vitest 配置在 [vitest.config.ts](vitest.config.ts)，通过 `@coze-arch/vitest-config` 共享预设：
      - `preset: 'web'`，`test.globals = true`。
  - 覆盖率：`npm run test:cov` → `npm run test -- --coverage`，使用 `@vitest/coverage-v8`。
- Lint：
  - `npm run lint`：`eslint ./ --fix`。
  - 配置在 [eslint.config.js](eslint.config.js)：
    - 使用 `@coze-arch/eslint-config` 的 `preset: 'node'`，并通过 `packageRoot: __dirname` 指向当前包，统一 monorepo 规则。
- TypeScript：
  - TS 配置采用工程引用：
    - [tsconfig.json](tsconfig.json) 只声明 `"composite": true`，并引用 `tsconfig.build.json` 与 `tsconfig.misc.json`，实际编译细节在这两个文件中（由 monorepo 统一管理）。
  - 由于 `exports` 中直接指向 `./src/index.ts` 与 `./src/utils/custom-perf-metric`，一般开发时以源码形式被上层打包工具消费。

## 项目约定与编码风格

- 语言与框架：
  - TypeScript + React Hook（仅使用 `useEffect`），不定义 UI 组件，只提供逻辑 Hook。
- 性能埋点约定：
  - 统一使用 `performance.mark('route_change', { detail: { location: { pathname } } })`（由外部路由层负责）来标识路由切换；本包只读取此约定，不创建 mark。
  - 对首次/后续路由访问分别上报 `PerfMetricNames.TTI` 和 `PerfMetricNames.TTI_HOT`，区分冷/热加载性能。
  - 默认场景常量：`REPORT_TTI_DEFAULT_SCENE = 'init'`，防止重复上报时使用 `sceneKey` 标识同一路由下不同业务场景。
- 日志与埋点：
  - 所有日志和性能上报必须通过 `@coze-arch/logger`：
    - 常规 info 日志使用 `logger.info({ message, meta })`；
    - 轻量告警/信息埋点使用 `reporter.info({ message, namespace: 'performance' })`；
    - 性能指标统一通过 `getSlardarInstance()?.('sendCustomPerfMetric', {...})` 发送。
- 错误处理：
  - 不在外层抛异常，而优先：
    - 早返回（如重复上报、页面隐藏场景）；
    - 捕获异常并通过 `reporter.info` 上报错误信息。
  - 兼容性判断优先使用 feature detection，如 `PerformanceObserver.supportedEntryTypes?.includes('paint')`。

## 与外部系统与组件的集成

- 与路由系统：
  - 依赖外部在路由变化时调用浏览器 `performance.mark('route_change', { detail: { location: { pathname } } })`；
  - 冷/热启动判定完全基于 `route_change` mark 的数量与最后一条记录。
- 与监控平台（Slardar）/日志系统：
  - 使用 `getSlardarInstance()` 获取 Slardar SDK 实例：
    - 方法名 `sendCustomPerfMetric` 为统一约定，参数结构 `{ value, name, type: 'perf', extra }`；
  - 指标命名与含义：
    - `coze_custom_tti`：页面从起始时间到可交互的冷启动 TTI。
    - `coze_custom_tti_hot`：路由跳转后的热启动 TTI。
- 与 React 应用：
  - 上层页面可以在「关键 UI 元素 ready」或「业务认为可交互」时，将 `isLive` 置为 `true` 触发上报：
    - 通常搭配路由和数据加载，如：路由切换完成 + 首屏关键数据加载结束后。
  - `extra` 对象用于补充额外维度（如页面类型、AB 实验、用户分群），将被透传到自定义性能指标与日志中。

## 开发流程与协作规范

- Monorepo 工作流：
  - 包管理由 Rush + workspace 版本管理，安装依赖通常在仓库根目录运行：`rush update`。
  - 引用本包时使用 `"@coze-arch/report-tti": "workspace:*"`，避免在本包内硬编码具体版本。
- 分支与提交：
  - 遵循仓库整体 Git 流程（参考根目录 CONTRIBUTING.md / README），本包没有自定义分支策略，但要注意：
    - 修改埋点逻辑前需评估对监控指标含义的影响。
    - 修改 `PerfMetricNames` 或上报字段时要兼容现有监控看板与告警规则。
- 测试与回归：
  - 新增/修改逻辑时优先在 `__tests__` 目录（若存在）添加/更新单测，使用 Vitest。
  - 特别关注以下用例：
    - 重复路由访问不应重复上报同一场景；
    - 后台 Tab / `visibilityState === 'hidden'` 不上报；
    - FCP 已有与尚未产生两种分支；
    - 热启动场景（多次 `route_change` mark）。

## 开发注意事项与反模式

- 避免在 `useReportTti` 中：
  - 执行业务 side-effect（如直接操作 DOM、发接口等），这里应仅负责触发性能上报。
  - 引入与性能监控无关的依赖，保持本包轻量且可在多处复用。
- 浏览器环境假设：
  - 代码假定运行在支持 `performance`、`PerformanceObserver`、`document.visibilityState` 的浏览器环境。
  - 若后续需要在 Node/SSR 环境使用，需要在调用方增加环境判断或在本包中增加安全 guard。
- 修改监控事件名称或结构前：
  - 必须检查现有监控告警、报表与其他包（如统一埋点 SDK）对这些名称的引用，避免破坏线上观测。

## 供 AI 助手的实践建议

- 在新增能力时，优先复用现有模式：
  - 若需要新增性能指标（如自定义 LCP、FID），建议：
    - 在 `PerfMetricNames` 中新增枚举；
    - 复用 `executeSendTti/executeSendTtiHot` 结构或抽象出通用 `executeSendCustomPerfMetric` 工具；
    - 保持与 `@coze-arch/logger` 的使用方式一致。
- 在修改 `reportTti` 或 `useReportTti` 时：
  - 保持接口签名向后兼容（参数字段新增时使用可选属性 + 合理默认值）。
  - 对可能改变上报频率或计算方式的改动，务必添加/更新单测并在 PR 描述中说明变更影响。