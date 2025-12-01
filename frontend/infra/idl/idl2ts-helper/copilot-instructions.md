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

## 源码结构与关键文件

- README.md：只提供基础介绍，无详细 API 文档，实际行为以 src 源码为准。
- package.json：
  - main 指向 src/index.ts（TS 源文件由上层构建系统处理），脚本：
    - build: "exit 0" —— 本包不独立构建，由 monorepo 统一构建流程负责。
    - lint: "eslint ./ --cache" —— 使用 monorepo 提供的 @coze-arch/eslint-config。
    - test: "vitest --run --passWithNoTests" —— 使用 @coze-arch/vitest-config 预设，无测试文件时视为成功。
  - dependencies：
    - @coze-arch/idl-parser：IDL 解析核心依赖，本包大量类型与工具直接 re-export 自该库。
    - @babel/parser / @babel/template / @babel/types：生成/解析 TS AST，用于构造类型定义、接口等。
    - fs-extra：文件写入与目录创建（safeWriteFile）。
    - prettier：统一生成代码格式（formatCode）。
- tsconfig.json / tsconfig.build.json / tsconfig.misc.json：
  - 顶层 tsconfig.json 只做 references 聚合，exclude 全量排除，真正编译配置在 tsconfig.build.json 和 tsconfig.misc.json 中（由 monorepo 统一管理）。
- vitest.config.ts：
  - 使用 @coze-arch/vitest-config.defineConfig，preset = "node"，dirname = __dirname，测试运行规则来自共享配置。

### src 目录

- src/index.ts
  - 单纯的 barrel 文件：export * from './parser'; './types'; './ctx'; './utils'; './helper'。
  - 对外使用时尽量从包根 import，便于未来重构：
    - import { parseDSL, IParseResultItem, formatCode, getOutputName, ... } from '@coze-arch/idl2ts-helper';

- src/types.ts
  - 核心职责：
    - re-export @coze-arch/idl-parser 暴露的所有类型/枚举（export * from '@coze-arch/idl-parser'），统一调用方的类型来源。
    - 定义解析结果包装类型 IParseResultItem：
      - 继承 UnifyDocument，并增强：
        - idlPath：当前 IDL 文件绝对路径。
        - includeMap：include 相对路径到绝对路径的映射。
        - deps：依赖文件路径到 IParseResultItem 的映射（完整依赖图）。
        - isEntry：标记是否为调用 parseDSL 时的入口 IDL。
    - 定义若干带 annotations 的基础类型别名（I64Type、I32Type、StringType 等），方便对 i64、string 等进行额外注解处理。
    - 一组类型守卫函数，用于判定 AST 节点类型：
      - isServiceDefinition / isStructDefinition / isEnumDefinition / isTypedefDefinition / isConstDefinition。
      - isIdentifier / isBaseType / isI64Type / isMapType / isSetType / isListType。
      - isIntegerLiteral / isHexLiteral / isStringLiteral / isAnnotations / isIntConstant / isDoubleConstant / isBooleanLiteral / isConstMap / isConstList。
    - findDefinition：在 UnifyStatement[] 中按 name.value 查找定义。
  - 在任何 AST 处理逻辑中，应优先使用这些类型守卫和 findDefinition，而不是手写字符串比较。

- src/parser.ts
  - 核心入口 parseDSL(idlFullPaths: string[], parsedRes?: IParseResultItem[], idlRoot = process.cwd())。
  - 主要逻辑：
    - 支持传入多个 IDL 路径，统一归一为 entries 列表。
    - 使用 @coze-arch/idl-parser.parse 解析单个 IDL：
      - 参数：cache=false、ignoreGoTagDash=false、root=idlRoot、namespaceRefer=true、searchPaths 以当前文件目录为主。
    - 对每个 IDL 构造 IParseResultItem：
      - 初始化 deps = {}、includeMap = {}、idlPath、isEntry。然后加入结果集合，避免重复解析。
    - 处理 includes：
      - 过滤掉 google/(protobuf|api) 前缀的 include（这类 proto 文件被视为公共库，跳过）。
      - 对 .proto 使用 lookupFile 在 [当前目录, idlRoot] 中查找真实文件路径，否则使用 path.resolve 拼出 include 目标。
      - 递归调用 _parse 收集子结果，并在当前 IParseResultItem.deps 和 includeMap 中登记。
      - 对非 proto 文件：利用 getNamespaceByPath 取得命名空间，存入 includeRefer（来自 idl-parser 的 UnifyDocument 字段），再通过 uniformNs 归一为合法标识符。
    - 最终返回去重后的 IParseResultItem[] 列表，所有 entry 的依赖都在其中。
  - 注意点：
    - 通过 results.find(i => i.idlPath === res.idlPath) 去重；同一路径只解析一次，后续解析标记 isEntry 即可。
    - isPbFile(idlFullPaths[0]) 以第一个入口文件后缀判断是否走 proto 分支。

