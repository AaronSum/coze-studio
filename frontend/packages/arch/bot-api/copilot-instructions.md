# @coze-arch/bot-api

## 包定位
本包是「Bot Studio 前端」的 **RPC / HTTP API 聚合层**，为各业务前端提供统一的 TypeScript 客户端与类型定义。

## 架构
- 结构分层：
  - **IDL 层**：`src/idl/*.ts`，全部从 `@coze-arch/idl` 透传导出，约定为「只读 / 自动生成」，ESLint 已对该目录做特殊规则放宽（见 `eslint.config.js`）。
  - **Service 封装层**：如 `src/developer-api.ts`、`src/workflow-api.ts`，通过 `new XxxService<BotAPIRequestConfig>({ request })` 把 IDL 服务绑到统一 axios 客户端。
  - **HTTP 客户端层**：`src/axios.ts` 负责配置 `axiosInstance` 的 UI 行为（Toast、错误透传）并导出 `BotAPIRequestConfig` 扩展配置。
  - **聚合导出层**：`src/index.ts` 统一导出所有 Service、部分类型与 HTTP 工具，是包的默认入口，对外形成稳定 API 面。

## 集成
- 依赖关系：
  - 使用 `@coze-arch/idl` 暴露后端 Thrift/IDL 生成的类型与服务类（见 `src/idl/*`）。
  - 使用 `@coze-arch/bot-http` 提供封装好的 `axiosInstance`、错误类型与拦截器注册能力（见 `src/axios.ts`、`src/index.ts`）。
  - 使用 `@coze-arch/bot-semi` 的 `Toast` 做统一错误提示 UI（见 `src/axios.ts`）。
- 设计意图：
  - 将「传输协议＋错误策略」集中在本包，业务包只关心具体 Service 调用。
  - 通过 IDL 映射确保类型安全与接口变更集中管理。
  - 尽量保持无构建或轻构建（`npm run build` 为 no-op，读源代码即用）。
