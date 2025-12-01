# @coze-arch/bot-env 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-env）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包是 bot-studio 前端 monorepo 中的「环境变量编译与运行时封装层」，路径为 frontend/packages/arch/bot-env。
- 运行时代码与编译期逻辑全部委托给外部包 `@coze-studio/bot-env-adapter`，本包主要负责：
  - 提供稳定的公共导出面（`GLOBAL_ENVS`、`runtimeEnv`、`build` 等）；
  - 隔离内部实现变更，保证其它子包只依赖 `@coze-arch/bot-env`；
  - 配合 monorepo 的 Rush/TS/Vitest 配置，统一构建、类型与测试行为。
- 结构概览：
  - src/
    - index.ts：导出编译期环境对象 `GLOBAL_ENVS`；
    - runtime/index.ts：导出运行时环境工具 `runtimeEnv`；
    - typings.d.ts：由适配层构建生成的类型声明引用入口。
  - scripts/
    - build.ts：再导出 `@coze-studio/bot-env-adapter/build`；
    - index.ts：通过 sucrase 运行的构建入口，调用 adapter 的 build 逻辑；
  - 配置文件：package.json、tsconfig*.json、vitest.config.mts、eslint.config.js 等与 monorepo 统一。
- 重要原则：**这里不实现具体 env 规则，只做稳定包装与工程集成**。如需修改 env 结构、生成逻辑，应优先改动 `@coze-studio/bot-env-adapter` 包。

## 关键开发工作流

- 本包通常通过 Rush 在 monorepo 顶层调起，命令只在包内定义最小脚本：
  - 构建：
    - 包内：`npm run build`
    - monorepo：`rush build -t @coze-arch/bot-env`
    - build 流程：
      - 使用 `node -r sucrase/register scripts/index.ts` 先执行脚本（调用 adapter 的 `build`，生成/更新 typings）；
      - 随后执行 `tsc -b tsconfig.build.json` 进行 TS 编译。
  - 测试：
    - 包内：`npm test` / `npm run test:cov`
    - monorepo：`rush test -t @coze-arch/bot-env`、`rush test:cov -t @coze-arch/bot-env`
    - 使用 workspace 级别的 `@coze-arch/vitest-config`，不要在本包内单独重写 Vitest 行为。
  - Lint：
    - 包内：`npm run lint`
    - monorepo：通常通过 `rush lint` 统一执行。
- 日常修改建议：
  - 如只调整导出面（新增导出、重命名 re-export），修改 src/ 与 scripts/ 即可，无需触 adapter 内部。
  - 如发现 typings 未更新或类型错误，优先执行 `npm run build` 重新生成，再检查 adapter 逻辑。

## 项目约定与编码模式

- 模块暴露约定：
  - 在 package.json 的 `exports` 与 `typesVersions` 中统一约定对外路径：
    - `".": "./src/index.ts"` → `import { GLOBAL_ENVS } from '@coze-arch/bot-env'`；
    - `"./runtime": "./src/runtime/index.ts"` → `import { runtimeEnv } from '@coze-arch/bot-env/runtime'`；
    - `"./build": "./scripts/build.ts"` → `import { build } from '@coze-arch/bot-env/build'`；
    - `"./typings": "./src/typings.d.ts"` → `/// <reference types="@coze-arch/bot-env/typings" />`。
  - 如需新增出入口（例如新的 runtime helper），需要同时维护：
    - src/ 或 scripts/ 下的实际文件；
    - package.json 的 `exports` 与 `typesVersions`；
    - README.md 中的示例。
- 代码风格：
  - 使用 workspace 统一的 ESLint/TSConfig：`@coze-arch/eslint-config`、`@coze-arch/ts-config`；
  - 严格 TypeScript 类型；不在本包中写 any-style 动态逻辑，本包主要做 re-export 与轻量 glue code；
  - 所有源文件头部使用 Apache-2.0 版权头（参考现有 src/ 与 scripts/ 文件）。