- src/ctx.ts
  - 只定义类型，不包含逻辑，主要用于生成流水线中的上下文串联：
    - BaseCtx：索引签名 { [key: string]: any }，允许扩展信息挂载。
    - IMeta：描述单个 HTTP RPC 接口的元信息：
      - reqType / resType：请求和响应 TypeScript 类型名。
      - url / method：HTTP 路径和方法。
      - reqMapping / resMapping：请求/响应字段到 HTTP 各部分的映射（IHttpRpcMapping）。
      - name / service / schemaRoot / serializer：方法名、服务名、schema 根 id、序列化方式等。
    - IHttpRpcMapping：将字段列表划分到 path/query/body/header/status_code/cookie/entire_body/raw_body 等 HTTP 位置。
    - BaseContent：包裹 ast: IParseResultItem[] 的基础内容。
    - BabelDist/TextDist/JsonDist + Dist 联合类型：描述生成文件的最终形式（Babel AST / 文本 / JSON），统一收集在 Map<string, Dist> 中。
    - IGentsRes：Dist 映射，key 通常是输出路径或资源 key。
    - IParseEntryCtx：解析入口上下文，包含 ast 列表、files（IGentsRes）、instance（上层生成器实例）、entries（入口 IDL 列表）。
    - IGenTemplateCtx：模板生成上下文，绑定单个 ast/service/method 对，以及 IMeta、模板名称。
    - ProcessIdlCtx：处理单个 IDL 的上下文，包含 ast、输出 files、dts/mock AST、mockStatements、meta 列表等。
  - 在新功能开发时，如需扩展上下文数据，应在这些接口上增字段，而非在运行时随意附着 any 属性。

- src/helper.ts
  - 对 Babel AST、Prettier、IDL AST 进行综合处理的核心工具模块，调用频次高：
    - AST 构造与解析：
      - plugins：parser 预设，固定包括 'typescript'、'decorators-legacy'、'classProperties'、'doExpressions'，与生成 TS 代码能力强耦合。
      - createFile(source: string)：将 code 文本转换为 Program，再手动包裹成 t.File 对象（适合 mock、dts、辅助 AST 构造）。
      - createIdWithTypeAnnotation(exp: string)：通过 template.ast 解析 `let ${exp}`，提取 VariableDeclarator.id 作为 Identifier，常用于带类型注解的变量/字段构造。
      - parseFile(fileName: string)：从磁盘读取并调用 @babel/parser.parse 生成 AST。
      - genAst<T>(code: string)：使用 template.ast 将代码片段转成 AST 节点；preserveComments = true, startLine = 2，用于模板化生成时保持注释。
    - 代码格式化与写入：
      - formatCode(code: string, root = '.')：
        - 在 root 下构造一个 for-prettier-bug 的伪文件路径，调用 prettier.resolveConfig 读取配置（支持 editorconfig）。
        - 如果找不到配置，则 fallback 到默认配置：tabWidth=2、printWidth=120、singleQuote=true。
        - 始终使用 parser='typescript' 格式化。
      - safeWriteFile(fileName: string, content: string)：
        - 使用 fs.ensureDirSync(path.dirname(fileName)) 保证目录存在，再写入 UTF-8 文本。
        - 调用方在生成文件前应先调用 formatCode，再交给 safeWriteFile。
    - 注释与 Lint 控制：
      - disableLint(node, isTs = true)：在节点前添加单行注释 `tslint:disable` 或 `eslint-disable`，用于短期绕过 Lint 限制（尽量在必要场景使用）。
      - addComment(node, comments, position?)：接受一组 h.Comment（来自 idl-parser 的 Comment 定义），将其转换为 JSDoc 风格的块注释或行注释，自动选择 leading/trailing。
      - convertVComments(comments)：具体将 Comment[] 的 value（string | string[]）拼接成注释文本，且会把 `*/` 替换为 `/` 以避免破坏块注释闭合。
    - 路径与命名处理：
      - getRelativePath(from, to)：计算 from 所在目录到 to 的相对路径，并移除扩展名，确保以 ./ 或 / 开头。
      - removeFileExt(fileName)：去掉最后一个扩展名（例如 .ts / .d.ts / .proto），保证返回路径前缀规范化（加上 ./）。
      - getNamespaceByPath(idlPath)：取文件名（去掉 .thrift/.proto 后缀）作为命名空间。
      - uniformNs(ns)：
        - 如果 ns 在 ReservedKeyWord 中（src/constant.ts），则在前面加下划线，避免与 JS/TS 保留字冲突。
        - 否则将 `.` 替换为 `_`，统一命名空间分隔符。
      - parseIdFiledType(fieldType: h.Identifier)：将 `a.b.c` 拆成 `{ refName: 'c', namespace: 'a.b' }`。
      - parseId(id: string)：将 `a.b.c` 解析成 `a_b.c` 形式（中间层用 `_` 连接，末尾字段保持点分）。
      - transformFieldId(fieldName: string)：字段名中含 `-` 时生成 stringLiteral，否则生成 identifier，避免非法标识符。
      - getSchemaRootByPath(absFile, idlRoot)：计算从 idlRoot 到 absFile（去扩展名）的相对路径，替换 `/` 为 `_`，再拼为 `api://schemas/${pathName}`，用于 schema id 统一命名。
      - getOutputName({ source, idlRoot, outputDir })：根据 IDL 在 idlRoot 中的相对路径，计算输出文件路径（保持同样目录结构）。
    - IDL 字段/枚举语义处理：
      - getValuesFromEnum(enumDef)：
        - 遍历 EnumDefinition.members，根据 initializer（整数或十六进制）按 Thrift 规则计算成员值，并返回值数组。
      - parseFiledName(field: h.FieldDefinition)：优先使用 extensionConfig.key（除非 key === '.'），否则使用原始字段名 name.value，实现字段别名/映射。
      - getFieldsAlias(field)：当前只代理 parseFiledName，语义上代表对前端使用字段名的统一抽象层。
      - ignoreField(f: h.FieldDefinition)：
        - 对特定基础字段（KContext/Base/BaseResp 或其命名空间形式 base.Base/base.BaseResp）做“忽略/保留”判断：
          - 返回 false 表示不要忽略（字段保留），主要用于上下游生成逻辑中控制是否跳过基础字段。
      - isFullBody(f: h.FieldDefinition)：
        - 满足 extensionConfig.position === 'body' 且 key === '.'，或 annotations 中存在 'api.full_body' 时，认为这是 HTTP full body 字段。
    - 注解与动态 JSON：
      - getAnnotation(annotations, name)：从 annotations.annotations 中按 name.value 精确匹配，返回 value.value。
      - hasDynamicJsonAnnotation(annotations?)：检查是否存在下列任一注解：
        - 'kgw.json' / 'kgw.json.req' / 'kgw.json.resp' / 'api.request.converter' / 'api.response.converter'。
      - getTypeFromDynamicJsonAnnotation(annotations?)：
        - 基于 api.request.converter / api.response.converter 的值（'encode' / 'decode' / undefined），通过一个预先定义的二维表推导前端/网关之间真实 payload 类型（'string' / 'Object' / 'unknown'）。
  - 在新增功能时，优先复用这些工具而不是重复造轮子；尽量遵守现有命名和判断逻辑以保持兼容性。

