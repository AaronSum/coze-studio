# Copilot Instructions for @coze-studio/slardar-adapter

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/slardar-adapter）中安全、高效地协作开发。

## 总览与架构

- 本子包是 Coze Studio 前端 monorepo 中的一个「架构层适配器」包，主要职责是对上层业务提供统一的上报/监控适配层，对下依赖默认的 Slardar 客户端实现。
- 当前实现极简，核心入口为 [src/index.ts](src/index.ts)，对外暴露三个 API：`jsErrorPlugin`、`customPlugin`、`createMinimalBrowserClient`。
- 监控/埋点能力本身由依赖包 `@coze-studio/default-slardar` 提供，本包不直接与外部监控服务通信，而是作为对该依赖的「瘦封装（adapter）」。
- 架构设计目标：
  - 用一个轻量包隔离具体监控 SDK，实现后续替换/扩展时只改适配层；
  - 提供统一的插件式接口（`jsErrorPlugin`、`customPlugin`），方便在不同上层应用中按需注入能力；
  - 暴露 `createMinimalBrowserClient` 帮助调用方拿到最小可用监控客户端。
- 该包遵循 monorepo 内统一的 TypeScript/Vitest/ESLint 规范，构建由上层 Rush 管理，本包自身 `build` 脚本目前为空实现（`exit 0`），说明打包/构建通常由更上层流程接管。

## 代码结构

- 根目录
  - [package.json](package.json)：定义包名 `@coze-studio/slardar-adapter`、入口 `main: src/index.ts`、依赖 `@coze-studio/default-slardar`，并配置脚本 `lint`、`test`、`test:cov`。
  - [README.md](README.md)：对外简单介绍及 API 摘要。
  - [vitest.config.ts](vitest.config.ts)：通过 `@coze-arch/vitest-config` 生成 Vitest 配置，`preset: 'node'`，默认在 Node 环境运行单测。
  - [tsconfig.json](tsconfig.json)、[tsconfig.build.json](tsconfig.build.json)、[tsconfig.misc.json](tsconfig.misc.json)：统一使用 `@coze-arch/ts-config` 预设（通过 `extends`），保证在整个 monorepo 中保持一致的编译/检查行为。
  - [eslint.config.js](eslint.config.js)：使用 `@coze-arch/eslint-config`，为子包提供统一 ESLint 规则。
  - [__tests__](__tests__)：目前仅有 .gitkeep，没有实际测试文件，说明测试框架已就绪但尚未为本包编写用例。
- 源码目录
  - [src/index.ts](src/index.ts)：本包唯一的实现文件：
    - `import slardarInstance from '@coze-studio/default-slardar';`
    - `export const jsErrorPlugin = () => ({});`
    - `export const customPlugin = () => ({});`
    - `export const createMinimalBrowserClient: () => any = () => slardarInstance;`
  - 目前 `jsErrorPlugin` 和 `customPlugin` 的实现均为空对象返回，占位意义更大，为后续扩展留接口。

## 开发与工作流

- 安装依赖：
  - 在 monorepo 根目录执行 Rush 工作流，例如：
    - `rush update`：安装/更新所有子包依赖；
    - 如只需本子包，可通过 Rush 的增量/选择机制（具体参考仓库根目录 README 与 Rush 配置）。
- 本包常用 npm 脚本（在本包目录下执行）：
  - `npm run lint`：使用 monorepo 统一 ESLint 配置进行代码检查，含缓存（`--cache`）。
  - `npm run test`：运行 Vitest 单测，`--run --passWithNoTests` 表明即使没有测试文件也会视为通过；
  - `npm run test:cov`：在 `test` 基础上追加 `--coverage` 开启覆盖率统计。
  - `npm run build`：当前实现为 `exit 0`，仅用于兼容 monorepo 或 CI 流程，本包不会在本命令中产出构建产物。
- CI / 质量约束：
  - 由于 `build` 无实际逻辑，本包的主要质量门槛来自于 lint 和 test；
  - Vitest 环境由 `@coze-arch/vitest-config` 统一管理，避免各包自行配置导致差异。

## 项目约定与编码风格

