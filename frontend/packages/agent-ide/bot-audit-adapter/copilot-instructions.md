# bot-audit-adapter 子包协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-audit-adapter）中安全、高效地协作开发。

## 1. 全局架构与定位

- 本子包是 Coze Studio 前端 monorepo 中的一个轻量“适配层”包，位于 agent-ide 分支，用于为 IDE 侧的“机器人审核（bot audit）”能力提供统一的 Hook/函数接口。
- 核心导出集中在 [src/index.ts](src/index.ts)：
  - `botInfoAudit`：用于执行机器人信息审核的异步函数。
  - `useBotInfoAuditor`：React Hook，封装审核状态与操作。
  - 同时 re-export `AuditErrorMessage` 自 [@coze-studio/bot-audit-base](../bot-audit-base)。
- 实际业务逻辑目前极简：
  - `botInfoAudit` 默认直接返回空审核结果 `{}`。
  - `useBotInfoAuditor` 仅维护一个布尔态 `pass`（默认 `true`），并暴露 `check`/`reset` 等接口，`check` 当前同样返回 `{}`。
- 该包通过依赖下列 workspace 包接入更大的架构：
  - `@coze-arch/bot-api` / `@coze-arch/bot-space-api` / `@coze-arch/bot-flags`：提供机器人相关 API、空间/标记等基础能力与类型。
  - `@coze-arch/i18n`：多语言能力（当前文件未直接使用，但在未来扩展时可复用）。
  - `@coze-studio/bot-audit-base`：抽象出与审核相关的基础类型、错误消息等，本包实现这些抽象。
  - `@coze-studio/bot-detail-store`：与机器人详情数据状态有关的 store，未来审核时可能需要。
- 当前实现更类似“占位适配层”：
  - 在上层（Studio/IDE UI 等）可以安全调用统一接口，而无需关心审核逻辑是否已经完善。
  - 为后续逐步下沉真实审核逻辑、接入 API / Store / i18n 留出稳定接口面。

## 2. 源码结构与数据流

- 目录结构（仅与开发相关部分）：
  - [src/index.ts](src/index.ts)：子包入口，集中导出对外 API。
  - [src/hooks/use-bot-audit/index.ts](src/hooks/use-bot-audit/index.ts)：
    - 导出 `botInfoAudit`（函数）与 `useBotInfoAuditor`（React Hook）。
    - 使用来自 `@coze-arch/bot-api/playground_api` 的类型：`BotAuditInfo`、`BotInfoAuditData`。
    - 使用来自 `@coze-studio/bot-audit-base` 的类型：`UseBotInfoAuditorHook`、`BotInfoAuditFunc`。
  - [__tests__/index.test.ts](__tests__/index.test.ts)：占位测试文件，当前仅做框架连通性测试。
- 关键类型/数据流：
  - `BotAuditInfo`：上游传入的机器人审核输入信息（从 playground/bot API 侧定义）。
  - `BotInfoAuditData`：审核结果数据结构（目前实现返回空对象 `{}`）。
  - `UseBotInfoAuditorHook`：hook 的返回结构约定，一般包含：
    - `check(info: BotAuditInfo): Promise<BotInfoAuditData>`：触发审核。
    - `pass: boolean`：审核是否通过的标记。
    - `setPass(value: boolean)`：手动修改通过状态。
    - `reset()`：恢复默认通过状态。
- 状态与副作用：
  - `useBotInfoAuditor` 使用 React `useState` 管理 `pass`，默认值为 `true`（`defaultPassState`）。
  - 当前实现中 `check` 与 `botInfoAudit` 均为纯 Promise.resolve({})，没有副作用；未来扩展时，可以在这里发起网络请求、读取 store、或根据 flags 判定。

## 3. 构建、测试与本地开发流程

- 包级脚本均在 [package.json](package.json) 中声明：
  - `build`: `exit 0`
    - 当前无真实打包过程，只是为了满足 Rush/monorepo 统一接口，构建阶段等价为 no-op。
  - `lint`: `eslint ./ --cache`
    - 使用 monorepo 共享的 `@coze-arch/eslint-config`，对整个包目录执行 ESLint 检查。
  - `test`: `vitest --run --passWithNoTests`
    - 使用 Vitest 运行测试；若没有测试文件也会被视为通过。
  - `test:cov`: `npm run test -- --coverage`
    - 在当前包上开启覆盖率统计，结合 [vitest.config.ts](vitest.config.ts) 中的覆盖率配置。
- Vitest 配置：
  - [vitest.config.ts](vitest.config.ts) 使用 `@coze-arch/vitest-config` 的 `defineConfig`：
    - `preset: 'node'`，测试运行在 Node 环境。
    - `test.coverage.all = true`，要求对所有文件计算覆盖率。
- TypeScript 构建配置：
  - [tsconfig.build.json](tsconfig.build.json)：
    - 继承 monorepo 通用 `@coze-arch/ts-config/tsconfig.node.json`。
    - `rootDir: ./src`，`outDir: ./dist`，构建产物统一输出到 `dist`。
    - 通过 `references` 依赖多个基础包的 `tsconfig.build.json` 以支持 TS project references。
  - [tsconfig.json](tsconfig.json)：
    - 声明为 composite 项目，并将 `tsconfig.build.json`、`tsconfig.misc.json` 作为引用。
    - `exclude: ["**/*"]`：自身不直接参与编译，由引用的 tsconfig 负责具体场景（build/misc/test）。
  - [tsconfig.misc.json](tsconfig.misc.json)：
    - 专门用于测试与脚本开发：
      - `include: ["__tests__", "vitest.config.ts"]`。
      - `types: ["vitest/globals"]`，允许在测试中直接使用 `describe`/`it`/`expect` 全局变量。

