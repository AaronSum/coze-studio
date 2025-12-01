# @coze-arch/bot-space-api 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-space-api）中安全、高效地协作开发。

## 1. 全局架构与设计思路

- 本包是 Coze Studio 前端单体仓库中的一个纯 TypeScript 工具包，定位为「带空间上下文的 Bot API 代理层」，对外暴露 `SpaceApi` 与 `SpaceApiV2` 两个服务实例及相关类型。
- 代码集中在 [frontend/packages/arch/bot-space-api/src](frontend/packages/arch/bot-space-api/src) 目录，仅有两个核心文件：
  - [src/index.ts](frontend/packages/arch/bot-space-api/src/index.ts)：面向「开发者 Bot API」的空间封装代理，导出 `SpaceApi`。
  - [src/space-api-v2.ts](frontend/packages/arch/bot-space-api/src/space-api-v2.ts)：面向「Playground/Space 成员管理等 V2 API」的封装代理，导出 `SpaceApiV2`。
- 两个代理层都遵循同一模式：
  - 从 `@coze-arch/bot-studio-store` 读取当前 `space_id`（`useSpaceStore.getState().getSpaceId()`）。
  - 对外暴露的参数类型统一使用 `SpaceRequest<T> = Omit<T, 'space_id'>`，由代理自动注入 `space_id`，避免上层重复传参。
  - 通过 `Proxy` 拦截属性访问，动态路由到 `@coze-arch/bot-api` 中实际 API（`DeveloperApi` 或 `PlaygroundApi`）。
  - 当请求方法不在允许列表内时抛出 `CustomError`（`@coze-arch/bot-error`），并使用 `@coze-arch/report-events` 上报参数校验类问题。
- 该包不直接与 UI 交互，只提供带空间上下文的 API 调用入口，属于前端领域中的「基础网络能力 / SDK 层」。

### 1.1 SpaceApi（DeveloperApi 代理）

- 使用类型别名 `type D = DeveloperApiService<BotAPIRequestConfig>` 与联合类型 `ExportFunctions` 声明「允许暴露的 API 名称」。
- 通过 `new Proxy(Object.create(null), { get(_, funcName: ExportFunctions) { ... } })` 构造代理：
  - 在 `get` 中首先读取 `spaceId`，校验 `DeveloperApi[funcName]` 是否存在，不存在则抛 `CustomError`。
  - 为特定方法做额外行为：
    - `ExecuteDraftBot`：在 Axios `transformResponse` 中记录最后一次执行 ID 到 `globalVars.LAST_EXECUTE_ID`（`@coze-arch/web-context`）。
    - `WorkFlowList` → 实际调用 `DeveloperApi.WorkflowListV2`。
    - `CreateWorkFlow` → 实际调用 `DeveloperApi.CreateWorkflowV2`。
  - 返回一个包装函数 `<S extends keyof D>(params, options?) => DeveloperApi[funcName](...)`：
    - 将外部 `params` 与代理注入的 `space_id` 合并后调用底层 API。
    - 允许调用者传入额外的 Axios 配置（会与内部 `externalConfig` 合并）。

### 1.2 SpaceApiV2（PlaygroundApi 代理）

- 针对部分仅在 V2 版本或 Playground 侧暴露的 API 封装（成员管理、Bot 发布历史、审计等）。
- 使用 `apiList` 常量声明白名单，并通过联合类型 `ApiType` 限制可访问的方法名。
- 通过 `Proxy` 拦截属性访问：
  - 若 `funcName` 不在 `apiList` 中，则抛 `CustomError`，事件类型为 `REPORT_EVENTS.parmasValidation`。
  - 若合法，则返回包装函数，自动从 `useSpaceStore` 注入 `space_id` 后调用 `PlaygroundApi[funcName]`。
- 与 `SpaceApi` 保持同样的 `SpaceRequest<T>` 约定，保证上层调用风格统一。

## 2. 目录结构与角色

