# @coze-arch/bot-api 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-api）中安全、高效地协作开发。

## 全局架构与角色定位
- 本包是「Bot Studio 前端」的 **RPC / HTTP API 聚合层**，为各业务前端提供统一的 TypeScript 客户端与类型定义。
- 依赖关系：
  - 使用 `@coze-arch/idl` 暴露后端 Thrift/IDL 生成的类型与服务类（见 `src/idl/*`）。
  - 使用 `@coze-arch/bot-http` 提供封装好的 `axiosInstance`、错误类型与拦截器注册能力（见 `src/axios.ts`、`src/index.ts`）。
  - 使用 `@coze-arch/bot-semi` 的 `Toast` 做统一错误提示 UI（见 `src/axios.ts`）。
- 结构分层：
  - **IDL 层**：`src/idl/*.ts`，全部从 `@coze-arch/idl` 透传导出，约定为「只读 / 自动生成」，ESLint 已对该目录做特殊规则放宽（见 `eslint.config.js`）。
  - **Service 封装层**：如 `src/developer-api.ts`、`src/workflow-api.ts`，通过 `new XxxService<BotAPIRequestConfig>({ request })` 把 IDL 服务绑到统一 axios 客户端。
  - **HTTP 客户端层**：`src/axios.ts` 负责配置 `axiosInstance` 的 UI 行为（Toast、错误透传）并导出 `BotAPIRequestConfig` 扩展配置。
  - **聚合导出层**：`src/index.ts` 统一导出所有 Service、部分类型与 HTTP 工具，是包的默认入口，对外形成稳定 API 面。
- 设计意图：
  - 将「传输协议＋错误策略」集中在本包，业务包只关心具体 Service 调用。
  - 通过 IDL 映射确保类型安全与接口变更集中管理。
  - 尽量保持无构建或轻构建（`npm run build` 为 no-op，读源代码即用）。

## 关键开发工作流
- 本子包使用 Rush 管理，多在仓库根目录执行命令：
  - 安装依赖：`rush update`
  - 进入子包：`cd frontend/packages/arch/bot-api`
- 常用脚本（见 `package.json`）：
  - 构建：`npm run build`
    - 当前实现为 `exit 0`，仅用于 CI 流水线占位；不要在此包里依赖构建产物，直接引用 `src/*` 即可。
  - Lint：`npm run lint`
    - 使用 `@coze-arch/eslint-config`，preset 为 `node`，对 `src/idl/*.ts` 放宽 `@coze-arch/no-batch-import-or-export` 规则。
  - 单测：`npm run test`
    - 使用 Vitest，配置在 `vitest.config.mts`，preset 为 `web`。
    - `test.exclude` 含 `src/auto-generate`，且覆盖率只统计 `src/axios.ts`。
  - 覆盖率：`npm run test:cov`
- Rush 质量检查：
  - 覆盖率门禁在 `frontend/rushx-config.json` 中定义：对 `team-arch` + `level-1` 包（本包即属于该组合）要求较高覆盖率，未来新增逻辑建议配套测试。

## 代码与模式约定
- **Service 封装模式**（示例见 `src/developer-api.ts`）：
  - IDL 默认导出是一个可实例化的 Service 类：`import DeveloperApiService from './idl/developer_api';`
  - 使用统一 `axiosInstance`：
    - `request: (params, config = {}) => axiosInstance.request({ ...params, ...config })`
    - 泛型统一为 `DeveloperApiService<BotAPIRequestConfig>`，使 `config` 支持业务扩展字段。
  - 新增 Service 文件时，请：
    - 1）在 `src/idl` 中确认/新增对应 IDL 透传文件；
    - 2）创建 `<domain>-api.ts` 使用同样模式封装；
    - 3）在 `src/index.ts` 中导出统一命名的实例（如 `xxxApi` 或 `XxxApi`），保持现有命名风格。
- **IDL 透传模式**（示例见 `src/idl/developer_api.ts`）：
  - 基本形式：
    - `export * from '@coze-arch/idl/developer_api';`
    - `export { default as default } from '@coze-arch/idl/developer_api';`
    - 如有全局枚举/类型需聚合，可选择性从 `@coze-arch/idl` 追加导出（如 `SuggestReplyMode`）。
  - 不要在 `src/idl` 下写业务逻辑，只做 re-export，便于自动生成覆盖或比对。
- **HTTP/错误处理模式**（见 `src/axios.ts`）：
  - 统一从 `@coze-arch/bot-http` 引入：`axiosInstance`、`isApiError`、`AxiosRequestConfig` 类型等。
  - 通过 `Toast.config({ top: 80 })` 设定全局提示位置；所有错误提示由此处统一控制。
  - 响应拦截器行为：
    - 成功：直接返回 `response.data`，上层 Service 调用无需再解包。
    - 失败：若 `isApiError(error)` 且存在 `error.msg` 且未设置 `config.__disableErrorToast`，则调用 `Toast.error({ content: error.msg, showClose: false })`，随后 `throw error` 保证调用方仍能捕获。
  - 扩展 config：`BotAPIRequestConfig` 在 `AxiosRequestConfig` 基础上新增 `__disableErrorToast?: boolean`。
  - **调用约定**：
    - 如调用方需要自行处理错误并禁用 toast，需显式传入 `{ __disableErrorToast: true }`。
