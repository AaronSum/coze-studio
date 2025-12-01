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

## 2. 目录结构与关键文件
- package.json
  - name: @coze-arch/idl2ts-cli；bin.idl2ts -> ./src/cli.js。
  - scripts：
    - build: 当前为 no-op（exit 0），真正产物通常由 Rush/上层工具构建；
    - lint: eslint ./ --cache；
    - test: vitest --run --passWithNoTests；
    - test:cov: 覆盖率模式。
- tsconfig.json / tsconfig.build.json / tsconfig.misc.json
  - 采用 TypeScript project references，与 monorepo 通用配置 @coze-arch/ts-config 集成；
  - 编译目标 CommonJS，outDir=dist，rootDir=src；
  - build tsconfig 还引用 generator/helper/plugin 等子包的 tsconfig 以支持增量编译。
- vitest.config.ts
  - 通过 @coze-arch/vitest-config 定义统一的 Node preset，dirname=当前目录。
- src/cli.ts
  - 程序主入口，定义 commander 程序：
    - idl2ts gen <projectRoot> [-f|--format-config <path>]：生成 API 客户端；
    - idl2ts filter <projectRoot> [-f|--format-config <path>]：生成过滤后的类型。
  - 通过 ora 展示进度 spinner；捕获异常后打印错误并 process.exit(1)。
  - 若需要增加子命令，应复用此模式（统一错误处理 + spinner）。
- src/actions.ts
  - 导出 gen、genTypes、defineConfig、defineApiTpeConfig：
    - gen(projectRoot, { formatConfig? }):
      1. 调用 lookupConfig(projectRoot) 读取配置（默认 api.config）；
      2. 为每个 ApiConfig 构建 aliasMap、realEntries、output 等；
      3. 组装插件：MockPlugin、AliasPlugin、FormatPlugin、LocalConfigPlugin 以及配置中的 plugins；
      4. 调用 genClient 完成生成。
    - genTypes(projectRoot, { formatConfig? }):
      1. 通过 lookupConfig<ApiTypeConfig>(projectRoot, 'api.filter.js') 读取过滤配置；
      2. 在插件链中额外加入 FilterTypesPlugin(filters, output)；其余流程与 gen 类似。
    - defineConfig / defineApiTpeConfig：简单返回传入数组，主要为项目侧配置文件提供类型提示和约束。
- src/utils.ts
  - lookupConfig(projectRoot, configName='api.config')：
    - 使用 path.resolve(process.cwd(), projectRoot, configName) 构建配置路径；
    - require.resolve + require 动态加载配置文件；
    - 找不到配置时抛出错误（错误消息仅包含当前 process.cwd()）。
- src/types.ts
  - 定义 ApiConfig / ApiTypeConfig 结构：
    - entries: Record<string, string>（服务别名 -> IDL 路径，相对 idlRoot）；
    - idlRoot: IDL 根目录；output: 代码输出目录；commonCodePath: 公共代码路径；
    - repository / idlFetchConfig：可选仓库与远程 IDL 拉取信息，当前仅作为结构传递给 generator；
    - plugins?: IPlugin[]；aggregationExport?: string；formatter: 自定义格式化函数；
    - ApiTypeConfig 额外增加 filters: Record<serviceName, string[]>。
