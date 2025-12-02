
# @coze-arch/bot-http

## 包定位
- 提供 Bot Studio HTTP 基础设施，承担 axios 网络层、API 错误建模、事件总线与拦截器的统一职责，避免上层包重复实现 HTTP 逻辑；所有外部调用必须从 @coze-arch/bot-http 的 `src/index.ts` 导入能力。
- 该子包被 arch/api-schema、agent-ide/*、workflow/playground、data/knowledge/* 等大量上游直接依赖，任何变更都需要优先评估兼容性并考虑渐进式迁移。

## 架构
- `src/axios.ts` 构造单例 `axiosInstance`，统一注入认证、baseURL、超时、日志，并通过 `addGlobalRequestInterceptor` / `addGlobalResponseInterceptor` 等接口供业务自行扩展；不要在业务层 new axios。
- `src/api-error.ts` 定义 `ApiError`、`ErrorCodes`、`isApiError` 等，将 AxiosError/HTTP error 包裹成一致模型，便于事件总线或 UI 层统一判断；新增 Http 错误时必须新增对应的 `ErrorCodes` 常量与类型守卫。
- `src/eventbus.ts` 管理 APIErrorEvent 生命周期：`start`/`stop`/`clear` 控制全局分发，`emit` 仅负责广播，消费端在 handler 里自行负责 Toast、跳转、登录等副作用，必要时用 `stopAPIErrorEvent` 进入静默窗口。
- `src/global.d.ts` 集中声明本包在 window/global 上暴露的辅助类型，新增全局声明前请先确认是否能放在调用方本地；`src/index.ts` 负责聚合导出所有能力并作为唯一入口。
- 构建脚本是 no-op，源码由上游工具链直接引用；常规工作流包括 `npm test` / `npm run test:cov`（Vitest，preset: web，覆盖率要求由 rushx-config 中的 team-arch/level-1 设置）、`npm run lint`（@coze-arch/eslint-config），新增功能务必配套测试。

## 数据流
- 请求经过 `axiosInstance` 统一流程：Request 拦截器插入统一 header/traceId/认证，Response 拦截器做 data 解包与 biz-code 判断；新增 header/trace 时请通过 `addGlobalRequestInterceptor` 注册，并在不需要时用 `removeGlobalRequestInterceptor` 卸载。
- 错误数据全部封装为 `ApiError`，再交给 `emitAPIErrorEvent` 广播；不同 UI/功能模块通过 `handleAPIErrorEvent` 注册 handler，实现捕捉、提示或跳转，可在批量导入等场景通过 `stopAPIErrorEvent` 暂停分发，`startAPIErrorEvent` 重新启用，`clearAPIErrorEvent` 用于 teardown 清理。

## 模式
- 统一错误建模：catch 时先用 `isApiError` 判断，再按 `ErrorCodes` 处理，不允许直接判断 AxiosError 或用 `typeof/any` 跳过类型守卫。
- 事件驱动模式要求 handler 幂等、可重入，不在事件处理器中加入不可控副作用，Toast、Modal、路由等由上层视图层处理。
- 拦截器模式：所有跨请求 header/埋点、响应解包都委托给 `addGlobalRequestInterceptor` 或 `addGlobalResponseInterceptor`，避免业务层在多个位置散装逻辑，并在模块卸载时用 `removeGlobal...` 解除。
- 与 `@coze-arch/web-context` 的集成入口在本包，任何登录态、空间切换、导航行为都应通过本包封装的能力实现，禁止业务包重复实现这类逻辑。

## 集成
- 仅暴露 axios、@coze-arch/logger、@coze-arch/web-context 三个对外依赖，其他包统一使用本包导出的 `axiosInstance`、`ApiError`、事件总线等；禁止业务包自行 new axios 或定义重复的错误码常量。
- 典型上游集成方式：arch/api-schema 直接复用 axiosInstance 调用后端，agent-ide/* 以 `ApiError`/`isApiError` 安全展示错误，data/knowledge/* 与 workflow/playground 则依赖事件总线做统一提示或屏蔽。
- 变更约定属于 team-arch/level-1：PR 中需说明是否影响其它包、是否为破坏性变更；修改对外导出时附带受影响下游列表，必要时同步联调或发布升级说明。
