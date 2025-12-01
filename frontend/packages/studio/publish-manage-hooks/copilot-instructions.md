# @coze-studio/publish-manage-hooks 开发说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/publish-manage-hooks）中安全、高效地协作开发。

## 全局架构与角色定位

- 本包是 Coze Studio 前端 monorepo 中的「业务 Hooks 子包」，位于 `frontend/packages/studio`，主要为「发布管理（publish manage）」域提供可复用的 React Hooks。
- 当前实现聚焦于一个核心 Hook：`useIsPublishRecordReady`，用于轮询发布记录是否就绪，供上层应用（如 `frontend/apps/coze-studio`）在工作流/发布管理界面中消费。
- 对外仅通过 `src/index.ts` 进行导出，形成稳定的包级 API 边界：
  - 导出 `useIsPublishRecordReady` 业务 Hook
  - 导出 `UseIsPublishRecordReadyProps` 类型
- 数据流大致为：上层 UI/业务组件 → 调用本包 Hooks → 通过 `@coze-arch/bot-api` 调用后端智能体发布相关接口 → 得到发布记录状态 → 回传简单状态（`ready`、`inited`）给调用方。

## 代码结构与主要模块

- `src/index.ts`
  - 包的统一出口，只做 re-export：`useIsPublishRecordReady` 和其 props 类型。
  - 新增 Hooks 时，原则上也应在此集中导出，避免从内部路径（如 `src/hooks/...`）被上游直接引用。
- `src/hooks/use-is-publish-record-ready.ts`
  - 当前唯一业务 Hook，实现轮询发布记录是否就绪的逻辑。
  - 使用 `useState` 管理 `inited` 状态，表示当前轮询流程生命周期是否至少完成过一次（包含成功或失败）。
  - 使用 `ahooks` 的 `useRequest` 包裹 `intelligenceApi.PublishIntelligenceList` 调用，封装状态与轮询：
    - 请求参数依赖于 `type`（`IntelligenceType`）、`intelligenceId`、`spaceId`。
    - 通过 `ready: enable` 控制是否启用请求；`enable` 允许外部完全关闭轮询。
    - `pollingInterval: 60 * 1000`，每 60 秒轮询一次，说明是较低频的健康检查，避免对服务造成压力。
    - `pollingErrorRetryCount: 3` 控制错误重试次数。
    - 返回值取首条智能体发布记录：`data.data?.intelligences?.[0]`。
    - 在 `onSuccess` 中，如果拿到目标记录，则调用 `res.cancel()` 立即终止后续轮询。
    - 在 `onFinally`（无论成功失败）中设置 `inited: true`，用于向上游标记「至少已尝试请求过」。
  - `useEffect` 依赖 `[type, intelligenceId, spaceId, enable]`：
    - 依赖变更时会重置 `inited` 为 `false` 并重新触发 `res.run()`；
    - `return res.cancel` 用于组件卸载/依赖切换时清理轮询。
  - Hook 返回结构：
    - `inited: boolean`：当前查询流程是否结束过至少一次；UI 层可用来控制 loading skeleton / 空状态展示。
    - `ready: boolean`：是否存在可用发布记录，供上层控制「发布记录就绪后才能执行的操作」。
- `src/hooks/index.ts`（存在但内容较少）
  - 作为 hooks 分组导出文件，应统一从这里 re-export 各业务 Hook，然后再由 `src/index.ts` 二次导出。
- `src/typings.d.ts`
  - 放置本包内部使用的全局/补充类型声明（如必要）；目前内容较少，如新增全局类型建议优先考虑局部类型或导出类型。

## 依赖与关键外部接口

- `react` / `react-dom`
  - 作为 `peerDependencies` 声明：`>=18.2.0`，本包在宿主应用中复用宿主 React 实例。
  - 开发/测试阶段同时在 `devDependencies` 中锁定版本，保证本地类型一致性。
- `ahooks`
  - 版本 `^3.7.8`。
  - 本包主要使用 `useRequest` 处理异步请求 + 轮询：重要配置包括 `manual`, `ready`, `pollingInterval`, `pollingErrorRetryCount`, `onSuccess`, `onFinally`。
  - 新增 Hooks 时如需请求能力，优先复用 `useRequest`，并遵守当前风格（`manual: true` + 外部驱动 `run()` + `ready` 控制生效）。
