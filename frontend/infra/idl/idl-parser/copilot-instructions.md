# AI 协作开发说明（@coze-arch/idl-parser）

本说明用于指导 AI 编程助手在本子包（frontend/infra/idl/idl-parser）中安全、高效地协作开发。

## 全局架构与数据流
- 子包职责：解析 Thrift / Protobuf IDL 文件，统一为内部抽象语法树（AST）模型 `UnifyDocument`，供 idl2ts-helper / idl2ts-generator 等上层工具消费。
- 对外入口：`src/index.ts` 仅 `export * from './unify'`，实际公共 API 在 `src/unify/index.ts` 与 `src/unify/type.ts` 中定义，例如：
  - `parse(filePath, option?, fileContentMap?) => UnifyDocument`
  - 各种 AST 结构体与 `SyntaxType` 枚举。
- 统一 AST 层：`src/unify/type.ts` 定义了 `UnifyDocument`、`ServiceDefinition`、`StructDefinition`、`FieldDefinition` 等统一节点类型；所有解析逻辑（Thrift/Proto）都输出这些类型，调用方只依赖本层。
- Proto 解析链路：
  - 使用三方库 `proto-parser` 解析 `.proto` 文本为 `ProtoDocument`（见 `src/unify/proto.ts`）。
  - 通过一系列 `convert*` 函数（例如 `convertMessageDefinition`、`convertServiceDefinition`）映射为统一 AST。
  - 支持导入依赖、命名空间解析和类型引用修复（`setImportedInfo`、`getReferValue`）。
- Thrift 解析链路：
  - 使用 `@lancewuz/thrift-parser` 解析 `.thrift` 文本为 `ThriftDocument`（见 `src/unify/thrift.ts`）。
  - 统一将 `Struct/Union/Service/Enum/Typedef/Const` 转为统一 AST，处理 namespace 与 include（`getUnifyNamespace`、`getAddNamespaceReferValue`）。
- 公共工具与扩展：
  - `src/utils.ts`：`logAndThrowError`（统一错误输出）、`mergeObject`、`getPosixPath` 等基础工具，供 `parse`、Thrift/Proto 解析路径和错误处理使用。
  - `src/common/extension_type.ts`：定义字段/函数/服务的扩展配置结构 `FieldExtensionConfig` 等，是统一 AST 上的“扩展元信息”载体。
  - `src/common/extension_util.ts`：从注解 / option 中抽取扩展配置（HTTP Method、Path、标签等），并提供过滤工具（`filterFieldExtensionConfig` 等）。
- 数据流总结：调用者只需提供入口 IDL 文件（以及可选的 `fileContentMap` / 搜索路径），`parse` 会：解析文件 → 解析 include/import → 归并命名空间与类型引用 → 附加扩展配置 → 返回统一 AST。

## 集成
- 直接依赖：
  - `@coze-arch/rush-logger`：用于在 `logAndThrowError` 中输出统一日志（在 `src/utils.ts` 中使用）。
  - `@lancewuz/thrift-parser`：解析 Thrift IDL。
  - `proto-parser`：解析 Protobuf IDL。
- 被使用方（示例）：
  - [frontend/infra/idl/idl2ts-helper/src/parser.ts](frontend/infra/idl/idl2ts-helper/src/parser.ts)：导入 `parse, UnifyDocument` 进行 IDL → TS 类型转换前的 AST 构建。
  - [frontend/infra/idl/idl2ts-generator/src/type-mapper.ts](frontend/infra/idl/idl2ts-generator/src/type-mapper.ts)：依赖 `SyntaxType` 区分枚举/结构体/服务等。
- 集成注意点：
  - 上游调用必须通过统一入口 `parse`，不要直接依赖 `src/unify/proto.ts` 或 `src/unify/thrift.ts` 的内部函数，以保持 API 稳定性。
  - 如果需要扩展新的扩展配置语义，应优先修改 `src/common/extension_type.ts` 与 `src/common/extension_util.ts`，再在 Proto/Thrift 两条链路中分别接入。
