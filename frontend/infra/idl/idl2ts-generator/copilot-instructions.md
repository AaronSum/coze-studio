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

## 目录结构与关键文件
- src/index.ts
  - 暴露 genClient(params: IGenOptions) 作为外部入口；
  - 重新导出 src/context.ts 中的 Hook/类型，供其他包复用。
- src/core.ts
  - ClientGenerator：生成流程核心类。
    - 构造函数：解析 options.entries 为绝对路径；根据 genClient/genSchema/genMock 标志，组装插件列表：
      - 总是加载：AutoFixPathPlugin, CommentFormatPlugin, AutoFixDuplicateIncludesPlugin, AdapterPlugin, MetaPlugin, IgnoreStructFiledPlugin。
      - 按需加载：ClientPlugin, PkgEntryPlugin（genClient），SchemaPlugin（genSchema），MockTransformerPlugin（genMock）。
    - parseAst(): 注册 HOOK.PARSE_ENTRY，使用 parseDSL 读取 IDL AST；
    - genFiles(): 注册 HOOK.GEN_FILE_AST，将 AST 交给 process() 并回填 ctx.files；
    - process(): 遍历 IParseResultItem 列表，依次调用 processIdlAst() 聚合输出；
    - processIdlAst():
      - 对 ast.statements 做位置排序，保证生成顺序稳定；
      - 组装 ProcessIdlCtx（dts/mock/output/meta 等）；
      - 在 HOOK.PROCESS_IDL_AST 中遍历 statements，对 serviceDefinition 触发 HOOK.PARSE_FUN_META，对所有节点触发 HOOK.PROCESS_IDL_NODE；
      - 使用 processFile 集避免同一 idlPath 被重复处理；
    - run(): 注册 HOOK.WRITE_FILE，根据文件类型（babel/json/text）生成字符串并写盘。
- src/context.ts
  - 定义 HOOK 枚举：PARSE_ENTRY / GEN_FILE_AST / PARSE_FUN_META / PARSE_FUN_META_ITEM / PROCESS_IDL_AST / PROCESS_IDL_NODE / GEN_FUN_TEMPLATE / GEN_MOCK_FILED / WRITE_FILE。
  - 为各 Hook 定义上下文类型（ProcessIdlCtxWithSchema、GenMockFieldCtx、WriteFileCtx、IProcessMetaItemCtx）；
  - 扩展 @coze-arch/idl2ts-plugin 的 Ctxs，形成本包专用 Contexts 泛型，用于 Program<Contexts>。
- src/type-mapper.ts
  - 把 IDL 基础类型（SyntaxType.*Keyword）映射为 TS 运行时原生类型字符串（'number' | 'string' | 'object' | 'boolean'）。
  - TypeMapper.map(BaseSyntaxType) 用于生成时做类型归类；TypeMapper.setI64() 允许在 number 和 string 之间切换 I64 表达方式（兼容长整型精度需求）。