- `@coze-arch/bot-api`
  - 工作区依赖（`workspace:*`），封装了与后端智能体服务的通信。
  - 这里主要使用两个导出：
    - `intelligenceApi.PublishIntelligenceList`：查询智能体发布记录列表。
    - `IntelligenceType`：智能体类型枚举，用于请求参数约束。
  - 调用时通过请求 options `{ __disableErrorToast: true }` 显式关闭全局错误气泡，表明当前查询应在 UI 侧更静默地处理错误（配合 `inited` 状态，由上层决定是否显示错误信息）。

## 构建、测试与校验流程

- 包级 `package.json` 脚本
  - `build: "exit 0"`
    - 当前构建脚本为占位实现，本包暂不产出独立 bundle，多用于被应用直接按源码打包。
    - 若未来需要独立构建/发布，需接入工作区统一构建配置（如 `@coze-arch/rsbuild-config`），但本说明只记录现状，不做规划。
  - `lint: "eslint ./ --cache"`
    - 使用工作区共享 eslint 配置（`@coze-arch/eslint-config`），对整个包代码进行校验。
  - `test: "vitest --run --passWithNoTests"`
    - 通过 `@coze-arch/vitest-config` 共享配置（在 `vitest.config.ts` 中继承），运行单元测试。
    - `--passWithNoTests` 允许在无测试文件时通过；建议新增 Hook 时补充测试，而不是依赖此选项。
  - `test:cov: "npm run test -- --coverage"`
    - 在 CI 场景下用于生成覆盖率报告；`config/rush-project.json` 中配置了 `operationSettings`，将 `test:cov` 的输出目录 `coverage` 注册给 Rush。
- Rush 配置：`config/rush-project.json`
  - `operationSettings` 数组：
    - `operationName: "test:cov"` → `outputFolderNames: ["coverage"]`
    - `operationName: "ts-check"` → `outputFolderNames: ["./lib-ts"]`
  - 表明 Rush pipeline 中，这些操作的产物会被识别和缓存，新增类型检查/构建脚本时应对齐这套机制。
- TypeScript 配置
  - `tsconfig.json` / `tsconfig.build.json` / `tsconfig.misc.json`
    - 通过 `@coze-arch/ts-config` 共享基础配置；通常：
      - `tsconfig.json` 用于 IDE 开发体验与通用类型检查。
      - `tsconfig.build.json` 用于正式构建（即使当前构建脚本是占位，仍保留配置以便后续接入）。
      - `tsconfig.misc.json` 用于额外工具（如脚本、测试）使用的非标准编译设置。
- Lint / Stylelint
  - `eslint.config.js` 继承 `@coze-arch/eslint-config`，适用于 React + TS 项。
  - `.stylelintrc.js` 继承 `@coze-arch/stylelint-config`，当前包没有样式输出，仅为统一模板配置；如新增样式文件需遵循该配置。
- 测试约定
  - 测试目录为 `__tests__/`，当前仅有 `.gitkeep`（占位）；新增测试文件时存放于此目录或与源码同级，遵循 vitest 默认约定（如 `*.test.ts`）。
  - 若 Hook 较为复杂（例如包含多轮询状态、异常场景），建议：
    - 使用 `@testing-library/react-hooks`/`@testing-library/react` 做行为级测试，而不是仅测试内部实现细节。
    - 在测试中模拟 `intelligenceApi` 请求，而非直接触发真正网络调用。

## 开发约定与模式

- 导出策略
  - 新增 Hooks 一律在 `src/hooks/xxx.ts` 中实现，并在 `src/hooks/index.ts` 中导出，再由 `src/index.ts` 汇总导出；禁止在上层应用中从内部路径（如 `src/hooks/use-xxx`）进行深层导入，以保持包内部结构可演进性。
- 命名与文件组织
  - Hook 命名遵循 React 约定，以 `use` 前缀（如：`useIsPublishRecordReady`）。
  - 文件名采用 kebab-case（如 `use-is-publish-record-ready.ts`），导出名使用 UpperCamelCase/驼峰形式（`useIsPublishRecordReady`）。
- 状态返回模式
  - 当前 Hook 返回简单对象 `{ inited, ready }`：
    - `inited` 用于上层判断是否可以停止 loading 并展示结果/错误。
    - `ready` 用于上层判断是否可以执行后续依赖发布记录的操作。
  - 新增同类 Hook 时，建议：
    - 避免把请求原始数据直接透出到过多上层；优先返回聚合/抽象后的状态字段。
    - 如需返回更多信息（如错误原因、loading 状态等），优先采用结构化对象，避免多个独立返回值。
