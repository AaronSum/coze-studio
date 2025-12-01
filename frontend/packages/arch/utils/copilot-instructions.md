# @coze-arch/utils 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/utils）中安全、高效地协作开发。

## 1. 全局架构与角色定位

- 本包是 Coze Studio 前端 monorepo 中的通用工具库，位置：frontend/packages/arch/utils。
- 当前仅导出一个工具函数 parseHashOrQuery，集中在 src/url 目录，由 src/index.ts 统一出口。
- 该包被其他业务包作为 workspace 依赖引用（例如 frontend/packages/data/knowledge/knowledge-resource-processor-base/package.json 中的 "@coze-arch/utils": "workspace:*"）。
- 架构意图：将通用、小而独立的工具函数集中在一个轻量包中，以便统一维护类型、lint、测试配置，减少各业务包的重复实现。
- 所有源码均为 TypeScript，构建、测试、lint 配置通过 monorepo 共享配置包（@coze-arch/ts-config、@coze-arch/eslint-config、@coze-arch/vitest-config）统一管理，保证风格与行为一致。

目录结构（核心部分）：

- frontend/packages/arch/utils/
  - src/
    - index.ts：包的公共导出入口，集中 re-export 工具函数。
    - url/
      - parse-hash-or-query.ts：当前唯一工具函数实现。
  - __tests__/
    - index.test.ts：单元测试入口（vitest）。
    - setup.ts：测试全局初始化文件，在 vitest.config.ts 中通过 setupFiles 注入。
  - config/：内部工具包通用配置（由 monorepo 约定，不建议在此包内随意修改）。
  - eslint.config.js：使用 @coze-arch/eslint-config 生成 ESLint 配置。
  - tsconfig.json：组合型 tsconfig，引用 build 与 misc 配置。
  - tsconfig.build.json：build 相关 TS 配置，扩展自 @coze-arch/ts-config/tsconfig.web.json。
  - tsconfig.misc.json：测试与杂项 TS 配置（含 vitest/globals 类型）。
  - vitest.config.ts：使用 @coze-arch/vitest-config 生成 vitest 配置。

结构设计要点：

- 源码与测试分离：src 存放可发布代码，__tests__ 存放 vitest 测试与测试专用配置文件。
- 通过 tsconfig.build.json 专门控制发版构建（仅包含 src），tsconfig.misc.json 控制测试与工具脚本编译；顶层 tsconfig.json 使用 references 将两者组合，支持增量编译。
- 通过统一的 lint/test 配置包，保证所有 arch 层工具包保持一致的工程规范。

## 2. 构建、测试与调试工作流

### npm scripts（package.json）

- build："build": "exit 0"
  - 当前构建脚本是占位实现，不执行实际打包逻辑。真实构建通常由 Rush 或上层工具统一处理（例如在根目录使用 rush build / rush rebuild 时调用对应的构建流程）。
  - AI 助手**不要**在此包内私自增加复杂的独立打包流程，如需修改，应遵循 monorepo 顶层约定，并与其他包保持一致。
- lint："lint": "eslint ./ --cache"
  - 调用 eslint.config.js 中的配置，preset 为 'web'，使用 @coze-arch/eslint-config 提供的规则。
  - 修改或新增代码后，建议在该包目录执行 pnpm lint 或 rushx lint（视 monorepo 统一规范而定）。
- test："test": "vitest --run --passWithNoTests"
  - 使用 vitest 运行单元测试，--passWithNoTests 保证在当前仅有少量测试文件时不会因为无测试失败。
- test:cov："test:cov": "npm run test -- --coverage"
  - 在 test 基础上追加覆盖率统计，配置来自 vitest.config.ts 中的 coverage 字段。

### TypeScript 编译配置

- tsconfig.build.json
  - extends：@coze-arch/ts-config/tsconfig.web.json，表明此包定位为 web 环境工具库。
  - compilerOptions：
    - rootDir: ./src
    - outDir: ./dist
    - strictNullChecks: true, noImplicitAny: true
    - tsBuildInfoFile: ./dist/tsconfig.build.tsbuildinfo
  - include：src
  - exclude：src 下的 __tests__ / __mocks__ 以及 node_modules。
  - references：指向 monorepo 内 eslint-config、ts-config、vitest-config 的 tsconfig.build.json，以便 TS 项目引用与增量构建。
- tsconfig.misc.json
  - include：__tests__、vitest.config.ts 以及 **/__tests__/*。
  - compilerOptions：rootDir: ./, outDir: ./dist, types: ["vitest/globals"], 也开启 strictNullChecks 与 noImplicitAny。
  - 用于本包本身的测试和配置文件类型检查，不参与发版输出。
- tsconfig.json
  - 标记 composite: true，以支持 TS 项目引用。
  - references：同时引用 tsconfig.build.json 与 tsconfig.misc.json。
  - exclude: ["**/*"]，表示顶层 tsconfig 只作为项目汇总入口，具体编译行为由子 tsconfig 控制。

### Vitest 配置

- 文件：frontend/packages/arch/utils/vitest.config.ts
- 使用 defineConfig 从 @coze-arch/vitest-config 生成配置：
  - dirname: __dirname
  - preset: 'web'（与 tsconfig.web.json、eslint preset 保持一致）
  - test.setupFiles: ['./__tests__/setup.ts']，用于放置测试环境初始化逻辑（如 polyfill、全局 mock 等）。
  - coverage:
    - all: true
    - exclude: ['src/index.ts'] —— 入口文件不关注覆盖率，只关注具体实现文件，如 src/url/parse-hash-or-query.ts。
  - plugins：目前只包含名为 'edenx-virtual-modules' 的预处理插件；AI 助手不需要深入实现细节，只需保持配置一致，如新加测试不应破坏该插件行为。