- **导出规范**（见 `src/index.ts`）：
  - Service 实例多使用驼峰或首字母大写：`DeveloperApi`、`workflowApi`、`cardApi`、`xMemoryApi` 等，保持现有拼写，不要随意改名。
  - HTTP 相关：从 `@coze-arch/bot-http` 直接 re-export 全局事件/拦截器操作函数：
    - `APIErrorEvent`, `handleAPIErrorEvent`, `removeAPIErrorEvent`, `addGlobalRequestInterceptor`, `removeGlobalRequestInterceptor`, `addGlobalResponseInterceptor`。
  - 类型导出：
    - 例：`PaymentMethodInfo` 从 `src/idl/trade` 透出，以便其他包在不直接依赖 `@coze-arch/idl` 的前提下获取核心业务类型。

## 重要集成与外部依赖
- `@coze-arch/bot-http`：
  - 提供封装好的 axios 实例、API 错误类型及拦截器管理能力，是所有 Service 调用的基础层。
  - 相关使用集中在：
    - `src/axios.ts`：具体拦截器注册及 UI 行为。
    - `src/index.ts`：对外 re-export 错误事件和拦截器操作函数，便于上层应用统一注册。
- `@coze-arch/bot-semi`：
  - UI 套件中的 `Toast` 用于错误提示，目前只在 `src/axios.ts` 内使用，单测覆盖在 `__tests__/axios.test.ts`。
  - 若后续需要调整 toast 样式或行为，应仅改动 `src/axios.ts`，避免在其他文件直接调用 `Toast`，保持集中管理。
- `@coze-arch/idl`：
  - 汇总所有 Bot Studio 的接口定义与类型，是 Service 类的真正实现所在。
  - 本包仅做 re-export 与轻量封装，因此「接口签名变更」通常需要在 `@coze-arch/idl` 中更新后再同步到此处。
- 其他三方：
  - `axios`：HTTP 客户端，由 `@coze-arch/bot-http` 间接管理，本包不直接配置底层 axios 细节。
  - `query-string`：目前主要在具体 API 封装文件中使用（如带复杂 query 的接口），新增时保持统一使用该库拼接 query。

## 测试与质量约束
- 测试框架：Vitest（见 `vitest.config.mts`）。
  - 通过 `@coze-arch/vitest-config` 的 `defineConfig` 统一配置：
    - `preset: 'web'`，适配前端环境。
    - 排除 `src/auto-generate` 目录，避免对自动生成代码做覆盖率要求。
    - 覆盖率聚焦 `src/axios.ts`，确保错误处理与 Toast 行为稳定。
- 已有测试：
  - `__tests__/axios.test.ts`：
    - 使用 Vitest 的 mock 能力对 `@coze-arch/bot-semi` 和 `@coze-arch/bot-http` 进行模拟，只验证拦截器的行为，不发真实网络请求。
    - 覆盖场景包括：成功响应、API 错误有 msg、禁用 toast、无 msg、非 API 错误、null/undefined 错误等。
- 新增代码时建议：
  - 如更改 `src/axios.ts` 行为，必须更新或新增对应用例保证行为一致。
  - 对新增的 Service 文件，优先通过更高层业务包测试链路；如在本包直接写单测，倾向于 mock `axiosInstance` 只测试「正确拼装请求参数」。

## 项目流程与协作规范
- 分支与提交（参考仓库全局规范，仅总结与本包相关部分）：
  - 本包为 `team-arch` + `level-1` 设施类包，变更通常会影响多个上游应用，应：
    - 在提交前至少运行 `npm run lint` 与 `npm run test`；
    - 避免破坏 `src/index.ts` 的导出兼容性（删除/重命名导出需在调用方逐个迁移并同步修改文档）。
- 代码自动检查：
  - Rush 配置的 `packageAudit` 要求存在 `eslint.config.js`，该文件已在本包根目录，不要移除。
  - `dupCheck` 已对 `idl` 目录做全局排除，新增 IDL 文件不会触发代码重复告警；业务 Service 文件若大量复制粘贴，应适当抽取公共逻辑或接受必要的重复（视上游规范而定）。

## 特殊与需注意点
- **构建为空实现**：本包的 `build` 脚本是 no-op，任何「通过构建输出产物」的改造都与当前设计不符。AI 助手在重构时应假设「源码即运行时」模型。
- **IDL 视为外部真源**：`src/idl` 主要由 `@coze-arch/idl` 驱动，通常不在本仓手工编辑。对接口字段、返回值的变动，应优先在 `@coze-arch/idl` 所在项目修改。
- **统一错误提示策略**：
  - 所有通过本包发出的请求，其错误提示默认走 `Toast.error`，只有 `__disableErrorToast` 能抑制。
  - AI 助手在扩展 API 或改动错误处理时，应优先遵循这一集中式策略，而非在每个 Service 内部定制 UI。
- **命名兼容性**：`src/index.ts` 中的导出名已经在大量上游使用（如 `DeveloperApi`, `workflowApi`, `xMemoryApi` 等），任何重命名都会造成大范围 break change，除非用户明确要求，不要调整这些导出名或路径。