- [src](frontend/packages/arch/bot-space-api/src)：核心源码目录，仅包含 `index.ts`, `space-api-v2.ts`, `global.d.ts`（全局类型补充）。
- [__tests__](frontend/packages/arch/bot-space-api/__tests__)：Vitest 单元测试，覆盖 `SpaceApi` 与 `SpaceApiV2` 的关键行为：
  - [__tests__/index.test.ts](frontend/packages/arch/bot-space-api/__tests__/index.test.ts)：
    - 校验 `ExecuteDraftBot` 是否正确注入 `space_id` 且写入 `globalVars.LAST_EXECUTE_ID`。
    - 校验 `WorkFlowList`/`CreateWorkFlow` 重命名到 V2 API。
    - 校验任意不存在方法访问会抛出 `CustomError`。
  - [__tests__/space-api-v2.test.ts](frontend/packages/arch/bot-space-api/__tests__/space-api-v2.test.ts)：
    - 校验 V2 API 是否正确注入 `space_id` 并调用 `PlaygroundApi` 对应方法。
    - 校验白名单外方法访问会抛出 `CustomError`。
- [config](frontend/packages/arch/bot-space-api/config)：TS/ESLint/Vitest 等共享配置引用位置（具体内容在 monorepo 公共包中）。
- 顶层配置文件：
  - [tsconfig.build.json](frontend/packages/arch/bot-space-api/tsconfig.build.json)：继承 `@coze-arch/ts-config/tsconfig.web.json`，启用 `strictNullChecks`，指定 `rootDir: ./src` / `outDir: ./dist`。
  - [vitest.config.ts](frontend/packages/arch/bot-space-api/vitest.config.ts)：使用 `@coze-arch/vitest-config` 的 web 预设，并开启 `coverage.all = true`。
  - [eslint.config.js](frontend/packages/arch/bot-space-api/eslint.config.js)：接入 monorepo 级别 ESLint 配置。

## 3. 开发流程与常用命令

> 本包主要通过 Rush 与 workspace 机制集成到整个前端 monorepo 中，下述命令均在包根目录执行，或通过 Rush 统一调度。

- 构建：
  - 当前 `package.json` 中的 `build` 脚本为 `exit 0`，仅占位，不进行真实打包。本包通常依赖上层构建系统（Rush/应用打包）进行编译。
  - 若需要本地 TS 编译，可改用 monorepo 通用脚本（参考根目录或其他包，如 `rushx build`），但修改前请与团队确认。
- 测试：
  - `npm test` / `pnpm test` / `rushx test`（具体取决于仓库统一约定）：执行 Vitest 单测，使用 `vitest.config.ts`。
  - `npm run test:cov`：开启覆盖率统计（调用 `vitest --coverage`）。
- Lint：
  - `npm run lint`：对本包运行 ESLint，使用缓存策略，规则来源于 `@coze-arch/eslint-config`。
- 依赖安装与联调：
  - 通过 monorepo 顶层的 `rush update` 统一安装依赖，`package.json` 只声明 workspace 依赖。
  - 不在本包中直接运行 `npm install` 新增第三方包，新增依赖需按 monorepo 规范修改并提 PR。

## 4. 项目特有约定与模式

### 4.1 API 暴露白名单

- `SpaceApi` 通过 `type ExportFunctions = 'GetPlaygroundPluginList' | ...` 显式列出可访问的方法名：
  - 只有在联合类型中的方法才会在代理上被认为是「合法方法」，从而实现静态提示与访问控制。
  - 新增 API 时必须：
    1. 确认底层 `DeveloperApi` 已存在对应方法，并在其 TS 类型中声明完备的参数/返回类型。
    2. 将方法名加入 `ExportFunctions` 联合类型。
    3. 在必要时为该方法添加特殊逻辑分支（如 FG 处理、事件上报等）。
- `SpaceApiV2` 则通过 `const apiList = [...]` + `type ApiType = ...` 维持一份 V2 API 白名单，新增/删除 API 时需同步更新两处，以保持类型安全与运行时检查一致。

### 4.2 空间上下文注入模式

- 所有对外导出的 API 都不需要显式传入 `space_id`，而是在代理内部通过 `useSpaceStore.getState().getSpaceId()` 自动注入：
  - 这要求上层应用在调用前已正确初始化 SpaceStore，否则会出现 API 调用时 `space_id` 为空的逻辑错误。
  - AI 修改与新增代码时，不要在调用端再手动拼接 `space_id`，以免出现重复字段或与 store 状态不一致的问题。

### 4.3 错误处理与事件上报

