# @coze-arch/fs-enhance Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/infra/utils/fs-enhance）中安全、高效地协作开发。

## 全局架构与设计概览

- 本子包是一个 **Node.js/TypeScript 文件系统增强工具库**，仅包含一组纯函数，入口为 [src/index.ts](src/index.ts)。
- 功能集中在几个核心能力：
  - 文本文件行数统计：`readFileLineCount`
  - 文件/目录存在性检查：`isFileExists`、`isDirExists`
  - JSON5 / YAML 配置读取：`readJsonFile`、`readYamlFile`
  - JSON 写入：`writeJsonFile`
  - 递归目录创建：`ensureDir`
- 所有 IO 操作均基于 Node 内置的 `fs/promises` 实现，统一使用 async/await 的 Promise API；JSON/YAML 解析分别依赖 `json5` 与 `yaml`。
- 测试放在 [__tests__/file-enhance.test.ts](__tests__/file-enhance.test.ts)，通过 Vitest 在 Node 环境执行，并大量使用 `vi.mock` 对 `fs/promises`、`yaml`、`json5` 进行隔离。
- TypeScript 配置采用 monorepo 共享配置：
  - 构建配置 [tsconfig.build.json](tsconfig.build.json) 继承 `@coze-arch/ts-config/tsconfig.node.json`，仅编译 `src` 到 `dist`。
  - 杂项配置 [tsconfig.misc.json](tsconfig.misc.json) 用于测试和 vitest 配置文件。
- ESLint/Vitest 配置也统一由工作区共享包提供：
  - [eslint.config.js](eslint.config.js) 基于 `@coze-arch/eslint-config` 的 `node` preset。
  - [vitest.config.ts](vitest.config.ts) 使用 `@coze-arch/vitest-config` 的封装，在 `preset: 'node'` 模式下运行。

## 开发与工作流

- `package.json` 中与本子包直接相关的脚本：
  - `npm run build`：当前实现为 `exit 0`，真正的类型检查与构建通常由 monorepo 顶层（如 Rush `rush build --to @coze-arch/fs-enhance`）驱动，AI 一般无需单独修改此脚本，除非有明确需求。
  - `npm run lint`：`eslint ./ --cache`，基于共享 ESLint 配置对整个子包进行校验。
  - `npm run test`：`vitest --run --passWithNoTests`，在 Node preset 下运行单元测试。
  - `npm run test:cov`：在 `test` 的基础上开启覆盖率报告（V8 backend）。
- 在整个 monorepo 中使用时，推荐通过 Rush 调用：
  - 测试：`rush test --to @coze-arch/fs-enhance`
  - 覆盖率：`rush test:cov --to @coze-arch/fs-enhance`
  - Lint：`rush lint --to @coze-arch/fs-enhance`
  - Build/类型检查：`rush build --to @coze-arch/fs-enhance`
- 日常开发建议流程（AI 自动化时可参考）：
  - 修改/新增 `src` 中的工具函数；
  - 同步更新或新增对应的 Vitest 用例到 [__tests__/file-enhance.test.ts](__tests__/file-enhance.test.ts)；
  - 本地执行 `npm run test` 或通过 Rush 在 monorepo 级别运行；
  - 确保 ESLint 通过（`npm run lint`），避免违反 monorepo 的通用规则（例如 `@coze-arch/no-batch-import-or-export` 等）。

## 代码风格与约定

- **模块与导出**：
  - 当前仅有一个实现文件 [src/index.ts](src/index.ts)，以多命名导出形式暴露所有工具函数；新增功能时，保持与现有导出风格一致。
- **异步 API 约定**：
  - 所有对外暴露的 IO 操作函数均为 `async`，返回 `Promise<...>`，不要混用回调风格。
  - 文件/目录存在性检查统一采用 "不抛错，返回 boolean" 的约定：
    - `isFileExists` / `isDirExists` 在 `fs.stat` 抛错（如不存在）时返回 `false`，由调用方自行判断。
- **错误处理**：
  - `readJsonFile` / `readYamlFile` 默认沿用 `json5` / `yaml` 的异常行为：语法错误会直接抛出；本包不做“吞错变默认值”的封装，除非有显式需求。
  - `ensureDir` 使用 `isDirExists` 避免对已存在目录重复调用 `fs.mkdir`，保持幂等；扩展行为时应继续保证幂等性。
- **序列化格式**：
  - `writeJsonFile` 使用 `JSON.stringify(content, null, '  ')`，即 **两个空格缩进** 的 pretty JSON；
  - 若未来新增写入 YAML/JSON5 等能力，应在 README 与测试中明确序列化格式约定。
