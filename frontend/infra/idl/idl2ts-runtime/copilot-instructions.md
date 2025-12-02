# idl2ts-runtime 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/infra/idl/idl2ts-runtime）中安全、高效地协作开发。

## 总体架构与职责

- 本包提供基于 IDL 生成的前端 HTTP 客户端在运行时的统一封装能力，是 idl2ts 工具链在浏览器/Node 端的“执行层”。
- 上游生成器会为每个 service/method 生成携带 IMeta 的调用函数，本包负责：
  - 维护服务级别的配置中心（configCenter），支持按 service/method 覆盖配置；
  - 将 IMeta + 业务入参转换为标准的 fetch 请求（URI、Query、Body、Header、Content-Type 等）；
  - 暴露 createAPI / createCustomAPI 等工厂方法，生成带中止控制的 ApiLike 实例。
- 设计目标：
  - 统一请求构造逻辑，降低由 IDL 到 HTTP 映射的心智负担；
  - 通过 clientFactory 注入真实请求实现，避免对具体 HTTP 库（fetch/axios 等）的硬依赖；
  - 支持通过 CustomAPIMeta 对非 IDL 接口做统一管理。
