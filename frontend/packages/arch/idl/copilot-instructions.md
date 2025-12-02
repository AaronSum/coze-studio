# frontend/packages/arch/idl

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/idl）中安全、高效地协作开发。

## 子包定位与整体架构

- 本子包位于 monorepo 前端部分：frontend/packages/arch/idl，对应 rush 管理的一个 package（packageName: "@coze-arch/idl"）。
- 职责：集中管理与「IDL（接口/领域定义）」相关的前端资源，如 TypeScript 类型定义、契约对象、生成脚本或与后端 thrift/IDL 的映射工具；常作为其它 arch 子包或应用的底层依赖，而不直接与 UI 交互。
- 典型结构（以现有文件为准，以下为预期形态）：
  - frontend/packages/arch/idl/src/**：IDL 相关的核心源码（类型、模型、工具函数）。
  - frontend/packages/arch/idl/scripts/**：IDL 生成、对齐或校验脚本（如从 idl/ 目录生成 ts 类型）。
  - frontend/packages/arch/idl/package.json：定义 name、version、main/module/exports、build/test 脚本和依赖。
  - frontend/packages/arch/idl/tsconfig*.json：本包 TypeScript 编译配置，通常继承仓库公共 tsconfig 基础配置。
- 依赖关系上的角色：
  - 作为「领域描述 / 协议层」，上游通常是根目录 idl/ 下的 thrift / proto 等文件以及后端服务定义。
  - 下游为 frontend/apps/** 和其它 frontend/packages/arch/** 子包，通过导入本包导出的类型与常量保证前后端契约一致。