- TypeScript / ESLint：
  - 遵循 `@coze-arch/ts-config` 和 `@coze-arch/eslint-config`；
  - 源码文件统一放在 [src](src) 目录，测试文件应放在 [__tests__](__tests__)，命名遵循 Vitest/常见约定（如 `*.test.ts`）。
  - 当前文件中通过 `/* eslint-disable @typescript-eslint/no-explicit-any */` 显式允许在导出类型中使用 `any`，给 `createMinimalBrowserClient` 类型留出弹性（因为 Slardar 实例类型来自外部包）。
- 适配器模式：
  - 不在本包直接 hard-code 任何监控平台实现，只依赖 `@coze-studio/default-slardar` 暴露的默认实例；
  - 对外通过函数导出（而非直接导出实例/对象）来方便后续扩展参数能力，例如在 `jsErrorPlugin` 中接入额外选项时仍保持 API 兼容。
- 插件约定（jsErrorPlugin/customPlugin）：
  - 两个插件均以「工厂函数」形式导出（`const xxx = () => ({})`），是统一的插件创建模式；
  - 目前实现为空对象，新增逻辑时应：
    - 保持返回值为可序列化的配置对象或具有标准接口的插件对象；
    - 遵守上层架构对「插件」的约定（可参考同架构层其他包，如 arch 目录下的其他 adapter 实现）。

## 与外部依赖的集成

- `@coze-studio/default-slardar`：
  - 本包唯一 runtime 依赖，由该包提供真实的 Slardar 客户端实例；
  - [src/index.ts](src/index.ts) 通过 `import slardarInstance from '@coze-studio/default-slardar';` 获取默认实例；
  - `createMinimalBrowserClient` 直接返回该实例，不做额外包装：
    - 调用方可以直接对实例调用监控 SDK 的 API；
    - 该函数名中强调「Minimal」，意味着它不负责注入插件或全局配置，更多组合逻辑应由上层调用方或其他 arch 包实现。
- 内部工具依赖：
  - `@coze-arch/vitest-config`：统一 Vitest 配置，保证各包测试环境一致，避免重复配置；
  - `@coze-arch/eslint-config`：统一 ESLint 规则，使得风格和规则在整个 monorepo 中一致；
  - `@coze-arch/ts-config`：通过 `tsconfig.*.json` 扩展该配置，保持 TypeScript 版本与编译策略的一致性。

## 测试策略

- 当前 [__tests__](__tests__) 目录中无实际用例，但测试基础设施已经配置完整（Vitest + coverage + Node preset）。
- 为新功能编写测试时：
  - 优先采用 Vitest 标准语法（`describe/it/expect`）；
  - 使用 Node 运行环境（由 `preset: 'node'` 决定），如需浏览器特性请在测试中自行 mock 或扩展配置；
  - 覆盖重点应放在：
    - `createMinimalBrowserClient` 是否正确返回 `@coze-studio/default-slardar` 的实例（可通过简单的 reference 相等性或关键方法存在性进行断言）；
    - `jsErrorPlugin`、`customPlugin` 在后续扩展后，对外暴露的数据结构/接口是否稳定。

## 版本管理与发布

- 版本号、发布流程由 monorepo 统一管理：
  - 当前版本为 `0.0.1`，遵循语义化版本（SemVer）；
  - 依赖引入方式为 `workspace:*`，说明版本解析交给 Rush/PNPM 的 workspace 机制处理。
- 该子包典型使用场景：
  - 作为上层应用（如 workflow、app 或其他 arch 包）的监控适配层；
  - 在需要自定义监控插件时由上层传入/组合本包导出的 `jsErrorPlugin`、`customPlugin` 与默认客户端。

## 对 AI 助手的具体建议

- 修改或扩展 `jsErrorPlugin` / `customPlugin` 时：
  - 保持函数签名不变（至少保留当前零参数形式，或在新增参数时为现有调用方提供默认值/兼容逻辑）；
  - 将插件对象设计为纯数据或与上层约定兼容的接口，不要在构造时产生副作用（例如立即发送网络请求）。
- 若需要接入新的监控 SDK：
  - 优先在 `@coze-studio/default-slardar` 中完成 SDK 集成，再在本包通过适配层暴露；
  - 避免在本包中混入与监控无关的业务逻辑，以确保关注点单一。
- 在补充测试时：
  - 放在 [__tests__](__tests__) 目录，遵循现有 Vitest 配置，无需手动添加新的测试 runner；
  - 使用 `npm run test` 在本包内快速验证；在 monorepo 级别由 Rush/CI 统一执行完整测试矩阵。
