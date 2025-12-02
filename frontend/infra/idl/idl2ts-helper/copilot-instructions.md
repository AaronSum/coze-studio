# @coze-arch/idl2ts-helper 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/infra/idl/idl2ts-helper）中安全、高效地协作开发。

## 总体架构与角色定位

- 本包是 Coze Studio monorepo 的一部分，为 IDL（Thrift / Protobuf）到 TypeScript 的代码生成链路提供「通用辅助能力」，主要面向 idl2ts 系列工具（如 idl2ts-generator、idl2ts-plugin、idl2ts-runtime）。
- 该子包不直接负责 CLI 或最终代码生成入口，而是提供：
  - 基于 @coze-arch/idl-parser 的统一 AST 访问与类型工具（src/types.ts）。
  - 将 IDL AST 解析为带依赖信息的解析结果列表（src/parser.ts）。
  - 代码生成/转换时通用的上下文结构定义（src/ctx.ts）。
  - 基于 Babel AST 的 TS 代码构造、注释处理、路径计算、枚举值处理、字段别名解析等工具函数（src/helper.ts）。
  - 与文件系统相关的工具（safeWriteFile、路径处理等）和 protocol buffer 查找（src/utils.ts）。
  - 顶层统一导出入口（src/index.ts），作为对外统一 API。
- 典型数据流：
  1. 上层工具传入一个或多个 IDL 文件绝对路径与 idlRoot。
  2. 调用 parseDSL 解析 IDL，得到 IParseResultItem 数组，包含依赖图和 include 映射。
  3. 使用 src/types.ts 暴露的类型守卫与 AST 辅助工具遍历/筛选需要的语句（服务、结构、枚举等）。
  4. 基于 src/ctx.ts 中的上下文类型（如 IGenTemplateCtx、ProcessIdlCtx）组织生成过程，配合 src/helper.ts 的 Babel/Prettier 工具生成 TS 代码、Mock 文件或 JSON Schema。
  5. 使用 safeWriteFile 写入目标输出目录，并通过 getOutputName/getSchemaRootByPath 等函数保证路径、schema id 规范。
