# @coze-studio/slardar-interface 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/slardar-interface）中安全、高效地协作开发。

## 1. 子包定位与整体角色
- 本包是 **Slardar 监控/日志系统的 TypeScript 接口层**，只定义类型、不包含任何运行时代码或实现逻辑。
- 主要出口为 [src/index.ts](src/index.ts)，对外暴露 `SlardarConfig`、`Slardar`、`SlardarInstance` 以及默认导出类型。
- 在整个 Coze Studio 前端中，本包被其它实现包（如 default-slardar、slardar-adapter 等）作为 **约束和契约** 使用，确保监控/埋点/日志接口统一。

## 2. 代码结构与数据流
- 目录概览：
  - [src/index.ts](src/index.ts)：唯一源码文件，声明核心接口与类型别名。
  - [__tests__/](__tests__)：当前仅包含 `.gitkeep`，暂无测试实现，但已经在配置中预留 Vitest 支持。
  - [eslint.config.js](eslint.config.js)：使用 monorepo 公共 ESLint 规则，preset 为 `node`。
  - [vitest.config.ts](vitest.config.ts)：使用 `@coze-arch/vitest-config`，preset 为 `node`，适配纯类型/工具包测试。
  - [tsconfig*.json](tsconfig.build.json)：通过 references 与 monorepo 公共 tsconfig 建立增量编译关系。
  - [config/rush-project.json](config/rush-project.json)：供 Rush 识别覆盖物输出目录（coverage, dist）。
- 数据流特点：
  - 由于只包含类型，**没有真实数据在本包内部流转**；所有“数据流”体现在接口签名和结构约束中。
  - 外部实现包会根据 `Slardar` 接口的重载函数签名，接收错误对象、事件指标、日志内容、上下文键值等，最终发送至真实监控服务。
  - `Slardar.config` 提供“getter + setter” 组合签名，用于在实现中维护配置状态；`on/off` 用于在实现中挂载事件监听能力。

## 3. 关键接口与约定
- [src/index.ts](src/index.ts) 中的核心类型：
  - `SlardarConfig`
    - 字段：`sessionId?: string; [key: string]: unknown;`
    - 约定：实现方需能容忍并存储任意扩展字段，不应对未知 key 进行破坏性操作。
  - `SlardarEvents` 联合类型：
    - `'captureException' | 'sendEvent' | 'sendLog' | 'context.set'`
    - 建议外部实现/调用方优先使用这些常量字符串，避免魔法字符串错误。
  - `Slardar` 接口重载：
    - 泛型入口：`(event: string, params?: Record<string, unknown>)` 允许扩展型事件；
    - `captureException`：支持 `Error`、`meta`（`Record<string, string>`）以及 React 组件栈信息 `{ version, componentStack }`；
    - `sendEvent`：结构化埋点事件，包含 `name`、`metrics: Record<string, number>`、`categories: Record<string, string>`；
    - `sendLog`：结构化日志，`level`/`content`/`extra`（可为 string 或 number）；
    - `context.set`：上下文管理 `(event: 'context.set', key: string, value: string)`；
    - `config`：函数重载，既可以无参获取配置，也可以以 `Partial<SlardarConfig>` 形式更新配置；
    - `on/off`：事件订阅/取消订阅函数，签名 `(event: string, callback: (...args: unknown[]) => void)`。
  - `SlardarInstance`：单纯的 `Slardar` 类型别名，便于在业务代码中表达“实例”含义。
- 设计思路：
  - 通过重载而非多个独立方法，让调用形式统一为 `slardar(eventName, ...)`，符合常见监控 SDK 使用方式。
  - 类型对参数结构做了强约束，尤其是 metrics/categories/extra 的 key-value 形态，减少埋点时的结构漂移。

## 4. 构建、测试与本地开发流程
- 本包不产出实际 JS 构建产物，当前 `build` 是 no-op：
  - `npm run build` → `exit 0`，用于在 Rush 流水线中占位。
