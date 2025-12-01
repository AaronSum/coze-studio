# @coze-studio/default-slardar Copilot 使用说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/default-slardar）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包是 Coze Studio 单仓前端工程中的一个「架构层工具包」，位于 `frontend/packages/arch/default-slardar`。
- 主要职责：提供一个符合 `@coze-studio/slardar-interface` 约定的 *默认/兜底 Slardar 实例*，用于在未显式注入真实监控 SDK 时，保证上层调用链安全、无报错地运行。
- 核心导出在 [src/index.ts](src/index.ts)：
  - 通过 `Proxy` 包装一个空函数，并实现 `get` / `apply` 拦截，将所有属性读取与函数调用都路由到 `mockSlardar`，当前实现是 no-op。
  - 最终以 `default export` 的形式导出，并通过类型断言为 `SlardarInstance`，类型定义来自依赖包 `@coze-studio/slardar-interface`。
- 典型使用场景：
  - 作为应用中 Slardar 监控能力的默认实现，真实环境可能会通过依赖注入或配置替换为真正的监控 SDK；在开发/测试或未接入监控时使用本包，保证上层业务无需大量空值判断即可安全调用。

## 代码结构与主要文件

- [src/index.ts](src/index.ts)
  - 唯一业务源码文件，核心逻辑是构造一个符合 `SlardarInstance` 接口的代理对象：
    - `noop`：空实现函数，保证任何调用都不会抛错。
    - `mockSlardar`：当前等于 `noop`，后续如需增加简单日志/埋点，可集中修改此处，而无需变更代理逻辑。
    - `proxyHandler.get`：拦截属性访问，返回 `mockSlardar[prop]`（如存在）或 `noop`；这样即便访问不存在的方法也不会出错。
    - `proxyHandler.apply`：拦截函数调用，将调用统一转发到 `mockSlardar` 本身。
    - `proxy`：实际创建的 `Proxy` 实例，目标对象是一个空函数，仅作为 `apply` 拦截的载体。
- [package.json](package.json)
  - `main`: `src/index.ts`，本子包主要作为 TS 源码在 Rush 构建体系内被消费。
  - `scripts`：
    - `build`: 当前实现为 `exit 0`，即构建逻辑由上层 Rush/工具链统一处理，本包不做额外构建步骤。
    - `lint`: 使用 ESLint 对当前包进行检查，规则由 `@coze-arch/eslint-config` 统一管理。
    - `test`: 通过 Vitest 运行单元测试，配置在 [vitest.config.ts](vitest.config.ts)。
    - `test:cov`: 在 `test` 基础上开启覆盖率统计，输出到 `coverage` 目录。
  - `dependencies`：
    - `@coze-studio/slardar-interface`: 通过 `workspace:*` 引用同仓接口定义，约束导出实例的形状，避免与其他包不兼容。
  - `devDependencies`：统一依赖 monorepo 层工具包（eslint-config / ts-config / vitest-config），不要在此包内重复自定义基础配置。
- [config/rush-project.json](config/rush-project.json)
  - 配合 Rush 的增量构建/缓存：
    - `operationSettings.test:cov.outputFolderNames = ["coverage"]`
    - `operationSettings.ts-check.outputFolderNames = ["dist"]`
  - AI 在改动影响这些输出目录的逻辑时，应保持目录结构与文件名稳定，避免破坏构建缓存或报告路径。
- [vitest.config.ts](vitest.config.ts)
  - `defineConfig` 来自 `@coze-arch/vitest-config`，统一 monorepo 测试规范。
  - 当前 preset 为 `node`，表示测试环境是 Node.js 而非浏览器。
- [eslint.config.js](eslint.config.js)
  - 使用 `@coze-arch/eslint-config`，preset 为 `node`，`rules` 为空对象，即沿用统一规则，不在此包内覆盖。
- [tsconfig.json](tsconfig.json), [tsconfig.build.json](tsconfig.build.json), [tsconfig.misc.json](tsconfig.misc.json)
  - 采用 monorepo 通用 ts-config 约定（通过 `extends`）；如需新增路径别名或编译选项，应优先考虑在 infra 级配置中统一处理，仅在确有必要时在本包做最小化覆盖。

## 开发与构建工作流

> 以下命令需在 monorepo 根目录通过 Rush 或在子包目录下使用 pnpm/npm 触发，具体以仓库实际 packageManager 为准。

- 本地安装依赖
  - 在仓库根目录：`rush update` 会安装并链接本包依赖。
- 进入子包开发
  - 工作目录：`frontend/packages/arch/default-slardar`。
