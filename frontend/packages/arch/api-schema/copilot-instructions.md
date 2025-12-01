# @coze-studio/api-schema — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/api-schema）中安全、高效地协作开发。

## 全局架构与职责

- 本包对应 npm 包 `@coze-studio/api-schema`，定位为「API Schema 与 HTTP 客户端封装层」，为前端/SDK 提供基于 IDL 的类型安全 API 调用能力。
- 核心职责：
  - 维护各业务域的 API IDL（当前主要为 `passport` 与 `marketplace` 域）及其生成的 TypeScript 客户端代码。
  - 基于 `@coze-arch/idl2ts-runtime` 的 `IMeta` 元信息和 `@coze-arch/bot-http` 提供的 `axiosInstance`，在 `src/api/config.ts` 中封装统一的 `createAPI` 工厂函数，用于创建实际可调用的 HTTP API。
  - 通过 `src/index.ts` 统一聚合导出各域 API 命名空间（`passport`、`explore`），并在 `package.json` 中配置 `exports` / `typesVersions` 以保证消费方导入路径稳定。
- 本包不负责 UI 渲染或业务逻辑，只关心「API 形状」与「HTTP 调用约定」，是前端和后端之间的契约层。

## 代码结构与数据流

- 入口与导出：
  - [frontend/packages/arch/api-schema/src/index.ts](frontend/packages/arch/api-schema/src/index.ts)
    - 含 Apache-2.0 版权头；仅做命名空间 re-export：
      - `export * as passport from './idl/passport/passport'`：认证/登录等 passport 域 API。
      - `export * as explore from './idl/marketplace/public_api'`：marketplace/explore 域 API。
    - 不包含业务逻辑，新增导出域时应在此文件添加对应命名空间，并同步更新 `package.json` 的 `exports` 与 `typesVersions`。
- HTTP 封装：
  - [frontend/packages/arch/api-schema/src/api/config.ts](frontend/packages/arch/api-schema/src/api/config.ts)
    - 从 `@coze-arch/idl2ts-runtime` 引入 `createAPI as apiFactory` 与 `IMeta`，从 `@coze-arch/bot-http` 引入预配置好的 `axiosInstance`。
    - 暴露泛型工厂函数：
      - `createAPI<T, K, O, B extends boolean = false>(meta: IMeta, cancelable?: B)`。
      - 内部调用 `apiFactory(meta, cancelable, false, { config: { clientFactory } } as any)`。
      - `clientFactory(uri, init, options)` 负责将抽象请求描述转换为 Axios 请求参数：
        - 按 `init.method` 区分：`POST`/`PUT`/`PATCH` 使用 `data` 携带 body，其它方法（含 `GET`/`DELETE`）使用 `params`。
        - 若 `init.serializer === 'json'` 且存在 `body`，则对 body 做 `JSON.stringify`，其余 serializer 直接透传 body。
        - 合并 headers，并统一添加 `'x-requested-with': 'XMLHttpRequest'`。
        - 将 `options?.__disableErrorToast` 透传到 `axiosInstance.request` 的自定义配置中，以便全局拦截器根据该字段决定是否弹出错误 Toast。
    - 这是 HTTP 行为与 IDL 元信息的唯一集中封装点，新增/修改调用策略（如超时、重试、特殊 header）应在此实现。
- IDL 与生成代码：
  - [frontend/packages/arch/api-schema/src/idl](frontend/packages/arch/api-schema/src/idl) 下存放各域的 IDL 生成结果和基础类型：
    - `base.ts`：定义通用请求/响应基础结构，如 `Base`, `BaseResp`, `EmptyReq`, `EmptyResp` 等，与后端协议对齐。
    - `passport/passport.ts`：passport 业务域 API 定义（使用 idl2ts 生成，细节可在需要时查阅）。
    - `marketplace/public_api.ts`、`product_common.ts`、`marketplace_common.ts`：marketplace 域的 API 与通用结构定义。
  - 生成配置：
    - [frontend/packages/arch/api-schema/api.config.js](frontend/packages/arch/api-schema/api.config.js)（如存在）与脚本 `npm run update` 中的 `idl2ts gen ./` 协同工作，将 Thrift/IDL 描述转换为 TS 客户端与 `IMeta` 元信息。
  - 运行时 schema：
    - [frontend/packages/arch/api-schema/src/_schemas.d.ts](frontend/packages/arch/api-schema/src/_schemas.d.ts)、[frontend/packages/arch/api-schema/src/_schemas.js](frontend/packages/arch/api-schema/src/_schemas.js) 作为 schema 列表的声明与占位（当前 JS 文件导出空数组），用于 idl2ts 运行时按需扩展。
    - [frontend/packages/arch/api-schema/src/_mock_utils.js](frontend/packages/arch/api-schema/src/_mock_utils.js) 提供 `createStruct` 等辅助函数，用于在基于错误堆栈防止递归调用死循环的场景下构造 mock 结构。

