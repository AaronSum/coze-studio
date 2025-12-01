# @coze-arch/tea 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/tea）中安全、高效地协作开发。

## 1. 全局架构与角色定位

- 本包是一个 **极薄的架构封装层**，核心职责：
  - 默认导出 `Tea`：从 `@coze-studio/tea-adapter` 透传而来，用于在上层应用中统一引用埋点 / 事件上报能力。
  - 重新导出 `@coze-studio/tea-interface/events` 中的 **事件常量与类型**，为其它前端子包提供稳定的事件契约。
- 代码入口位于 [frontend/packages/arch/tea/src/index.ts](frontend/packages/arch/tea/src/index.ts)：
  - `default` export：`Tea`（来自 `@coze-studio/tea-adapter`）。
  - `export { ... }`：对事件常量（如 `EVENT_NAMES`, `AddPluginToStoreEntry`, `FlowStoreType` 等）做统一聚合导出。
  - `export type { ... }`：透传埋点 / 产品事件相关的 TS 类型，方便调用端获得类型提示与约束。
- 该包本身 **不实现业务逻辑、不持久化数据，也不直接操作 DOM**；所有行为都由下层 adapter / interface 包完成。
- 设计动机：
  - 将具体实现包（adapter / interface）的细节从业务代码中抽离，业务统一依赖 `@coze-arch/tea`，便于未来替换实现或拆分新包。
  - 在 monorepo 内提供统一的事件命名与类型来源，减少跨包循环依赖和重复定义。

## 2. 目录结构与关键文件

- [frontend/packages/arch/tea/package.json](frontend/packages/arch/tea/package.json)
  - `main: "src/index.ts"`：入口始终是 TS 源码，构建由上层 Rush/打包工具控制。
  - `scripts`：
    - `build`: 当前为 `exit 0`，表示该包自身不单独构建，通常由 workspace 统一构建。
    - `lint`: `eslint ./ --cache`，对整个包执行 Lint。
    - `test`: `vitest --run --passWithNoTests`，允许无测试文件时通过。
    - `test:cov`: 在 `test` 基础上开启覆盖率。
  - `dependencies`：
    - `@coze-arch/bot-typings`：共享 bot 相关 TS 类型。
    - `@coze-studio/tea-adapter`：实际 Tea 实现（埋点 SDK / 适配层）。
    - `@coze-studio/tea-interface`：事件枚举与类型定义源头。
- [frontend/packages/arch/tea/src/index.ts](frontend/packages/arch/tea/src/index.ts)
  - 唯一源码文件，负责：
    - 默认导出 `Tea`。
    - 按需 re-export 事件常量与类型。
  - 所有对 Tea 的使用应通过 `@coze-arch/tea` 进行，引入路径不要直接指向 adapter / interface。
- [frontend/packages/arch/tea/vitest.config.ts](frontend/packages/arch/tea/vitest.config.ts)
  - 使用 monorepo 公共测试配置：`@coze-arch/vitest-config`。
  - `preset: 'web'` 表示该包定位为 web 环境（React、DOM 相关依赖已在 devDependencies 中）。
- [frontend/packages/arch/tea/tsconfig.json](frontend/packages/arch/tea/tsconfig.json)
  - 通过 `references` 引用 `tsconfig.build.json` 与 `tsconfig.misc.json`，并设置 `composite: true` 以支持 TS project references。
  - 根 `exclude: ["**/*"]` 表示真正的编译配置在 build/misc tsconfig 中，当前文件主要用于 monorepo 依赖图管理。
- 其它配置文件
  - [frontend/packages/arch/tea/eslint.config.js](frontend/packages/arch/tea/eslint.config.js)（未在此展开）依赖 `@coze-arch/eslint-config`，统一 lint 规则。
  - [frontend/packages/arch/tea/config/rush-project.json](frontend/packages/arch/tea/config/rush-project.json)（如存在）用于 Rush 项目标识及构建集成。

## 3. 事件与 Tea 集成方式

- 常量导出（来自 `@coze-studio/tea-interface/events`）：
  - `EVENT_NAMES`：全局事件名枚举，业务埋点应优先从这里取值，避免硬编码字符串。
  - 一系列以 `Add*`, `Bot*`, `Flow*`, `Plugin*` 命名的常量，用于特定业务域（插件、工作流、Bot 详情页等）的事件标识。
- 类型导出：
  - `ExploreBotCardCommonParams`, `PluginMockSetCommonParams`, `UserGrowthEventParams` 等：
    - 描述埋点时 payload 的形状，调用端在构造事件参数时应完全遵守这些类型。
  - `ProductEventSource`, `ProductEventFilterTag`, `ProductEventEntityType` 等：
    - 用于限制事件来源、过滤标签、实体类型等字段的取值范围。