- 代码检查
  - 运行 `npm run lint`（或通过 Rush：`rush lint -t @coze-studio/default-slardar`，具体以根仓脚本为准）。
  - 规则来源于 `@coze-arch/eslint-config`，默认针对 Node 环境；不要在本包中关闭全局通用规则，除非有充足理由且范围极小。
- 类型检查 / 构建
  - 构建脚本本身为 `exit 0`，通常由 Rush 的 `ts-check` 任务调用 `tsc` 进行编译。
  - 修改 TS 配置时，要注意与 Rush `operationSettings.ts-check` 输出目录 `dist` 的一致性。
- 测试
  - 单元测试：`npm run test` 使用 Vitest，测试文件放在 `__tests__` 或源码平级 `*.test.ts`、`*.spec.ts`。
  - 覆盖率：`npm run test:cov`，输出目录由 Rush 配置为 `coverage`，不要修改为其他目录名。
  - 当前仓库仅有 `__tests__/.gitkeep`，新增测试时优先补充对 `src/index.ts` 的行为校验（如：属性访问、函数调用均不抛错）。

## 约定与模式

- 默认实现作为「安全兜底」
  - 本包提供的是一个 *无副作用、无真实监控逻辑* 的 Slardar 实例：
    - 任何方法调用都应该是安全的，不抛异常，不依赖浏览器/Node 全局对象。
    - 如需加入轻量日志/告警，应确保：
      - 不影响现有调用链（例如不能抛错或阻塞）。
      - 在 SSR/Node 环境下同样可运行。
- `Proxy` + `no-op` 模式
  - 使用 `Proxy` 的原因：
    - 外部调用方不需要约束方法名或属性集合；即便接口未来扩展，也不会因默认实现缺失方法而报错。
    - 可以通过 `mockSlardar` 集中实现行为，而不需要逐个方法实现空函数。
  - 修改建议：
    - 如需在默认实现中支持部分真实功能（例如简单埋点），推荐在 `mockSlardar` 内扩展，而非在 `proxyHandler` 中分支判断具体方法名。
    - 保持 `proxyHandler.get` 返回值始终为函数（或遵从 `SlardarInstance` 约定），避免出现调用 `undefined` 的情况。
- 类型约束
  - 所有对外暴露的内容应保持与 `@coze-studio/slardar-interface` 一致：
    - 新增导出前优先在接口包中定义类型，再在本包中实现。
    - 不要在本包内硬编码接口类型，避免与接口包升级不一致。

## 外部依赖与集成点

- `@coze-studio/slardar-interface`
  - 提供 `SlardarInstance` 类型，是本包对外行为的「协议」：
    - 上层业务只依赖接口包；默认实现与其他实现（如真实 SDK 适配器）都必须满足该接口。
  - 当接口发生变更（新增方法、改名等）时，本包需要：
    - 确保 `proxy` 的类型断言仍然成立，必要时调整 `mockSlardar` 的函数签名。
    - 通过单元测试覆盖新增方法的 no-op 行为，避免运行时类型不匹配。
- Monorepo 工具链
  - ESLint / Vitest / TSConfig 都通过 `@coze-arch/*` 包注入，保持与其他子包一致。
  - 不建议在本包中引入额外构建工具或测试框架，如确有必要应先评估对全仓的影响。

## 协作流程与注意事项

- 分支与提交流程
  - 遵循仓库根目录的贡献规范（见根目录的 CONTRIBUTING 文档和 Rush 相关脚本）。
  - 本包变更通常伴随接口包或上层业务变更，建议在 PR 描述中明确：
    - 变更是否仅影响默认实现（例如日志增强）。
    - 是否需要同步修改 `@coze-studio/slardar-interface` 或其他 Slardar 相关子包。
- 部署与发布
  - 作为 workspace 包，通过 Rush 统一版本管理与发布。
  - 不要在本包中引入 runtime 环境判断后执行副作用性逻辑（如直接上报网络请求），此类行为应放在真实实现包中，由应用显式选择启用。

## AI 编程助手使用建议

- 在本包中进行代码生成或修改时，优先遵循以下原则：
  - 不破坏「无副作用、无报错」的默认行为；任何新增逻辑都必须在异常情况下保持静默失败或本地降级。
  - 避免为单一业务场景引入复杂依赖，本包应保持极简、可在任何环境下加载。
  - 如需新增导出或改变对外 API，应同时检查并更新 `@coze-studio/slardar-interface`，并补充必要的测试。
- 在编写测试时：
  - 重点验证：
    - 任意方法名调用均不抛错。
    - 任意属性访问返回可调用函数或符合接口的对象。
  - 避免过度依赖内部实现细节（如具体使用 Proxy），而是围绕「默认实现行为稳定」这一契约进行断言。
