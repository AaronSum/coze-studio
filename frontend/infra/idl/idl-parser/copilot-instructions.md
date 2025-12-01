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

## 关键开发/运行工作流
- 构建
  - 本包 `package.json` 中 `build` 脚本目前为 `exit 0`，实际 TypeScript 编译依赖 Rush 整体构建。
  - 在 monorepo 根目录：
    - 运行 `rush build -t @coze-arch/idl-parser` 只构建本包依赖链（标准 Rush 使用方式）。
- 测试
  - 本包使用 Vitest，并通过共享配置 `@coze-arch/vitest-config`：
    - 在子包目录执行：`pnpm test` 或 `rushx test`（视 monorepo 通用约定而定）。
    - `package.json` 中：`test`: `vitest --run --passWithNoTests`，`test:cov`: `npm run test -- --coverage`。
  - 测试文件位于 `__tests__` 目录：
    - Thrift 相关：`thrift.*.test.ts`（字段、枚举、服务、函数等）。
    - Proto 相关：`proto.*.test.ts`。
    - Unify 层：`unify.*.test.ts`、`demo.*.ts` 等展示、断言统一 AST 结构。
  - 修改解析逻辑（`src/unify/*.ts`、`src/common/*`）后，应优先补充/调整对应测试用例，再运行测试确认。
- Lint
  - 使用 monorepo 通用 ESLint 配置 `@coze-arch/eslint-config`：
    - 在子包目录运行：`pnpm lint` 或 `rushx lint`。
  - 注意已有规则：
    - `import/prefer-default-export: off` 等按文件顶部注释定制。

## 项目特有约定与模式
- 统一 AST 设计：
  - 所有解析结果都必须遵守 `src/unify/type.ts` 中定义的接口与 `SyntaxType` 枚举，避免在上游直接暴露 Proto/Thrift 的 AST 类型。
  - 对字段、函数、服务等统一暴露 `extensionConfig` 字段，用于承载 HTTP / AGW 相关扩展信息。
- 文件与路径约定：
  - `parse` 的 `filePath` 可以是 `.thrift` 或 `.proto`，函数内部根据后缀自动分流；无后缀或错误后缀会通过 `logAndThrowError` 抛出统一错误。
  - 所有内部路径统一转换为 POSIX 风格字符串（`getPosixPath`），并通过 `root` / `searchPaths` 组合解析 include/import。
  - `ParseOption.root` 默认为 `.`，相对 `process.cwd()` 解析。
- 缓存与多文件解析：
  - Thrift/Proto 解析层都有文件级缓存 `fileDocumentMap`，受 `ParseOption.cache` 控制。
  - 当传入 `fileContentMap` 时：
    - 仅通过该映射取内容，不访问文件系统；Key 必须为相对路径（如 `path/to/file.proto`），不含 root 前缀。
    - 若映射缺失，将通过 `logAndThrowError` 抛出明确错误信息。
- 命名空间与类型引用规则（Proto）：
  - 使用原始 `package` 作为逻辑命名空间，统一命名空间 `unifyNamespace` 则改写为下划线+去非法字符形式。
  - `getReferValue` 针对多种引用形式做解析：
    - 完整限定名：`.a.b.c.Type`。
    - 省略前缀的短引用：`b.c.Type`，结合当前 `entryNamespace` 与 field scope 做回溯匹配。
    - 跨文件引用：利用 `namespaceFilenamesMap` 和 `filenameTypeNamesMap` 来分辨定义位置。
- 命名空间与类型引用规则（Thrift）：
  - `getUnifyNamespace` 优先取 `namespace js/go/py`，其次 `namespace java` 的末段；若均不存在则报错提示“a js namespace should be specifed”。
  - `getAddNamespaceReferValue` 通过 include 的 Thrift 文件推导统一命名空间，并对标识符 `namespaceValue` 进行补全（含 Enum 前缀场景）。