- 未声明的方法访问一律抛出 `CustomError`，并带上 `REPORT_EVENTS.parmasValidation` 等事件码：
  - 该错误模式贯穿 `SpaceApi` 与 `SpaceApiV2`，用于统一参数校验类错误的行为与埋点。
  - AI 在扩展代理逻辑时，应复用这一模式，而非直接抛出通用 `Error`。
- `ExecuteDraftBot` 的响应处理中，使用 Axios `transformResponse` 链式扩展记录 `x-tt-logid`：
  - 代理会合并默认 `transformResponse` 与自定义处理函数，保证不破坏 Axios 全局默认行为。
  - 修改此处逻辑时需非常小心，避免中断默认响应处理链。

## 5. 与其他子包的集成关系

- 外部依赖（通过 workspace 链接）：
  - `@coze-arch/bot-api`：提供 `DeveloperApi`、`PlaygroundApi` 及 `BotAPIRequestConfig` 类型，是底层 HTTP 客户端与 API 规范所在。
  - `@coze-arch/bot-studio-store`：提供 `useSpaceStore`，负责空间级别的状态管理（如当前空间 ID）。
  - `@coze-arch/web-context`：提供 `globalVars`，用于跨模块共享执行日志 ID 等全局变量。
  - `@coze-arch/bot-error`：统一错误类型 `CustomError`，一般用于携带错误码与额外上下文。
  - `@coze-arch/report-events`：统一事件枚举 `REPORT_EVENTS`/`REPORT_EVENTS.parmasValidation`，用于错误/埋点上报。
- 这些包均位于同一 monorepo 的 `frontend/packages/arch` 或 `frontend/config` 下，本包只做轻量包装，不负责这些依赖的初始化与配置。

## 6. 测试与调试注意事项

- 单元测试采用 Vitest，Mock 策略：
  - 在 [__tests__/index.test.ts](frontend/packages/arch/bot-space-api/__tests__/index.test.ts) 与 [__tests__/space-api-v2.test.ts](frontend/packages/arch/bot-space-api/__tests__/space-api-v2.test.ts) 中，通过 `vi.mock` 对外部依赖（`@coze-arch/bot-api`、`@coze-arch/bot-studio-store`、`@coze-arch/report-events`、`@coze-arch/web-context`、`@coze-arch/bot-error`、`axios` 等）进行隔离，重点验证：
    - 代理是否正确拼装 `space_id`。
    - 方法重定向是否生效（如 Workflow V2 替换）。
    - 错误抛出路径是否使用 `CustomError`。
- 新增代理方法或行为时，应同步添加或扩展对应测试用例，保持覆盖率。
- 调试建议：
  - 由于 `SpaceApi`/`SpaceApiV2` 是 `Proxy` 对象，调试时可直接在调用处打断点，或在代理的 `get` 函数中插入临时日志（完成调试后必须移除）。

## 7. 变更规范与提交建议

- 新增/修改 API 时的基本步骤：
  - 确认 `@coze-arch/bot-api` 中已定义对应底层方法与类型。
  - 在 `ExportFunctions` 或 `apiList`/`ApiType` 中追加或调整方法名，保持字面量一致性。
  - 如有特殊行为（FG、日志、埋点等），在代理 `switch` 分支中实现，并确保不破坏原有默认分支逻辑。
  - 补充或更新 Vitest 用例，保证 CI 中 `test` 与 `lint` 均通过。
- 分支与发布策略遵循 monorepo 顶层规范（见根目录 README/贡献文档），本包本身不定义单独的发布流程。

## 8. AI 助手使用建议

- 在本包中进行自动化修改时，优先关注以下原则：
  - 不要直接修改底层 `DeveloperApi`/`PlaygroundApi` 调用签名，只在代理层做最小封装。
  - 保持 `SpaceRequest<T> = Omit<T, 'space_id'>` 的约定，不要让调用方再次显式传入 `space_id`。
  - 任何对外 API 的新增都必须更新类型白名单（`ExportFunctions`/`ApiType`）并添加测试用例。
  - 如需新增与空间强绑定的 V3+ API，优先考虑复用 `SpaceApiV2` 的模式新建文件，而非在 `index.ts` 中堆叠过多逻辑。