- src/utils.ts
  - isPbFile(p: string)：判断是否为 .proto 文件。
  - lookupFile(include: string, search: string[])：在多个 search 路径中查找 include 对应的真实路径，存在即覆盖结果。
  - 主要被 parser.ts 用于 Proto include 解析。

- src/constant.ts
  - ReservedKeyWord：一组标识符保留字，包括 'class'、'const'、'var'、'arguments'、'import' 等，用于 uniformNs 避免命名冲突。

## 开发与运行工作流

- 本子包不带独立构建过程，由 Rush / monorepo 顶层统一管理：
  - 安装依赖：在 monorepo 根目录执行：
    - rush update
  - 构建：通常通过仓库统一脚本（例如 rush build 或项目特定命令），本包自身的 build 命令为占位（exit 0）。
- 在本包内常用命令（请在 frontend/infra/idl/idl2ts-helper 目录执行）：
  - Lint：
    - npm run lint
    - 依赖 monorepo 内 @coze-arch/eslint-config（在 eslint.config.js 中引入），不要单独修改规则；若需要例外，优先使用 disableLint 或局部注释处理。
  - Test：
    - npm test 或 npm run test
    - 使用 Vitest + @coze-arch/vitest-config，CURRENT preset= node；无测试文件时仍视作成功（--passWithNoTests）。
  - Test with coverage：
    - npm run test:cov

## 项目约定与风格

- 语言与运行时：
  - TypeScript 为主，Node.js 环境（preset=node）。
  - 所有源码都带 Apache-2.0 版权头，在新文件中保持一致格式。
- 模块导出：
  - 顶层入口统一从 src/index.ts 导出；新增公共 API 时必须同时更新 index.ts。
  - 对 AST 类型和语义相关的工具，优先放在 src/types.ts / src/helper.ts 中，以免分散在多个文件难以维护。
- 命名与命名空间：
  - IDL 命名空间经 getNamespaceByPath 和 uniformNs 处理后，用 "_" 连接层级，避免与保留字冲突；在解析 ID 时，只有末级字段保持点连接（parseId）。
  - 字段别名与 HTTP 映射通过 extensionConfig / 注解驱动，解析逻辑统一走 parseFiledName / getFieldsAlias / isFullBody / getAnnotation。