### 在 monorepo 中常见的调用方式（供 AI 参考）

- 在 workspace 根目录执行：
  - `rushx test --to @coze-studio/bot-audit-adapter`（如存在 Rush 脚本别名）。
  - 或进入子包目录后：
    - `pnpm test` / `npm run test`：仅针对本包运行 Vitest。
    - `pnpm lint` / `npm run lint`：仅针对本包运行 ESLint。

## 4. 项目特有的约定与模式

- **适配层模式**：
  - 类型与抽象定义在 `@coze-studio/bot-audit-base`、`@coze-arch/bot-api` 等独立包中；
  - 本包仅负责：
    - 将这些抽象“实现”为具体的 Hook/函数；
    - 对上层 UI（Agent IDE）暴露统一接口。
  - 扩展审核逻辑时，应优先复用并扩展 base 层，而不是在本包中重新定义类型。
- **默认“全通过”策略**：
  - `defaultPassState = true`，`useBotInfoAuditor` 的 `pass` 默认即视为审核通过。
  - 当前 `check`/`botInfoAudit` 返回空数据而不修改 `pass`，上层可将“没有额外错误信息”理解为通过。
  - 后续若引入真正审核规则，应谨慎调整默认行为，避免破坏已有依赖方的“乐观通过”假设。
- **React Hook 约定**：
  - `useBotInfoAuditor` 是标准 React Hook：
    - 只能在函数组件或其他 Hook 内调用；
    - 返回对象包含可变的 state setter（`setPass`）和重置方法（`reset`）。
  - 如需在非 React 环境执行审核逻辑（例如脚本或服务侧校验），应优先使用 `botInfoAudit` 函数，而非 Hook。
- **类型严格来自上游包**：
  - 不在本包中重复定义 `BotAuditInfo`/`BotInfoAuditData` 等类型。
  - 若需要扩展字段，优先到定义处（如 `@coze-arch/bot-api/playground_api` 或 `@coze-studio/bot-audit-base`）修改，再在此重新消费。

## 5. 与其他组件/包的集成细节

- 与 `@coze-studio/bot-audit-base`：
  - `AuditErrorMessage` 直接从 base 包 re-export，确保上层只需依赖本适配包即可获取错误消息类型。
  - hook 类型 `UseBotInfoAuditorHook`、函数类型 `BotInfoAuditFunc` 由 base 包定义，本包实现这些接口。
- 与 `@coze-arch/bot-api`：
  - 从 `playground_api` 模块导入审核相关的数据类型：
    - `BotAuditInfo`：作为审核输入。
    - `BotInfoAuditData`：作为审核输出。
  - 未来若需要实际调用后端审核接口，可在 `botInfoAudit` 或 `useBotInfoAuditor.check` 中：
    - 调用相应 API client（通常也在 `@coze-arch/bot-api` 中定义）。
- 与 React 与 IDE 上层：
  - 由于本包声明 `react` / `react-dom` 为 `peerDependencies`，上层应用需确保提供兼容版本（>= 18.2.0）。
  - 在 Agent IDE 中的典型用法可能为：
    - 在配置侧：调用 `botInfoAudit(botInfo)` 做一次静态校验。
    - 在编辑界面：通过 `const { check, pass, reset } = useBotInfoAuditor();` 控制 UI 上的提示与禁用状态。

## 6. 开发协作与流程约定

- **代码风格与 Lint**：
  - 遵循 monorepo 统一的 `@coze-arch/eslint-config` 与 `@coze-arch/stylelint-config`（虽本包当前无样式文件）。
  - 新增文件时保持现有头部版权声明格式不变。
- **测试策略**：
  - 当前仅有占位测试；未来为审核逻辑补充测试时，建议：
    - 放在 [__tests__](__tests__) 目录中，使用 Vitest + React Testing Library（如上层已有依赖）。
    - 利用 `tsconfig.misc.json` 已配置的 `vitest/globals` 类型支持。
- **版本与依赖**：
  - `version` 当前为 `0.0.1`，随 monorepo 的发布策略统一管理。
  - 所有内部依赖均使用 `workspace:*`，由 Rush/PNPM 统一解析，禁止在本包中写死具体版本号。

## 7. AI 编程助手在本包的注意事项

- 修改或扩展 `botInfoAudit` / `useBotInfoAuditor` 时：
  - 保持函数/Hook 的签名与类型引用不变，除非同步调整 base 包定义。
  - 优先在实现内部增加逻辑（例如根据 `BotAuditInfo` 字段集构造 `BotInfoAuditData`），而不是改变返回结构。
- 如需引入新的外部依赖：
  - 首先检查 monorepo 中是否已有相同功能的内部包可复用；
  - 若确需第三方库，应遵循项目级依赖规范（参考前端根目录 README 与 rush 配置）。
- 避免在本包中引入与 UI 强耦合的内容（组件、样式等）：
  - 本包更倾向做“逻辑适配层”，真正的 UI 实现应放在上层 Studio/Agent IDE 组件包中。