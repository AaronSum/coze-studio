# idl2ts-generator 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/infra/idl/idl2ts-generator）中安全、高效地协作开发。

## 总体架构与职责
- 本包提供基于 IDL（thrift/proto）的 TypeScript 客户端、Schema 与 Mock 代码生成能力，是前端 IDL 工具链的一部分。
- 上游依赖：
  - @coze-arch/idl-parser：负责解析 IDL 抽象语法树（AST）。
  - @coze-arch/idl2ts-helper：封装 IDL 解析结果结构、生成文件模型（babel AST/json/text）、safeWriteFile 等工具。
  - @coze-arch/idl2ts-plugin：提供插件编排器 Program 及基础插件上下文体系（Ctxs）。
- 本包核心职责：
  - 定义生成流程的 Hook 体系（见 src/context.ts 中 HOOK 枚举和 Contexts 类型）。
  - 将 IDL 解析结果通过 Program + 插件管线，转换成 TS 客户端、JSON Schema、Mock 脚本等文件。
  - 控制输入（entries、idlRoot、parsedResult）与输出目录（outputDir），并按照 IDL 路径结构组织输出文件。
- 生成流程大致数据流：
  1. genClient 接收 IGenOptions，构造 ClientGenerator。
  2. ClientGenerator.parseAst() 通过 HOOK.PARSE_ENTRY 调用 parseDSL 解析 IDL 为 IParseResultItem[]。
  3. ClientGenerator.genFiles() 在 HOOK.GEN_FILE_AST 中调用 process()，把 AST 逐个喂给插件体系（HOOK.PROCESS_IDL_AST / PROCESS_IDL_NODE / PARSE_FUN_META 等），得到 IGentsRes（文件映射）。
  4. run() 将 IGentsRes 中的 babel/json/text 文件转成字符串，并通过 HOOK.WRITE_FILE + safeWriteFile 写入磁盘。