- 请求行为
  - 使用 `useRequest` + `manual: true` 的模式：
    - 在 `useEffect` 中调用 `run()` 以显式开始请求流程。
    - 通过 hook 参数中的 `enable` 布尔值控制是否真正触发请求。
  - 错误处理策略：
    - 请求调用时增加 `__disableErrorToast: true`，避免统一错误弹窗打断用户，留给上层 UI 决定如何反馈。
    - `onFinally` 中更新 `inited`，上层可以据此展示「静默失败」或重试入口。
- 轮询策略
  - 当前轮询间隔固定为 60 秒，`pollingErrorRetryCount` 为 3 次，这两个数值在上层没有暴露给调用者。
  - 若未来有新增 Hook 也需要轮询，建议抽取公共配置/常量，以避免各处魔法数字难以统一调整。

## 与其他模块的集成方式

- 与 `@coze-arch/bot-api` 的集成
  - 所有后端相关能力都通过该包调用，避免在本包直接拼接 URL 或使用独立的 HTTP 客户端。
  - 若需要新增与发布管理相关的 API 调用，应先在 `@coze-arch/bot-api` 中补充并导出，再在本包中引用，保持 API 调用统一管理。
- 与上层应用（如 `frontend/apps/coze-studio`）集成
  - 本包不直接依赖具体 UI 组件，只暴露 Hook；使用方在应用层按需组合：
    - 从 `@coze-studio/publish-manage-hooks` 导入 Hook。
    - 将 `type`、`intelligenceId`、`spaceId`、`enable` 等参数从路由/状态中透传。
    - 根据 `inited`/`ready` 控制按钮禁用、loading、流程阻塞等。

## 项目流程与协作规范（局部视角）

- 版本与发布
  - 当前 `version` 为 `0.0.1`，依赖 Rush 统一管理版本与发布；任何变更会通过 Rush 的版本策略在 monorepo 维度进行管理。
  - 本包尚未暴露复杂的 API 面；新增导出或破坏性修改前需考虑下游引用情况（特别是 `@coze-studio/app` 等）。
- 分支与提交
  - 整体仓库遵循统一 Git 流程（在根级文档/团队约定中定义）；本子包没有单独的分支策略。
  - 代码变更需要通过 Rush pipeline（包括 lint、test、ts-check 等）验证后再合入。
- Storybook / 组件展示
  - 目录下包含 `.storybook` 配置，但当前包主定位为 Hooks，而非 UI 组件；该配置主要继承自模板。
  - 若未来增加与发布管理相关的可视化组件，可复用这些 Storybook 配置，但目前说明不对此做假设。

## 特殊/不寻常特性

- 构建脚本为 no-op
  - `build` 脚本直接 `exit 0`，意味着：
    - CI 中不会从本包产物读取构建结果，而是由应用层构建流程直接消费本包源码。
    - 如需生成可发布 bundle（如 ESM/UMD），需要未来显式接入构建工具，本说明只标记这一现状以提醒 AI 助手不要误以为存在打包产物。
- 错误提示静默化
  - 所有请求都加上 `__disableErrorToast: true` 选项，这在全仓中并非通用策略，而是针对本功能点的特殊选择。
  - AI 助手在扩展本包时，如新增 API 调用，应思考是否也需要静默处理错误，并保持风格一致。
- 轮询行为在 Hook 内部自管理
  - 轮询启动/终止逻辑完全封装在 Hook 内部（`useEffect` + `ready` + `cancel`），调用方只需提供参数，不需要控制轮询细节。
  - 在为新 Hook 复制模式时，要注意 `useEffect` 依赖是否完整，避免漏掉参数导致旧轮询未停止或新条件未触发。

## 面向 AI 助手的具体建议

- 修改/扩展现有 Hook 时：
  - 保持返回对象结构的兼容性，避免对外部调用方造成破坏性变更（如重命名字段、改变布尔语义）。
  - 尽量通过增加字段而非修改现有字段含义来扩展能力。
- 新增 Hooks 时：
  - 遵循当前文件组织和导出策略（`src/hooks` + 统一出口）。
  - 优先通过 `@coze-arch/bot-api` 访问后端能力，而非引入新 HTTP 客户端。
  - 如果需要轮询或复杂异步逻辑，优先使用 `useRequest`，并借鉴 `useIsPublishRecordReady` 的配置格式与错误处理策略。
- 进行跨包修改（例如同时改动 `@coze-arch/bot-api` 与本包）时：
  - 先在 API 包中新增/修改接口定义，再回到本包适配调用，最后在上层应用中做集成改动；避免在单一子包内引入临时/硬编码方案。