## 3. 项目特有约定与模式

### 3.1 代码组织与导出模式

- 入口统一导出：
  - src/index.ts 仅负责 export { parseHashOrQuery } from './url/parse-hash-or-query';
  - 新增任何工具函数时，优先按功能归类到对应子目录（例如 url、string、object 等），并在 src/index.ts 中集中导出，避免直接从子路径导出给调用方。
- 目录命名：
  - 功能域名词小写、用中划线连接（如 parse-hash-or-query.ts）。
  - 新增文件时应复用现有风格，避免混用 camelCase/大写等命名方式。

### 3.2 TypeScript 与类型约束

- 强类型约束：全局启用 strictNullChecks 与 noImplicitAny，新函数必须显式声明参数与返回值类型。
- 对外 API 类型尽量简单直观，避免暴露复杂内部类型；如需暴露类型，请统一从 src/index.ts 导出。

### 3.3 Lint 与风格规范

- eslint.config.js 使用 @coze-arch/eslint-config 的 defineConfig：
  - preset: 'web'，packageRoot: __dirname。
  - rules 字段目前为空对象，表示使用统一 preset 默认规则，没有本地特例。
- AI 助手在修改代码时应保持：
  - 使用现有的 import/export 风格（ESM）。
  - 保持文件顶部的 Apache-2.0 版权头（新增文件时需复制现有头部注释格式）。

### 3.4 测试约定

- 测试框架：vitest，使用 globals（通过 tsconfig.misc.json 中 types: ["vitest/globals"] 引入）。
- 测试文件位置：
  - 通用约定是放在 __tests__ 目录下（当前有 __tests__/index.test.ts）。
  - 如为某个具体实现单独编写测试，也可以在 src/**/__tests__ 下创建子目录；注意 tsconfig.build.json 已显式排除这些路径，防止被打包。
- 覆盖率要求：
  - vitest.config.ts 中 coverage.all = true 且仅排除 src/index.ts，因此新增工具函数时，建议为其增加对应测试文件，以维持较高覆盖率。

## 4. 关键工具函数与集成细节

### parseHashOrQuery（src/url/parse-hash-or-query.ts）

- 签名：export const parseHashOrQuery = (queryString: string) => Record<string, string>。
- 行为：
  - 若 queryString 以 '?' 或 '#' 开头，会先去掉首字符。
  - 使用原生 URLSearchParams 对 queryString 进行解析，将每个键值对写入 result 对象。
  - 若同一个 key 出现多次，以最后一次出现的值为准（for-of 覆盖赋值）。
- 标注：该方法有 JSDoc 标记 @deprecated，建议在新代码中使用第三方 query-string 或原生 URLSearchParams 代替。
- 对 AI 助手的含义：
  - 在维护历史代码时，可以安全使用该函数以保持行为一致，但为新功能设计时，应优先考虑迁移到更推荐的方式。
  - 不要随意改变该函数的行为（尤其是对重复 key 的处理），否则可能影响依赖此包的上层模块。

### 外部依赖与共享配置

- @coze-arch/eslint-config：提供统一的 ESLint 规则与 defineConfig。
- @coze-arch/ts-config：提供 web 场景下的 TypeScript 基础配置（tsconfig.web.json）。
- @coze-arch/vitest-config：封装 vitest 的通用配置与 defineConfig，保证各包测试环境一致。
- 这些依赖均通过 workspace:* 方式管理，由 monorepo 顶层统一版本控制；AI 助手不应在此包内固定具体版本号。

## 5. 项目流程与协作规范

- 分支与提交规范：
  - 具体命名规范与流程在 monorepo 根目录文档（例如 README.md、CONTRIBUTING.md）中定义，本子包遵循统一规范，不在此重复。
  - 在此包内的改动通常作为整个仓库 PR 的一部分提交；AI 助手生成变更时，应保持改动最小化、聚焦当前包职责。
- 依赖管理：
  - 使用 Rush + workspace:* 管理依赖。新增依赖时，应优先考虑是否应该加在本包还是上层应用；本包定位为「架构层通用 utils」，不宜引入重量级业务依赖。
- 发布与集成：
  - 该包通常不会单独发布，而是作为 monorepo 内部包被其他前端应用/子包引用；构建与发版流程由仓库顶层工具统一控制。

## 6. 典型协作场景建议

以下建议仅基于当前仓库实际情况，总结给 AI 编程助手：

- 新增工具函数：
  - 在 src 下按功能域创建子目录或复用现有目录（如 url/），新增实现文件并在 src/index.ts 中导出。
  - 为新增函数编写对应 vitest 测试（首选放在 __tests__ 或 src/**/__tests__ 下），确保覆盖主要分支逻辑。
- 修改 parseHashOrQuery：
  - 在修改前先搜索整个仓库对 @coze-arch/utils 的使用情况，评估潜在影响。
  - 尽量保持向后兼容，不要改变对重复 key 的处理方式；如确需变更，应同步更新调用方测试。
- 调整配置：
  - 如需修改 TypeScript、eslint 或 vitest 配置，应优先查阅 frontend/config 下对应共享配置包的约定，保持与其他 arch 包一致，不要在此包内引入特例，除非有非常明确的理由。