## 构建、测试与脚本

- `package.json`（见 [frontend/packages/arch/api-schema/package.json](frontend/packages/arch/api-schema/package.json)）中的主要脚本：
  - `build`: `exit 0`
    - 本包自身不进行独立构建，实际打包由上层 monorepo 的统一流程处理（例如 bundler/tsc 在顶层运行）。请不要在此添加自定义打包逻辑，以免与现有流水线冲突。
  - `lint`: `eslint ./ --cache`
    - ESLint 配置来源于 workspace 公共包 `@coze-arch/eslint-config`（通常为 `web` 预设），如需调整规则请在本包 `eslint.config.js` 中按项目约定局部覆盖。
  - `test`: `vitest --run --passWithNoTests`
    - 测试由 Vitest 驱动，配置文件 `vitest.config.ts` 使用 `@coze-arch/vitest-config` 统一预设（`preset: 'web'`）。当前若没有测试文件也会顺利通过。
  - `test:cov`: `vitest --run --passWithNoTests --coverage`
    - 在测试基础上增加覆盖率统计，输出目录与格式遵循 monorepo 通用约定。
  - `update`: `idl2ts gen ./`
    - 使用 `@coze-arch/idl2ts-cli` 扫描本包的 IDL 配置并生成 TS 客户端代码及元信息。修改 IDL 后，应优先运行该命令以更新生成文件，然后再提交变更。
- Rush/Rushx 集成：
  - 额外项目配置位于 [frontend/packages/arch/api-schema/config/rush-project.json](frontend/packages/arch/api-schema/config/rush-project.json)（若存在），用于声明 `ts-check`/`build` 等 Rush operation 输出；执行类型检查和构建时建议通过仓库根目录的 Rush 命令触发（例如 `rushx lint --to @coze-studio/api-schema`）。

## 类型与导出约定

- 对外导出路径通过 `package.json` 的 `exports` 与 `typesVersions` 统一维护：
  - `"."` → `./src/index.ts`
  - `"./passport"` → `./src/idl/passport/passport.ts`
  - `"./marketplace"` → `./src/idl/marketplace/public_api.ts`
- 约定：
  - 新增业务域（例如 `./conversation`）时，需同步更新：
    - IDL 文件与生成结果（`src/idl/...`）。
    - `src/index.ts` 中的命名空间导出。
    - `package.json` 中的 `exports` / `typesVersions`，保证 JS 模块与类型声明路径一致。
  - 消费侧应优先通过包级命名空间导入：
    - 例如 `import { passport } from '@coze-studio/api-schema'` 或 `import * as marketplace from '@coze-studio/api-schema/marketplace'`，避免依赖未在 exports 中声明的深层路径。
- IDL 基础类型（如 `Base`, `BaseResp`, `EmptyReq` 等）集中在 `src/idl/base.ts`，应视为与后端协议紧耦合的公共结构，修改字段或语义前需确认后端 IDL 已同步更新。

## 与外部依赖的集成细节

- `@coze-arch/bot-http`：
  - 提供统一配置好的 `axiosInstance`，包含 baseURL、鉴权、拦截器、错误处理等全局行为。
  - `createAPI` 的 `clientFactory` 使用 `axiosInstance.request` 发起 HTTP 调用，不直接 new axios；若需要调整全局超时、错误弹窗策略，应优先在 `bot-http` 侧修改，而非在本包分散设置。
  - `options?.__disableErrorToast` 通过 Axios 自定义配置字段传入，用于告知拦截器在某些请求场景下关闭错误 Toast。