- 代码生成：
  - 统一使用 Babel AST（@babel/types/@babel/template/@babel/parser）进行构造，不鼓励直接字符串拼接 TypeScript 源码。
  - 生成后必须调用 formatCode，再使用 safeWriteFile 输出，以保证风格一致并尊重 monorepo 的 Prettier/EditorConfig 配置。
  - 对需要导出的声明，推荐通过 withExportDeclaration 包装，保持导出形式一致并支持统一注释处理。
- 错误处理：
  - 对 AST 查找失败会主动抛出 Error，例如：
    - getStatementById 中找不到目标 struct 时抛出 `can not find Struct: ...`。
    - getParseResultFromNamespace 找不到 namespace 对应 AST 时抛出 `can not find ast by namespace : ...`。
  - 新增逻辑时应保持相同风格：在语义上不可能缺失的结构上抛出明确错误，而不是返回 undefined。

## 重要依赖与集成细节

- @coze-arch/idl-parser
  - 提供 IDL 统一 AST 模型和 parse 函数：
    - parse(filePath, { cache, ignoreGoTagDash, root, namespaceRefer, searchPaths })。
  - 所有 IDL 节点类型（SyntaxType、StructDefinition、Annotations 等）都从它 re-export 出来。
  - 当你在其他项目中使用本 helper 包时，不需要再单独引入 idl-parser 类型，直接从 @coze-arch/idl2ts-helper 引用即可。

- Babel 系列
  - @babel/parser：解析 TS/JS 代码，配合 plugins 数组合成 AST。
  - @babel/template：从模板字符串快速构造 AST 片段（createFile、createIdWithTypeAnnotation、genAst 依赖）。
  - @babel/types：所有 AST 节点的类型和构造函数（t.exportNamedDeclaration、t.addComment 等）。
  - 若新增 AST 生成逻辑，应尽量使用 template 和 types，而不是手写对象字面量。

- Prettier
  - 通过 prettier.resolveConfig 读取 repo 中配置（含 editorconfig），并以 TypeScript parser 格式化生成代码。
  - 如果没有解析到配置，则使用 helper 中定义的默认配置；不要在其他模块随意调用 prettier.format，以便集中管理格式策略。

- fs-extra
  - 用于确保目录存在（ensureDirSync）并执行写入操作，避免因父目录不存在导致生成失败。
  - 所有对磁盘写入的行为都应该集中通过 safeWriteFile 执行。

## 分支策略与仓库规范（本包层面）

- 本包作为 Rush monorepo 的一个 package，遵循仓库统一的分支与发布流程（详见仓库根目录 CONTRIBUTING.md、README.md 等）。
- 在本子包内：
  - 不单独维护版本脚本，版本号由 monorepo 统一管理（package.json 中 version 仅作记录）。
  - 所有变更应保证：
    - 不破坏现有公开 API（src/index.ts 的导出）；如果必须破坏，需要在上层包同步修改。
    - 遵守 ESLint 规则，必要时使用 disableLint 精准关闭，而不是整体关闭文件规则。

## 不寻常/易踩坑点

- tsconfig.json 的 exclude 为 ["**/*"]，这在单包视角看似不编译任何文件，但真实构建由上层 tsconfig.build.json+Rush 驱动，AI 助手在重构时不要随意修改。
- build 命令为 "exit 0"，这并不代表无需构建，而是构建完全依赖 monorepo；不要尝试在本包中引入独立打包工具。
- parseDSL 中对 google/protobuf 和 google/api 的 include 直接跳过，是为了兼容公共 proto 库；新增逻辑时不要误把这些文件纳入业务 AST 处理。
- uniformNs 遇到保留字会在前面加下划线，例如 namespace 为 "object" 时最终会是 "_object"；如果你在上层工具中根据 namespace 做映射，需要注意这一点。
- getTypeFromDynamicJsonAnnotation 中类型推导依赖 api.request.converter / api.response.converter 的取值组合，逻辑相对隐晦；变更前务必阅读函数注释和现有实现。

## 面向 AI 助手的开发建议

- 在本子包内新增能力时，优先思考它是否是「通用 helper」，如果是则放在此包；否则更适合放在具体 generator/plugin 中。
- 对 AST 的任何读写，尽量通过 src/types.ts 与 src/helper.ts 提供的工具完成，保持类型守卫与命名规则的一致性。
- 在修改 parseDSL 或 IMeta/IHttpRpcMapping 等关键结构前，先全局搜索调用点（尤其是其他 idl2ts-* 子包），确保不会破坏调用方假设。
- 所有对外可复用的工具函数、类型定义，都需要：
  - 在自身文件中定义。
  - 在 src/index.ts 中导出。
  - 必要时在 README.md 中补充简短说明。