- **测试约定**：
  - 使用 Vitest 的全局 API（`describe`/`it`/`expect`/`vi`），类型通过 [tsconfig.misc.json](tsconfig.misc.json) 中的 `types: ["vitest/globals", "node"]` 注入。
  - 对外导出的每个函数都应至少有一组单测覆盖：
    - 正常路径：核心逻辑与返回值；
    - 异常/边界路径：`fs` 抛错、目录已存在/不存在等。
  - IO 相关的测试通过 `vi.mock('fs/promises')` 等方式 mock 外部依赖，避免真实读写磁盘。

## 关键依赖与集成细节

- Node.js 文件系统：
  - 通过 `import fs from 'fs/promises'` 引入；所有读写均指定编码 `'utf-8'`。
  - 扩展时优先遵循现有 pattern：先通过 `fs.readFile` 获取字符串，再交给解析库处理。
- JSON5 集成：
  - 来自 `json5` 包：`import { parse } from 'json5';`
  - `readJsonFile<T>` 仅做读取 + `parse`，不进行类型断言或校验，泛型参数仅用于调用方的静态类型推断。
- YAML 集成：
  - 来自 `yaml` 包：`import { parse as parseYaml } from 'yaml';`
  - `readYamlFile<T extends object>` 与 `readJsonFile` 类似，仅负责读 + parse；泛型同样只影响 TS 推断。
- Monorepo 配置包：
  - `@coze-arch/ts-config`：提供 Node 环境下的 TS 编译默认配置，统一目标版本、模块解析等；
  - `@coze-arch/eslint-config`：定义工作区统一 lint 规则，禁止批量导入/导出等模式；
  - `@coze-arch/vitest-config`：封装 Vitest 的预设（如 test 环境、默认覆盖率策略等），在 [vitest.config.ts](vitest.config.ts) 中通过 `defineConfig` 引入。

## 测试、调试与故障排查

- 单测入口为 [__tests__/file-enhance.test.ts](__tests__/file-enhance.test.ts)，覆盖了当前所有导出函数：
  - 使用 `vi.mock('fs/promises')`、`vi.mock('json5')`、`vi.mock('yaml')` 隔离外部依赖。
  - 通过 `vi.spyOn(fileEnhance, 'isDirExists')` 等方式验证内部函数协作关系（例如 `ensureDir` 对 `isDirExists` 的依赖）。
- 新增函数时，建议沿用现有用例结构：
  - `describe('file-enhance', () => { ... })` 内新增 `it(...)`，按“Arrange / Act / Assert” 三段式组织。
  - 若函数内部依赖 `fs`、`json5`、`yaml` 等外部模块，应通过 `Mock` 类型限定并进行调用参数断言。
- 常见问题排查：
  - 若测试无法识别 Vitest 全局：确认 [tsconfig.misc.json](tsconfig.misc.json) 中 `types` 是否包含 `vitest/globals`，以及编辑器是否使用该配置做类型推断。
  - 若 ESLint 报批量导入/导出错误，参考现有测试中对 `fileEnhance` 的导入方式，必要时为测试场景添加单行 `eslint-disable` 注释（该模式已存在且被允许）。

## 项目流程与协作规范

- 版本管理与发布策略不在本子包中直接体现，通常由 monorepo 顶层统一管理（如 Rush + Changesets）；AI 进行修改时，只需保证：
  - 不随意修改 `version` 字段和 workspace 协议依赖；
  - 保持 `main: "src/index.ts"` 或后续统一变更为构建产物时的配置一致性。
- 代码版权与 License：
  - 源码与配置文件顶部统一带有 Apache-2.0 License 版权头（参见 [src/index.ts](src/index.ts)、[vitest.config.ts](vitest.config.ts)）；
  - 新增文件应复制相同的版权头，保持一致。
- 由于该包被其他内部工具复用，**向后兼容** 十分重要：
  - 对现有导出函数的签名进行破坏性修改前，应优先考虑新增新函数名、保留旧 API，或在调用方全部迁移后再统一清理。

## 不寻常/需特别注意的点

- `package.json` 的 `build` 脚本目前是一个占位实现（`exit 0`），真实构建逻辑依赖 monorepo 顶层流程；AI 不要轻易改成 `tsc` 或其它命令，以免破坏现有 CI 流程。
- TS 项目采用 **references + 多 tsconfig** 的结构：
  - 根 [tsconfig.json](tsconfig.json) 将所有源码排除，仅通过 `references` 指向 `build` 与 `misc`，方便在 workspace 级别做增量编译；
  - AI 新增配置文件时，请避免破坏当前 references 拓扑，优先在现有 tsconfig 中调整。
- 由于依赖 `fs/promises`，本包默认运行环境为 Node；不考虑浏览器或 Deno 环境。若未来需要跨平台支持，应在 README 中显式注明，并在实现层面做环境分支，而不是在当前文件中直接引入浏览器专用 API。