- `@coze-arch/idl2ts-runtime`：
  - 提供 `createAPI` 与 `IMeta` 的运行时支持：
    - `IMeta` 描述某个 API 的 HTTP method、路径、请求体/响应体结构、序列化方式等。
    - `apiFactory` 基于 `meta` 与注入的 `clientFactory` 生成类型安全的 API 函数集合（例如 `client.xxx(params)`）。
  - 本包在 `src/api/config.ts` 中仅定制 `clientFactory`（HTTP 细节），不关心具体 API 名称或入参与出参类型，后者来自 IDL 生成代码。
- `@coze-arch/idl2ts-cli`：
  - 用于执行 `idl2ts gen ./`，根据 `api.config.js` / Thrift/IDL 文件生成 TypeScript 代码及 `IMeta`。
  - 生成策略（如文件路径、命名规则）由 CLI 与配置决定，AI 助手在需要修改生成逻辑时，应优先查看 `api.config.js` 与 CLI 文档，而不是直接手改生成结果。

## 开发协作规范与注意事项

- 不要在本包内编写业务逻辑：
  - 本包仅负责协议与 HTTP 封装；任何与具体产品功能（例如 UI 状态、业务规则）的逻辑应在上层应用或其它 domain 包中实现。
- 修改 HTTP 行为时的优先策略：
  - 若是全局行为（如超时、重试、错误弹窗策略），优先修改 `@coze-arch/bot-http` 的 `axiosInstance` 配置。
  - 若是仅针对本包的特殊需求（例如固定 header、特定序列化方式），可在 `src/api/config.ts` 的 `clientFactory` 内增减逻辑，但应避免引入与具体业务强绑定的 header 字段。
- 维护 IDL 与生成代码的一致性：
  - 调整 IDL（Thrift/IDL 文件）后，必需运行 `npm run update` 以生成最新 TS 代码；不要手工修改生成的 `src/idl` 文件内容，否则下次生成会被覆盖。
  - 引入新的公共基础类型时，应优先在 `src/idl/base.ts` 中统一声明，以便多域共享。
- 避免破坏导出 API：
  - 修改 `src/index.ts`、`package.json.exports`、`typesVersions` 时，应全局搜索引用（包括其它 frontend 子包与 apps），避免非兼容变更导致构建或运行失败。
  - 如确需变更导出路径，应在调用侧同步更新，并在变更记录中说明迁移方式。
- 测试与验证：
  - 对 `createAPI` 的行为变更，建议至少添加/更新一份针对 `clientFactory` 的单元测试（在 `__tests__` 目录中），验证：
    - 不同 HTTP 方法下 `params` 与 `data` 的选择逻辑。
    - JSON 序列化行为（`serializer === 'json'`）。
    - header 合并与 `x-requested-with` 字段存在。
    - `__disableErrorToast` 透传到 Axios 配置中。

## AI 助手使用建议

- 在本包内工作时，可以安全进行的操作包括：
  - 补充/调整 `createAPI` 的 HTTP 细节实现（如增加默认超时、追加公共 header），前提是不引入与具体业务耦合的逻辑。
  - 在已有模式下新增业务域的 IDL 生成与导出（更新 `src/idl`、`src/index.ts`、`package.json` 中的 `exports` 与 `typesVersions`）。
  - 为 `createAPI` 与 IDL 生成结果添加/更新单元测试。
- 需要谨慎的操作：
  - 直接修改 `src/idl` 生成文件结构或字段类型；此类变更必须与后端 IDL 同步，并通过 `idl2ts` 生成流程完成。
  - 删除或重命名已有导出入口（包括 `explore` 命名空间和 `./passport` / `./marketplace` 子路径）。
- 若在消费侧遇到 API 行为异常（如参数未按预期序列化、错误弹窗逻辑不符合预期），排查顺序建议为：
  1. 检查消费方调用方式与类型定义是否匹配（`@coze-studio/api-schema` 导出类型）。
  2. 检查 IDL 与生成的 `IMeta` 是否与后端协议一致。
  3. 最后再检查本包 `createAPI` 中的 `clientFactory` 实现是否存在逻辑错误或遗漏。