- src/plugins/*
  - alias.ts（AliasPlugin）：
    - 在 HOOK.PARSE_ENTRY 上运行，遍历入口 IDL 的 serviceDefinition，把 serviceName 替换为 aliasMap 中映射的别名；
    - aliasMap 的 key 为绝对 idlPath，value 为 entries 中的键（服务别名）。
  - formatter.ts（FormatPlugin）：
    - 在 HOOK.WRITE_FILE 上运行，对写出的 TS 文件做格式化；
    - 优先使用传入 formatter(content, filename)；否则读取 prettier 配置文件，对 .ts 文件调用 prettier.format(parser='typescript')；
    - 内部 readConfig 支持 require 或 JSON 解析，失败时静默降级；
    - 通过 isPromise 规避 prettier 异步返回值。
  - mock-plugin.ts（MockPlugin）：
    - 在 HOOK.GEN_MOCK_FILED 的 before 钩子上注册，用于生成字段级 mock 值；
    - 基于 @coze-arch/idl2ts-helper 的 isBaseType/getBaseTypeConverts 判断基础类型；
    - 使用 faker + dayjs 结合字段名约定（*ID / *Email / *TIME / *TIMESTAMP / *STATUS / *TYPE 等）生成更语义化的随机值；
    - 通过 NumMapper/StrMapper 对少量字段做硬编码覆盖；
    - 直接操作 Babel AST（@babel/types）的字面量节点，写入 ctx.output。
  - local-config.ts（LocalConfigPlugin）：
    - 在 HOOK.GEN_FILE_AST 的 after 钩子上运行，为每次生成写入/覆盖 api.dev.local.js；
    - 若存在同名文件，则加载其 mock 数组并透传；否则生成空 mock 数组；
    - 通过 ctx.files.set(target, { type: 'text', content }) 将文件注入生成结果。
  - filter-types-plugin.ts（FilterTypesPlugin）：
    - 在 HOOK.PARSE_ENTRY 之后对子集 AST 进行裁剪，只保留 filters 中声明的 service/method 相关类型；
    - 递归跟踪 struct/enum/集合类型引用，并记录到 this.statements；
    - 对枚举字段：
      - 将字段类型硬替换为 I32Keyword；
      - 在字段 comments 中追加 @seexxxx 注释，指向原始枚举；
      - 收集所有枚举定义并按 namespace 分组；
    - 在 HOOK.PROCESS_IDL_AST 之后，生成 enums.ts，导出各 namespace 下的枚举“字典数组”（含 value/label）。

## 3. 外部依赖与交互方式
- @coze-arch/idl2ts-generator
  - 提供 genClient 与 HOOK 常量；
  - 本包通过传入 entries/idlRoot/outputDir/commonCodePath/plugins 等配置驱动生成流程；
  - 插件在 Program 上注册到指定钩子（before/on/after）。
- @coze-arch/idl2ts-helper
  - 在插件中大量使用：类型守卫（isBaseType/isEnumDefinition/...）、AST 查询（getStatementById/findDefinition/...）、工具函数（parseIdFiledType/getValuesFromEnum/...）；
  - 任何修改 AST 的逻辑应优先通过 helper 提供的 API 完成，避免手写结构。
- @coze-arch/idl2ts-plugin
  - 定义 IPlugin 接口、Program 类型，以及 before/on/after 三种 hook 注册方式；
  - 自定义插件必须实现 apply(program: Program) 并通过 program.register 绑定钩子。
- @faker-js/faker / dayjs / prettier / @babel/types
  - faker/dayjs 用于 mock 数据生成；
  - prettier 仅在 FormatPlugin 内使用，用于 TS 代码格式化；
  - @babel/types 仅在 AST 插件中构造或修改 TS/JS AST 节点。

## 4. 开发、构建与调试流程
- 安装依赖（在 monorepo 根目录运行）：
  - rush update
- 子包本地开发常用命令（在 frontend/infra/idl/idl2ts-cli 下）：
  - 测试：npm test 或 pnpm test（具体由 Rush 子命令代理），底层执行 vitest --run；
  - Lint：npm run lint（使用 monorepo 统一的 eslint.config.js 和 @coze-arch/eslint-config）；
  - 构建：npm run build 当前为 no-op，真实构建通常由 Rush 统一 orchestrate；如需本地验证，可直接用 tsx / ts-node 运行 src/cli.ts。
- 手动调用 CLI（开发态推荐）：
  - 使用 tsx：
    - npx tsx src/cli.ts gen <projectRoot> -f <prettierConfigPath>
    - npx tsx src/cli.ts filter <projectRoot> -f <prettierConfigPath>
  - 使用已构建的 bin（若在上层已有构建产物）：
    - npx idl2ts gen <projectRoot>
    - npx idl2ts filter <projectRoot>
- 调试插件：
  - 推荐针对单一 ApiConfig/ApiTypeConfig 和少量 IDL 文件构造最小复现仓；
  - 使用 vitest 编写单测时，可通过直接实例化插件+伪造 ctx 的方式测试钩子行为（参考其它子包中的插件单测模式）。

## 5. 项目约定与编码规范
- 语言与模块：
  - 源码统一使用 TypeScript（target ES2020，module CommonJS），产物通过 tsconfig.build.json 输出到 dist；
  - Node 端使用 require/require.resolve 加载本地 JS 配置文件（api.config.js / api.filter.js / api.dev.local.js）。
- 配置约定：
  - 默认配置文件名：
    - 生成客户端：api.config（通常为 api.config.js，导出 defineConfig([...])）；
    - 过滤类型：api.filter.js（导出 defineApiTpeConfig([...])）；
  - projectRoot 参数为“项目根目录相对路径”，以 process.cwd() 为基准拼接；
  - entries 中的路径均相对 idlRoot；output 为生成 TS 的目标目录（相对 projectRoot）。
- 插件编写约定：
  - 必须实现 apply(program: Program) 并通过 before/on/after 注册到特定 HOOK；
  - 所有 IO（读配置文件等）应在插件构造函数或 apply 早期完成；
  - 对 AST/ctx 的修改必须保持幂等（多次运行不应造成重复注入/重复收集）。
- 错误处理：
  - CLI 层（src/cli.ts）负责捕获同步异常并以非 0 退出；统一输出 spinner.fail 消息和 error 对象；
  - 底层插件通常在异常情况下“尽量降级”，例如 FormatPlugin 遇到 prettier 错误只发出 console.warn 而不终止生成。
- 代码风格：
  - 使用 monorepo 统一 ESLint 规则（包含安全相关规则，如 security/detect-non-literal-require 等，通过局部 disable 处理动态需求）；
  - 禁止批量 import/export（@coze-arch/no-batch-import-or-export）除非已有豁免；
  - 注释风格偏英文，遵循 Apache-2.0 头部版权声明模板。

## 6. 与上游/下游的协作关系
- 上游输入：
  - Thrift/Protobuf IDL 文件集（由其他工程维护）；
  - 项目侧配置（api.config.js / api.filter.js / api.dev.local.js），通常位于具体业务项目根目录下；
  - 可选的 repository/idlFetchConfig 描述，用于上游仓库同步（实际拉取逻辑在 generator/其他子包中实现）。
- 下游输出：
  - 生成的 TypeScript 客户端代码和类型文件，写入 config.output 指定目录；
  - enums.ts：由 FilterTypesPlugin 生成，提供枚举 value/label 对应关系，方便前端直接消费；
  - api.dev.local.js：由 LocalConfigPlugin 维护，记录 mock 开关列表。
- 其他子包依赖：
  - 业务前端包通常通过 @coze-studio/api-schema 或专门的 adapter 包间接依赖本 CLI 的产物；
  - 修改 CLI 行为（尤其是插件输出结构）可能影响多个下游项目，需特别谨慎并做跨包联动验证。

## 7. 开发注意事项与常见坑
- config 加载路径：
  - lookupConfig 使用 process.cwd() 作为基准，因此：
    - 在 monorepo 根目录运行 CLI 时，projectRoot 需是相对根的路径；
    - 若在子项目目录内运行，则 projectRoot 通常为 '.' 或相对该子项目的路径；
  - 找不到配置时错误信息只包含 cwd，不含配置文件名，调试时需额外关注实际拼接的路径。
- filters 的行为：
  - FilterTypesPlugin 在处理 enum 时会强制将字段类型改为 I32Keyword 并增加 @see 注释；
  - 生成 enums.ts 的结构是 namespace + 数组对象（{ value, label }），下游依赖此结构时不要随意变动字段名；
  - 未列入 filters 的 service/method 对应类型将被完全裁剪，新增 filters 时请确保名称与 IDL 中 service/method 精确匹配。
- mock 生成：
  - MockPlugin 只对基础类型字段生效（string/number 等）；
  - 默认值优先取 IDL 中的 defaultValue（如 IntConstant/StringLiteral）；
  - 字段名约定驱动了大量 mock 行为，改动字段名模式可能导致 mock 输出风格变化。

## 8. 对 AI 助手的具体建议
- 在本子包中改动时，应优先遵循以下顺序理解上下文：
  1. 查看 src/actions.ts 中 gen/genTypes 流程，理解 CLI 实际调用链；
  2. 查看 src/plugins 目录下已有插件的用法和 hook 选型，再设计新插件或调整现有逻辑；
  3. 若需新增配置字段，先在 src/types.ts 中扩展 ApiConfig/ApiTypeConfig，再在 actions.ts/相关插件中贯通；
  4. 对行为变更，请评估对下游生成代码的影响，并在可能的情况下补充/更新单测（使用 vitest）。
- 生成或修改代码时请：
  - 避免在本包中引入与生成代码强耦合的业务逻辑（业务定制应通过配置与插件实现）；
  - 保持与现有插件一致的 Hook/AST 操作风格，尽量利用 helper 的封装方法；
  - 任何涉及文件路径的逻辑，应显式说明是相对 projectRoot 还是 cwd，以避免运行环境差异导致的问题。