- Typings 约定：
  - src/typings.d.ts 作为引用入口，内部通过三斜线指向 `@coze-studio/bot-env-adapter/typings`；
  - 不直接在本包中维护大块环境变量声明，而是从 adapter 同步；
  - 如要增加新的全局 env 变量类型，应：
    - 在 adapter 中扩展 env 与 typings 生成逻辑；
    - 运行本包构建，使 src/typings.d.ts 引用的新声明生效；
    - 根据需要在 README.md 中补充示例。

## 与关键组件 / 外部依赖的集成

- `@coze-studio/bot-env-adapter`（核心依赖）：
  - 本包所有业务行为均委托给此依赖：
    - 编译期环境对象：`src/index.ts` → `export { GLOBAL_ENVS } from '@coze-studio/bot-env-adapter';`
    - 运行时环境工具：`src/runtime/index.ts` → `export { runtimeEnv } from '@coze-studio/bot-env-adapter/runtime';`
    - 构建脚本：
      - `scripts/build.ts` → `export { build } from '@coze-studio/bot-env-adapter/build';`
      - `scripts/index.ts` → `import { build } from '@coze-studio/bot-env-adapter/build'; build();`
    - 类型声明：`src/typings.d.ts` 三斜线引用 `@coze-studio/bot-env-adapter/typings`。
  - 集成原则：
    - 不在本包中复制 adapter 实现或类型；
    - adapter 升级时，如有破坏性导出变更，先在本包中做「向后兼容的 re-export」，再逐步迁移上下游使用方；
    - 若需要引入新 env 功能，先在 adapter 中实现并稳定，再通过本包暴露。
- Rush / monorepo：
  - 通过 `workspace:*` 形式依赖 adapter 与内部配置包，方便统一升级；
  - 构建与测试在 monorepo 统一调度下执行，本包不要引入与全局脚本冲突的额外 CLI 包。

## 测试策略与示例

- 测试框架：使用 Vitest，配置共享自 `@coze-arch/vitest-config`，本包自己的 vitest.config.mts 仅做轻量包级别定制（如根目录、include 模式等）。
- 测试位置：`__tests__/` 目录下，遵循 monorepo 中统一的命名/组织规则。
- 推荐测试内容：
  - re-export 是否指向预期模块（可以通过 `vi.mock`、类型断言等方式校验）；
  - 当 adapter 升级后，验证本包暴露的 API 形状是否保持不变（尤其是 `GLOBAL_ENVS`、`runtimeEnv` 类型与可用字段）。
- 不在本包中测试 adapter 的内部逻辑，该部分应在 adapter 自身包中覆盖。

## 项目流程、分支与发布

- 分支 / 提交流程遵循仓库根部 CONTRIBUTING 与 git-hooks 约定：
  - 保持提交信息与变更范围明确，尽量单 PR 聚焦少量子包；
  - 注意本包对其它前端应用/包的影响（环境变量通常是跨包依赖）。
- 发布与版本：
  - 版本号由 monorepo 的发布流程统一管理，本包 package.json 中版本通常由工具更新；
  - 新增/删除 env 导出时，需要在 PR 描述中明确标记，方便审阅者检查下游影响。
- 部署相关：
  - 本包自身不直接参与部署，仅通过 build 产物与 typings 被其他前端项目消费；
  - 部署环境（BOE / 生产 / 区域配置等）由 adapter 与上层应用配置组合实现，本包不直接写死任何环境常量。

## 其它特性与注意事项

- 「包装层」定位：
  - 本包是轻量 façade，目的是在不改动大量业务代码的前提下，自由演进 `@coze-studio/bot-env-adapter` 的实现；
  - 改动本包时，优先考虑 API 稳定性与向后兼容，而非在此添加逻辑。
- 运行时代码体积：
  - 由于本包主要 re-export，不在此引入额外重量级依赖，以免污染下游 bundle 体积；
  - 如必须增加运行时逻辑，先评估是否适合下沉到 adapter 或其它 util 包。
- 文档一致性：
  - README.md 中已经包含详细使用说明与命令示例；
  - 当你改动导出名称、使用方式或构建脚本，请同时更新 README.md 与本文档中相关描述。
