# @coze-arch/bot-http 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-http）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包为前端 Monorepo 中的「Bot Studio HTTP 基础设施」，只负责：HTTP 客户端封装、API 错误建模、全局错误事件总线与拦截器管理。
- 对外暴露的核心能力集中在 src 目录：
  - src/axios.ts：创建并配置单例 axiosInstance，挂载全局 request/response 拦截器，统一注入认证信息、日志与错误转换逻辑。
  - src/api-error.ts：定义 ApiError、ErrorCodes、isApiError 等类型与工具，规范所有 Bot 生态前端对 API 错误的表示方式。
  - src/eventbus.ts：实现 APIErrorEvent 事件总线及控制函数（start/stop/clear/emit/handle/remove），用于在业务包之间广播统一的 HTTP 错误事件。
  - src/index.ts：集中导出上述对外 API，是其他子包的唯一入口，外部依赖方必须从 @coze-arch/bot-http 引用，而不是直接访问内部文件。
- 本包被多个高层包依赖（例如 arch/api-schema、agent-ide/*、workflow/playground、data/knowledge/* 等），因此任何破坏性修改都会在大量上层 UI/功能中放大；在做变更前，请优先考虑兼容性和渐进式迁移方案。
- 设计理念：
  - 将 axios 及错误处理从各业务仓解耦，避免散落的拦截器与不一致的错误结构。
  - 通过事件总线解耦「错误产生位置」与「错误展示/跳转逻辑」，便于不同应用层按需订阅与屏蔽。

## 关键开发工作流

- 构建
  - package.json 中 build 脚本当前为 no-op（"build": "exit 0"），本包以 TS 源码形式被其他包直连消费，构建逻辑由上游工具链统一处理。
- 测试
  - 单元测试：在包根目录执行：
    - npm test
    - 使用 Vitest，配置文件位于 vitest.config.mts，预设 preset: 'web'，通过 @coze-arch/vitest-config 统一管理。
  - 覆盖率：
    - npm run test:cov
    - 覆盖配置中对 src/index.ts 进行了排除（只作导出聚合，不计入 coverage）。
  - 对于 team-arch / level-1 包，本包在 rushx-config.json 中被纳入较高覆盖率要求（coverage / incrementCoverage），新增功能应配套测试。
- 代码质量
  - Lint：
    - npm run lint
    - 使用 @coze-arch/eslint-config，禁止随意引入自定义 ESLint 规则；若需例外，请遵循团队约定修改上游配置包。

## 代码结构与约定

- 目录结构（仅列对协作关键的部分）：
  - src/api-error.ts：
    - 定义 ApiError 类（扩展 AxiosError），字段包括 code、msg、type、hasShowedError、raw 等。
    - 定义 ErrorCodes 枚举（如 NOT_LOGIN、COUNTRY_RESTRICTED、COZE_TOKEN_INSUFFICIENT 等），是项目内统一的错误码常量。
    - 提供 isApiError 等类型守卫，用于在 catch 块中安全区分业务错误与其他异常。
  - src/axios.ts：
    - 暴露 axiosInstance 单例，不鼓励在业务代码中 new axios。
    - 集中配置 baseURL、超时、通用 header 以及 request/response 拦截器。
    - 暴露 addGlobalRequestInterceptor、removeGlobalRequestInterceptor、addGlobalResponseInterceptor 等接口，供业务包在需要时追加拦截逻辑。
  - src/eventbus.ts：
    - 定义 APIErrorEvent 结构以及事件处理器类型。
    - 通过内部列表维护所有已注册的错误处理函数，并提供 startAPIErrorEvent/stopAPIErrorEvent/clearAPIErrorEvent 控制全局行为。
    - emitAPIErrorEvent 仅负责分发事件，不承担 UI 逻辑；展示 Toast、Modal、跳转等由上层包决定。
  - src/index.ts：
    - 聚合导出 axiosInstance、ApiError、ErrorCodes、各类 isApiError / 事件总线 / 拦截器管理函数。
    - 新增 API 时务必从此文件导出，否则上层包无法使用。
- 类型与全局声明：
  - src/global.d.ts：声明与本包 HTTP/错误处理相关的全局类型（如在 window 上挂载的对象、辅助类型等）。
  - 若需新增全局类型，优先判断是否可在调用方本地声明；确需全局暴露时，请在该文件中集中管理并保持注释清晰。

## 项目特有模式与最佳实践

- 统一错误建模与识别
  - 所有 HTTP 层的业务错误都应包装为 ApiError 或其子类型，并通过 isApiError 进行判断：
    - catch (error) { if (isApiError(error)) { ... } }
  - 不建议在业务代码里直接使用 axios 的错误结构（AxiosError），以免破坏跨包的一致性。
- 事件驱动的错误处理
  - 通常在接入层（如 arch/api-schema、agent-ide/* 等）中注册全局错误处理：handleAPIErrorEvent(handler)。
  - handler 应保持幂等且可重入，避免在其中做强副作用逻辑（例如频繁路由跳转），这些应交由上层「视图/路由」模块二次封装。
  - 在需要屏蔽全局错误提示的时段（如批量导入、静默轮询），可用：
    - stopAPIErrorEvent() 暂停全局错误派发；
    - startAPIErrorEvent() 再次开启；
    - clearAPIErrorEvent() 在某些 teardown 场景下清理所有 handler，避免内存泄漏。
- 全局拦截器管理
  - 需要为所有请求追加 header / 埋点 / traceId 等，应通过 addGlobalRequestInterceptor，而不是在各处手动配置。
  - 对响应统一做 data 解包 / 业务码判断时，可通过 addGlobalResponseInterceptor 完成，在其中将原始响应转换为统一结果结构。
  - 在销毁对应业务模块时，注意使用 removeGlobalRequestInterceptor 解除拦截器，避免对后续无关请求产生影响。
- 与 Web Context 的集成
  - 本包通过 @coze-arch/web-context 处理未授权等场景下的导航行为（例如跳转登录页、空间切换），不要在业务包中重复实现这些行为。
  - 若需扩展此类集成逻辑，优先在本包中统一封装，而不是在各业务包里「自己判断错误码再跳转」。

## 对外集成与依赖关系

- 对外依赖：
  - axios：底层 HTTP 客户端，只应在本包内直接使用；其他包请始终使用从本包导出的 axiosInstance。
  - @coze-arch/logger：用于错误与关键 HTTP 行为的日志记录；新增日志时请遵循现有日志格式与埋点 key 命名方式。
  - @coze-arch/web-context：用于处理登录态、路由跳转等跨应用上下文行为。
- 典型上游集成模式（参考其他子包使用方式）：
  - arch/api-schema：通过 axiosInstance 调用后端 API，并依赖统一错误模型简化 schema 层处理。
  - agent-ide/*：在 UI 组件中使用 type ApiError / isApiError 安全展示 API 错误（如连接器表单错误展示等）。
  - data/knowledge/*、workflow/playground：作为通用 HTTP 底座，依赖本包的错误事件机制做统一提示和处理。

## 流程、规范与提交策略

- 分支与提交（遵循仓库通用规范，补充与本包相关的要点）：
  - 本包属于 team-arch / level-1：
    - 变更通常需要更严格的 Code Review；在 PR 描述中说明「是否影响其他包」与「是否有破坏性变更」。
    - 如需修改对外导出 API，请在 MR/PR 中显式列出影响的下游包，必要时同步联调或跟进升级文档。
  - 不在本包中直接引入与 HTTP 或错误无关的业务逻辑（如具体模块的 UI、存储逻辑等），避免侵入领域边界。
- 发布与消费
  - 版本管理由上层 Rush/工作流统一控制，本包的 version 主要用于对外标记；一般通过 workspace:* 在 Monorepo 内对齐。
  - 新增导出时，注意保持语义化版本；如存在破坏性修改，应配合仓库整体发布策略升级主版本并通知相关团队。

## 开发注意事项与反模式

- 优先使用统一能力，避免以下反模式：
  - 在其他包中直接 new axios() 或自定义 axios 实例；
  - 在局部随意 catch(error) 后通过 typeof / any 判断，而不走 isApiError；
  - 在各业务包中手写错误码常量，而不是复用 ErrorCodes；
  - 在业务层直接操作 window 进行导航或登录跳转，而不是通过 web-context / 本包封装的行为；
  - 随意改动 ApiError 结构或错误事件 payload 字段，导致下游判断失效。
- 编写/修改代码时的优先顺序建议：
  - 先检查 README.md 与现有导出 API 是否已有类似能力，可在其基础上扩展；
  - 对新增能力，保证：有类型定义（包括事件/错误结构）、有合理默认行为、必要时配套 Vitest 单测；
  - 任何可能影响大量请求行为（拦截器、错误转换）的改动，务必通过测试覆盖关键分支并在 PR 中描述兼容性策略。