- 推荐工作流（在 monorepo 根目录）：
  - 安装依赖：`rush install` 或 `rush update`。
  - 只对本包运行测试（如果将来补充）：
    - `cd frontend/packages/arch/slardar-interface`
    - `npm test` → `vitest --run --passWithNoTests`（当前在无测试文件时仍视为成功）。
    - `npm run test:cov` 生成 coverage 输出到 `coverage/`，路径由 [config/rush-project.json](config/rush-project.json) 声明。
  - Lint：
    - `npm run lint` 使用 `@coze-arch/eslint-config`，preset 为 `node`，对 TS/JS 源码做统一检查。
- TypeScript 配置：
  - [tsconfig.json](tsconfig.json) 仅做 `composite` 根，实际编译配置在：
    - [tsconfig.build.json](tsconfig.build.json)：编译 `src`，`outDir = dist`，`module = CommonJS`，`target = ES2020`。
    - [tsconfig.misc.json](tsconfig.misc.json)：覆盖 `__tests__` 与 `vitest.config.ts` 的编译需求。
  - 两个 tsconfig 均继承 `@coze-arch/ts-config/tsconfig.node.json`，保持与全局 Node 环境一致。

## 5. 项目约定与风格
- 代码风格：
  - 按照 Coze 前端统一规范，ESLint + TypeScript 严格模式；请遵守现有 `preset: 'node'` 的 lint 规则，不要引入浏览器特定全局。
  - 文件顶部使用统一的 Apache-2.0 版权头；新增 TS 文件时请保持一致。
- 类型与接口约定：
  - **不要在本包中写任何运行时实现逻辑**，包括函数体、类实现等；这里仅存放类型定义。
  - 新增接口时，应评估是否会破坏现有实现包的兼容性；优先通过新增可选字段或联合类型扩展，而非强制修改既有字段类型。
  - 避免对外暴露过于具体的实现细节（如具体埋点服务供应商名称）；保持抽象层级，聚焦“监控/日志能力本身”。

## 6. 与其它子包的协作与依赖
- 直接依赖：
  - 仅依赖开发工具包：`@coze-arch/eslint-config`、`@coze-arch/ts-config`、`@coze-arch/vitest-config` 等，无运行时依赖。
- 间接协作：
  - 其他包（如 `@coze-studio/default-slardar`、`@coze-studio/slardar-adapter` 等）会实现 `Slardar` 接口并在应用中注入实例。
  - 应用层可通过 `SlardarInstance` 类型来约束依赖注入、上下文对象或 Hooks 返回值，确保监控能力接口在各处一致。
- 对接上层架构：
  - 本包位于 `arch` 层，处于**基础设施类型定义**角色，不直接依赖业务 domain 或 feature 包，从而避免耦合与循环依赖。

## 7. 开发建议（供 AI 助手遵循）
- 适合在本包里做的修改：
  - 扩展 `SlardarConfig` 字段（以可选和宽松类型为主）；
  - 新增受控的事件名到 `SlardarEvents`，并为其在 `Slardar` 接口中增加对应重载；
  - 调整注释、文档、README 中的描述，使其与实际接口保持同步。
- 不建议在本包进行的操作：
  - 添加任何业务逻辑、监控上报实现或与浏览器/Node API 紧耦合的代码；
  - 引入新的运行时依赖（npm dependencies）；
  - 直接改动 monorepo 其他子包的实现行为（请在对应子包中修改）。

## 8. 版本管理与发布注意点
- package.json 中版本号目前为 `0.0.1`，由整个 monorepo 的发布流程统一管理。
- 由于本包是“接口层”，**任何破坏性改动都可能影响大量下游包**：
  - 在调整已有字段类型或删除重载前，应考虑通过新增重载/新增可选字段实现兼容；
  - 如果确需破坏性修改，应在提交描述中明确标注，并与仓库维护者协调。
