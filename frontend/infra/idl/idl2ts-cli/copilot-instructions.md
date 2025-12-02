# idl2ts-cli 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/infra/idl/idl2ts-cli）中安全、高效地协作开发。

## 1. 子包角色与整体架构

- 本包是 IDL（thrift/pb）到 TypeScript 客户端代码的命令行入口，依赖下游三大核心包：
  - @coze-arch/idl2ts-generator：负责编排 IDL 解析与代码生成流程（本包通过 genClient 调用）。
  - @coze-arch/idl2ts-helper：提供 AST/类型判断、遍历、工具函数等。
  - @coze-arch/idl2ts-plugin：定义插件体系、Program 对象与钩子（HOOK）。
- CLI 对外暴露一个二进制命令 idl2ts（package.json 中 bin 指向 src/cli.js），核心流程：
  1. 使用 commander 在 src/cli.ts 中解析子命令与参数；
  2. 根据 projectRoot 加载项目侧配置（api.config.js 或 api.filter.js）；
  3. 为每个配置项组装插件链、转换路径，并调用 genClient 完成代码生成。
- CLI 支持两类主流程：
  - gen：按配置生成完整 API 客户端代码；
  - filter：根据 filters 只生成指定 service/method 相关的最小类型集合。
- 所有“业务定制”都通过插件机制实现，本包只拼装参数和内置插件，不直接操作底层 Thrift/PB AST 结构。