- src/plugin/*
  - 各具体插件文件实现 Program 插件接口：
    - adapter-plugin.ts：与调用方或运行时适配相关的代码输出逻辑。
    - client-plugin.ts：根据 ServiceDefinition 生成客户端 API 封装。
    - schema-plugin.ts：基于 ajv/JSONSchemaType 生成 JSON Schema，并结合 ProcessIdlCtxWithSchema。
    - mock-transformer.ts：根据 GenMockFieldCtx 生成/转换 Mock AST（babel AST）。
    - meta-plugin.ts：在 PARSE_FUN_META/PARSE_FUN_META_ITEM 阶段抽取接口元信息。
    - pkg-entry-plugin.ts：生成包入口文件（index/聚合导出等）。
    - auto-fix-path-plugin.ts / auto-fix-duplicate-plugin.ts / comment-format-plugin.ts / ignore-struct-field.ts：对路径、重复 include、注释格式、字段过滤等做统一处理。
- vitest.config.ts
  - 使用 @coze-arch/vitest-config.defineConfig({ dirname: __dirname, preset: 'node' })，沿用 monorepo 统一测试配置。

## 开发与运行工作流
- 安装依赖（在 monorepo 根目录执行）：
  - rush install 或 rush update。
- 针对本包的常用命令（在 frontend/infra/idl/idl2ts-generator 下）：
  - 测试：npm test
    - 实际执行：vitest --run --passWithNoTests，借助统一 vitest config。
  - 覆盖率：npm run test:cov
    - 等价于 npm test -- --coverage，输出覆盖报告。
  - Lint：npm run lint
    - 调用 eslint ./ --cache，规则由 @coze-arch/eslint-config 提供。
  - 构建：npm run build
    - 当前实现为 exit 0，仅占位；调用方一般直接从 src 使用 TS 编译产物，因此 AI 助手不要依赖 build 生成物。
- 生成流程通常由上层 CLI/工具包（如 idl2ts-helper 或其它脚手架）驱动，本包本身不提供命令行入口，仅暴露函数 API。

## 约定与特殊模式
- Hook/插件驱动架构：
  - 所有生成逻辑尽量通过 Program.register(on(HOOK.*), handler, priority) 注册，而不是在 ClientGenerator 中写死；
  - 同一 Hook 可以被多个插件注册，按 priority（本包统一使用 ClientGenerator.PLUGIN_PRIORITY 常量）和 Program 内部顺序决定执行次序。
- AST 与文件输出模型：
  - 上下游通过 IParseResultItem 和 ProcessIdlCtx 传递 IDL AST 与输出；
  - IGentsRes 使用 Map<string, { type: 'babel' | 'json' | 'text'; content: any; }> 之类结构（定义在 @coze-arch/idl2ts-helper），本包只关心 type 并在 run() 中做最终序列化；
  - Mock 文件读取：getMockFile() 根据 idlPath 与 outputDir 推算 .mock.js 路径，若存在则通过 parseFile 解析成 babel AST 注入 ctx.mock。
- 去重与幂等：
  - processFile: Set<string> 用于确保每个 idlPath 只被处理一次，避免多入口复用时重复生成同一服务代码。
  - ast.statements.sort() 依赖 loc 信息排序，异常时仅打印 error，不中断整个生成流程。
- 类型映射的项目级配置：
  - TypeMapper.setI64('number' | 'string') 常用于适配不同运行时对 int64 的处理（如前端用字符串防止精度丢失）。

## 与其他子包/外部依赖的集成细节
- @coze-arch/idl-parser
  - 提供 SyntaxType 枚举和 IDL AST 结构；本包在 type-mapper.ts 中直接依赖 SyntaxType 常量。
- @coze-arch/idl2ts-helper
  - 关键类型：ProcessIdlCtx, IParseEntryCtx, IParseResultItem, IGentsRes, IGenTemplateCtx, FieldType, FunctionType, ConstValue 等；
  - 关键函数：parseDSL(entries, parsedResult, idlRoot)、createFile(initialContent)、parseFile(path)、safeWriteFile(path, content)、isServiceDefinition(node) 等；
  - AI 助手在实现新插件时，应优先复用这些工具，而不是自行构造 babel 文件模型或手写 fs 操作。
- @coze-arch/idl2ts-plugin
  - Program<Contexts> 为插件执行容器，on(HOOK) 用于注册 hook；
  - Ctxs 泛型在 src/context.ts 中扩展成本包专用 Contexts，确保 Program.trigger(HOOK, ctx) 时有完备类型提示；
  - 新插件应通过 default export 或命名导出暴露类/工厂，由 ClientGenerator 构造函数集中装配。
- ajv
  - Schema / AjvType / JSONSchemaType 用于 SchemaPlugin，生成 JSON Schema definitions；
  - Schema.definitions: Record<string, AjvType> 是整个 schema 聚合入口。
- @babel/*
  - @babel/types 与 @babel/generator 用于构造和打印 TS/JS AST；
  - 生成阶段统一使用 babel AST，而非字符串拼接，便于后续格式化和插件扩展。

## 团队流程与协作规范
- 版本与依赖：
  - 版本号在 package.json 中维护，通常与其它 idl2ts-* 包保持兼容；
  - 对工作区内依赖（workspace:*）的改动需同时考虑 idl2ts-helper / idl2ts-plugin / idl-parser 等包的影响。
- 测试与覆盖率：
  - 新增/修改插件或核心流程时，应在本包或上层调用方添加对应 vitest 单测，优先对 Hook 行为和生成结果做断言（例如生成文件 Map key/value、schema 结构、mock AST 形态）；
  - 可以使用 @vitest/coverage-v8 提供的覆盖率结果评估修改影响范围。
- 分支与提交：
  - 具体分支策略遵循仓库根目录 CONTRIBUTING.md 约定；本包没有独立的分支规范，AI 助手修改时只需保持变更局部、可读、与 monorepo 现有风格一致。

## 开发提示与注意事项
- 优先沿用现有 Hook 名称与生命周期，不随意新增 Hook；如确有需要，应在 src/context.ts 中集中声明并为其补齐上下文类型。
- 在 ClientGenerator.run() 之后，不再修改 res.files，避免与 WRITE_FILE Hook 写入内容不一致。
- 对性能敏感场景：
  - entries 可能较多，process() 会遍历所有 AST；在插件内应避免对全量 AST 做重复 O(n^2) 遍历。
- 错误处理：
  - 当前实现主要通过 console.error 打印排序异常，其余流程多依赖 Helper/Plugin 抛错；AI 助手在扩展功能时，应遵循现有做法：
    - 对非关键问题优先打印日志而非抛出致命异常；
    - 对违反数据约定的问题（如未知类型）可以抛错（参考 TypeMapper.map 中的处理）。
