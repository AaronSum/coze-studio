# @coze-studio/tea-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/tea-adapter）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 位置：frontend/packages/arch/tea-adapter
- 包名：@coze-studio/tea-adapter
- 职责：为前端提供一个「惰性/空实现」的 Tea SDK 默认入口，保证在未真正注入埋点 SDK 时，调用 Tea 相关接口不会抛错，从而解耦业务代码与实际埋点实现。
- 上游依赖：@coze-studio/tea-interface（定义 Tea 接口、事件常量、参数类型及 Collector 等核心类型）。

在整个 Coze Studio 前端架构中，该子包位于 arch 层，更多是「适配/防护层」，确保其它业务包可以安全依赖 Tea 能力，而无需关心 SDK 是否真正初始化或存在。

## 2. 代码结构与数据流

### 2.1 目录结构
- package.json：包元信息、脚本、依赖定义。
- src/index.ts：核心导出，提供 Tea 代理对象。
- README.md：对外使用说明（简单描述本包为 SDK 适配层）。
- eslint.config.js：ESLint 配置（使用 @coze-arch/eslint-config，preset 为 node）。
- tsconfig.json / tsconfig.build.json / tsconfig.misc.json：TypeScript 工程引用配置（通过 @coze-arch/ts-config 统一管理，具体选项在上游包）。
- vitest.config.ts：测试配置，使用 @coze-arch/vitest-config，preset 为 node。

### 2.2 核心实现概览（src/index.ts）
- 引入类型：
  - 从 @coze-studio/tea-interface/events 引入 EVENT_NAMES、ParamsTypeDefine，约束事件名和事件参数类型。
  - 从 @coze-studio/tea-interface 引入：
    - RawIInitParam：原始初始化参数类型。
    - IConfigParamCN / IConfigParamOversea：不同区域的配置类型。
    - Collector：埋点收集器类型/类。
- 本包定义 IInitParam = RawIInitParam & { autoStart?: boolean }，在原始初始化参数基础上增加 autoStart 可选字段，以更贴合前端调用习惯。
- 定义 Tea 接口：
  - Collector：暴露 Collector 类型以供外部使用。
  - 生命周期/控制方法：getInstance、init、config、reStart、start、stop、checkInstance。
  - 事件能力：event、sendEvent、resetStayParams、getConfig、sdkReady。
- 实际实现：
  - mockTea 为一个空函数（noop）。
  - 通过 Proxy 包装一个空函数，使用 proxyHandler 拦截：
    - get：无论访问什么属性，都尝试从 mockTea[prop] 取值，否则返回一个 noop 函数。
    - apply：将调用转发给 mockTea（当前即 noop）。
  - 最终导出：export default proxy as Tea。

整体数据流逻辑：
- 业务侧直接从 @coze-studio/tea-adapter 导入默认导出（Tea 实例），并调用其方法或属性。
- 在本包当前实现下，任何访问或调用都被 Proxy 拦截并最终落到 noop，不做任何实际埋点/配置操作，也不会抛出运行时错误。
- 真正的埋点 SDK 行为由 @coze-studio/tea-interface 及其实际实现承担，本包只是默认「兜底适配层」。

## 3. 开发与测试工作流

### 3.1 基本脚本（package.json）
- build："exit 0"
  - 当前为占位实现，不做实际构建（构建通常由 Rush + 通用构建脚本统一处理）。
  - AI 助手无需在本包中新增复杂构建逻辑，除非需要引入新的编译产物并与 monorepo 通用方案保持一致。
- lint："eslint ./ --cache"
  - 使用 @coze-arch/eslint-config 执行 ESLint 检查，preset 为 node。
  - 修改 TypeScript 源码后，如需本地验证代码风格，可运行 rushx lint 或在包内运行 pnpm lint / npm run lint（具体取决于 monorepo 统一命令）。
- test："vitest --run --passWithNoTests"
  - 使用 Vitest 运行测试，允许没有测试文件时通过。
- test:cov："npm run test -- --coverage"
  - 在运行测试基础上生成覆盖率报告。

### 3.2 vitest 配置（vitest.config.ts）
- 使用 @coze-arch/vitest-config 提供的 defineConfig：
  - dirname: __dirname
  - preset: 'node'
- 如需新增测试文件（例如 __tests__/index.test.ts），应遵循 monorepo 其他包相同的测试命名和目录约定，并复用该配置。

### 3.3 TypeScript 工程引用
- tsconfig.json：
  - exclude: ["**/*"]，本文件主要作为工程根配置，真正的编译选项放在 tsconfig.build.json、tsconfig.misc.json，由上游 @coze-arch/ts-config 统一管理。
- 在扩展本包时，尽量使用已有 tsconfig.* 引用，不要单独写一套完全不同的 TS 配置，以避免与 monorepo 统一规范冲突。

## 4. 项目特有约定与模式

### 4.1 Tea 代理模式
- 本包导出的是一个 Proxy 包装的函数，而非传统的类实例或普通对象：
  - 可以被当作函数调用（Tea(...)），也可以当作对象访问属性或方法（Tea.init()、Tea.event() 等）。
  - 对于任何未知属性或方法调用，都会优雅退化为 noop，避免运行时错误。
- 这一设计的目的：
  - 在应用启动早期、或某些运行环境下可能尚未挂载真实 Tea SDK 时，业务代码仍可安全调用 Tea，不需要显式做「存在性检查」。
  - 为后续「替换 mockTea 为真实实现」预留扩展点（例如在运行时注入真正的 Tea 实例，并更新 Proxy 目标或 handler）。