- 扩展配置抽取：
  - Proto：
    - 从 method / field 的 option key 中抽取，如 `(api.xxx)`、旧规则 `(api_method).`、`(pb_idl.api_method).`、`(google.api.http).` 等。
    - 通过 `extensionUtil.extractExtensionConfig` 解析出 `ExtensionConfig`，再经 `filter*ExtensionConfig` 过滤为专用配置。
  - Thrift：
    - 从注解 `@foo` 中抽取，以 `agw.` / `api.` / `go.tag` 前缀为入口；默认会过滤掉非这些前缀的注解。
    - `ignoreGoTag` / `ignoreGoTagDash` 选项控制对 `go.tag` / `-` 的特殊处理（如 `omitempty` / `ignore`）。
  - 字段扩展 `tag` 中包含：
    - `required`：在 Proto 下可覆盖 `optional` 的默认语义。
    - `int2str`：通过 `convertIntToString` 将整型字段（含 map/list 嵌套）转为 string。
    - `ignore`：在 Thrift 下会跳过该字段（配合 `ignoreGoTagDash` 决定具体行为）。
- 注释归属规则：
  - Thrift 解析层通过 `reviseFieldComments` / `reviseFuncComments` 做注释行号修正：
    - 保证行尾注释正确归属到相应字段/函数，而非前一个/后一个节点。
  - 新增字段/函数生成逻辑时，若改变 AST 节点的 `loc` 或顺序，需要格外注意不破坏这些假设。

## 与其他子包的集成关系
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

## 项目流程与协作规范（本子包粒度）
- 代码风格：
  - 严格遵守共享 ESLint / TSConfig 规范，注意顶部版权头声明格式，与 monorepo 其他包保持一致。
  - 避免在解析层引入与 IO / 进程环境无关的外部依赖，保持该包纯“解析+建模”。
- 变更约定：
  - 任何修改 `UnifyDocument` / `SyntaxType` 或扩展配置结构的变更，都属于“跨包 breaking change”，应：
    - 先在本包补充覆盖测试；
    - 再在依赖包（如 idl2ts-helper / idl2ts-generator）中做对齐修改。
  - 错误信息通过 `logAndThrowError` 抛出，应包含：简短 message + 详细路径/行号信息，避免静默失败。

## 不寻常/需要特别注意的点
- `build` 脚本形同空操作：
  - 单独在子包目录执行 `pnpm run build` 不会产生编译产物；实际构建依赖 Rush pipeline 和上层工具链。
- 复合命名空间与类型引用逻辑较复杂：
  - Proto 解析中 `getReferValue` 会在多层 namespace 与 filename 之间做穷举匹配；修改时需同步调整测试（`proto.*.test.ts` 与 `unify.*.test.ts`）。
- Thrift `namespace` 解析与错误：
  - 若 Thrift 中未声明 `namespace js/go/py/java`，会立即抛错提示“a js namespace should be specifed”，这是显式设计，用于强制约束 IDL 规范。
- 注解驱动的语义转换：
  - `int2str` / `ignore` / HTTP 路由等行为完全依赖注解和 option key；如需扩展，用例必须放在 `__tests__` 中，并考虑向后兼容旧规则（如 `oldRuleRegExp` 中的 `(api_method).` 等）。

## AI 助手实现修改时的建议
- 若要新增解析特性：
  - 先判断逻辑属于 Proto / Thrift 解析层，还是属于统一 AST 后处理层；尽量避免在 `parse` 中塞入复杂业务逻辑。
  - 对应地补充统一 AST 的类型定义（如新增 SyntaxType 枚举值和对应 interface），并确保不破坏现有字段含义。
- 若要调整错误处理：
  - 始终通过 `logAndThrowError` 抛错，保持错误格式统一，便于上层工具捕获和展示。
- 在大规模重构前：
  - 先运行本包测试，理解现有行为边界；再通过小步修改+频繁测试的方式进行，避免破坏跨文件/跨命名空间解析的隐含假设。