- Tea 默认导出：
  - 实际 Tea 接口来自 `@coze-studio/tea-adapter`，常见调用方式通常为：
    - `Tea.track(EVENT_NAMES.xxx, params)` 或类似 API（具体签名请在 adapter 包中查看）。
  - 在本包中 **不要直接实现新的 Tea 方法**；如需扩展，请在 `@coze-studio/tea-adapter` 中实现后再通过本包导出。

## 4. 开发与常用工作流

- 安装依赖
  - 在 monorepo 根目录使用 Rush 统一管理：
    - `rush update`：安装 / 更新所有前端依赖。
- 本包相关脚本（在根目录通过 Rush 调用，或在子包中单独执行）：
  - Lint：
    - `cd frontend && rushx lint --to @coze-arch/tea`（示例，具体脚本请参考 frontend/README）。
    - 或在包内运行：`npm run lint`。
  - 测试：
    - `npm test`：运行 Vitest，当前允许没有测试文件。
    - `npm run test:cov`：生成覆盖率报告。
  - 构建：
    - `npm run build` 目前为 no-op，由上层工具链控制构建顺序与输出目录；
    - AI 在修改配置时不要擅自替换为真实构建命令，除非同步调整 monorepo 构建策略。

## 5. 项目约定与风格

- 导出策略
  - 对外使用统一入口：业务应始终从 `@coze-arch/tea` 引用事件与 Tea，而不是 `@coze-studio/tea-*` 系列内部包。
  - 新增事件或类型时：
    - 优先在 `@coze-studio/tea-interface/events` 中定义，再在本包 `src/index.ts` 中补充 re-export。
    - 保持导出列表按类别或字母序大致有序，方便查找和 diff。
- 类型安全
  - 事件参数必须使用透出的 TS 类型，避免 `any` 或宽松对象字面量；
  - AI 在添加示例或调用代码时，应严格遵守这些类型定义（可在 tea-interface 包内查看细节）。
- 代码风格
  - 使用 TypeScript ES 模块语法，遵从 monorepo 统一 ESLint/TSConfig 规则；
  - 本包代码量极少，**不要引入新的运行时依赖**，除非有明确架构需要且会在其它相关包中同时更新。

## 6. 与外部包的关系

- `@coze-arch/bot-typings`
  - 提供与 Bot 相关的公共类型；若 Tea 事件需要携带 Bot 结构字段，应在此包中扩展类型，而不是在本包内定义新 interface。
- `@coze-studio/tea-adapter`
  - 真正的埋点 SDK 适配实现（如对接内部埋点系统、第三方埋点平台等）。
  - 如需扩展 Tea 的能力（增加方法、改变上报策略），应在该包中实现；本包只做导出。
- `@coze-studio/tea-interface`
  - Tea 相关事件名、事件参数类型的 **单一事实来源**；
  - 本包仅做 re-export，不负责定义这些结构。

## 7. 测试与调试注意事项

- 当前包默认允许无测试文件通过 CI（`--passWithNoTests`），因此：
  - 若未来在此处添加逻辑（不再只是 re-export），建议同时新增 Vitest 用例，放在 `src/__tests__` 或项目约定的测试目录中；
  - 测试时应模拟或轻量 mock Tea 实现，避免实际对埋点系统产生请求（可在 adapter 或上层应用中编写更完整的集成测试）。
- 若调试 Tea 行为：
  - 主要在使用方应用或 `@coze-studio/tea-adapter` 中调试；
  - 本包只负责导出，通常不会是问题根源，除非导出列表遗漏或路径变更。

## 8. 变更建议与风险控制

- 可以安全进行的修改：
  - 在 `src/index.ts` 中 **增加**新的事件常量 / 类型的 re-export，只要它们已在 `@coze-studio/tea-interface/events` 中定义；
  - 维护文档（README、copilot-instructions）和配置文件中的注释。
- 高风险修改（AI 默认应避免，除非有明确指令）：
  - 更改默认导出的 `Tea` 来源或类型签名；
  - 将业务逻辑直接实现到本包内，而不是放在 adapter / interface 或调用方。
  - 修改 package.json 中依赖的名称、范围或主入口路径，这会影响整个 monorepo 的构建和运行。

以上内容应足以让 AI 助手在该子包中安全地：
- 新增或同步 Tea 相关事件 / 类型导出；
- 理解本包在架构中的位置与边界；
- 避免将业务逻辑或重构决策误放到这个“薄封装”层中。