### 4.2 类型优先的接口定义
- Tea 接口严格引用 @coze-studio/tea-interface 中的类型：
  - EVENT_NAMES / ParamsTypeDefine：保障事件名与事件参数在整个前端工程中保持一致。
  - IInitParamCN / IConfigParamOversea：统一配置参数形态，避免各个业务包自行扩展造成混乱。
- 在扩展 Tea 接口时，应优先到 @coze-studio/tea-interface 中新增/调整类型，再在本包同步使用，避免在本包写出与全局不一致的类型定义。

### 4.3 ESLint/TS 规则
- eslint.config.js：
  - 通过 defineConfig({ packageRoot: __dirname, preset: 'node', rules: { noImplicitAny: 'off' } }) 定义规则。
  - 关闭 noImplicitAny，主要是为了与当前 Tea 接口中的 any 使用方式兼容（如 Proxy handler 的 target/receiver 等参数）。
- TypeScript 中通过 /* eslint-disable @typescript-eslint/no-explicit-any */ 的文件级禁用，允许在 Proxy handler 等场景使用 any。
- 新增代码时：
  - 如果必须使用 any，应限制在 Proxy / 桥接层等位置，避免在业务逻辑或公共 API 上暴露 any。
  - 尽量沿用 Tea 接口与 @coze-studio/tea-interface 中的泛型与联合类型，减少未知类型。

## 5. 与外部子系统的集成关系

### 5.1 与 @coze-studio/tea-interface 的集成
- 这是本包最关键的外部依赖，承担：
  - 事件枚举和参数定义（events 子模块）。
  - 初始化、配置、Collector 等核心类型。
- 集成方式：
  - 在 src/index.ts 中通过类型导入（type import）引用，不直接引入运行时代码。
  - 当前实现完全不依赖 @coze-studio/tea-interface 的运行时行为，仅依赖其类型信息，这保证了本包在构建/运行时非常轻量。
- 若将来需要在本包内加入真实 Tea 行为：
  - 应从 @coze-studio/tea-interface 中引入实际实现（或通过上层注入），而不是在本包内重写逻辑，以保持单一来源。

### 5.2 在业务包中的典型使用
- 其他前端包可以：
  - import Tea from '@coze-studio/tea-adapter';
  - 直接调用 Tea.init / Tea.event / Tea.sendEvent 等，不做额外 null/undefined 判断。
- 即使埋点链路尚未接入完整实现，调用也不会报错，只是无副作用。
- 因此，AI 助手在修改业务代码时，如发现对 Tea 的依赖，应优先从 @coze-studio/tea-adapter 导入，而不是自行引用底层 SDK。

## 6. 项目流程与协作规范（与 monorepo 相关）

### 6.1 Rush & workspace 依赖
- 本包依赖声明使用 "workspace:*"，由 Rush + PNPM 管理真实版本：
  - 本包依赖声明使用 "workspace:*"，由 Rush + PNPM 管理真实版本：
  - 当需要新增依赖时，应参考 frontend/README.md 中的说明，通过 Rush 流程（如 rush add）而非手动修改 lockfile。

### 6.2 分支与提交
- 整体遵循根仓库的贡献规范（见顶层 README、CONTRIBUTING 等），AI 助手在协作时应假定：
  - 变更需要保持最小影响面。
  - 不在子包内引入与全局规范冲突的工具链或脚本。

### 6.3 构建与发布
- 子包不直接控制发布流程，通常由 monorepo 统一的构建和发布流水线处理。
- AI 助手在本包中进行修改时，主要关注：
  - 类型和导出兼容性（避免破坏对 Tea 默认导出的依赖）。
  - 与 @coze-studio/tea-interface 的类型保持同步。

## 7. 非常规/易踩坑点

- 默认导出是 Proxy，而不是具体类实例：
  - 不要尝试对其使用 instanceof 或依赖其构造函数名。
  - 不要对 Tea 进行 JSON 序列化等操作（将得到函数或空对象），其主要用于调用 side-effect 方法，而非数据结构。
- build 脚本目前为占位：
  - 不要在本包中单独实现复杂的 bundler 配置（如直接引入 Rsbuild/Webpack 配置），而是遵循 monorepo 统一方案。
- tsconfig.json 使用 exclude: ["**/*"]：
  - 这并不代表本包没有被编译，而是通过 tsconfig.build.json 等子配置参与整个工程编译。
  - 若 AI 助手需要添加新的 TS 配置，应仔细对齐 frontend/config/ts-config 中的统一配置，而不是随意覆盖。
- ESLint rules 中关闭 noImplicitAny：
  - 这是为当前 Proxy/any 使用做的妥协，不代表项目整体鼓励大量 any。
  - 新代码应尽量避免扩大 any 的使用范围。

## 8. AI 助手在本包中的推荐操作

- 在以下场景可以放心修改：
  - 为 Tea 接口补充更完善的类型注释或 JSDoc，只要不改变现有签名。
  - 在 README.md / 本文件（copilot-instructions.md）中补充使用示例与文档。
  - 增加针对 Proxy 行为的单元测试（例如验证任意方法调用不会抛错）。
- 在以下场景需谨慎或避免：
  - 更改默认导出的类型或表现（例如从 Proxy 改为普通对象），这可能影响所有依赖此包的上游代码。
  - 引入与 @coze-studio/tea-interface 不一致的事件名或参数结构。
  - 在本包中实现真正的埋点逻辑，而不是通过接口包/上层注入来完成。

通过遵守上述约定，AI 编程助手可以在不破坏全局行为的前提下，对 @coze-studio/tea-adapter 进行安全的增强与维护。