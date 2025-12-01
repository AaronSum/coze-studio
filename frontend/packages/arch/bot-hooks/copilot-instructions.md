# bot-hooks 子包开发指南（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/bot-hooks）中安全、高效地协作开发。

## 全局架构与职责边界
- 子包定位：提供跨页面、跨场景可复用的 React hooks 能力，当前核心聚焦“页面跳转与场景状态管理（page-jump）”，并统一 re-export 其它基础 hooks。
- 对外 API 汇总入口：[src/index.ts](src/index.ts)
  - 直接 re-export 自 [@coze-arch/bot-hooks-adapter] 和 [@coze-arch/bot-hooks-base] 的通用 hooks（如 `useRouteConfig`、`usePageState`、`useDragAndPasteUpload` 等），本包不改写其行为，只做转发。
  - 定义并导出本包自有的页面跳转能力：`usePageJumpService`、`usePageJumpResponse`，以及与之配套的枚举与类型：`SceneType`、`PageType`、`WorkflowModalState`、`OpenModeType`、`SceneResponseType`。
- page-jump 模块结构：[src/page-jump](src/page-jump)
  - [config.ts](src/page-jump/config.ts)：仅存放“配置 + 类型系统”与 URL 组装逻辑，包括：
    - 场景枚举 `SceneType` 与页面枚举 `PageType`，定义“从 A 页面到 B 页面”的业务场景（场景名强约定：`{SOURCE}__{ACTION}__{TARGET}`）。
    - 页面与场景的绑定 `PAGE_SCENE_MAP`，用来做反向映射和类型收窄。
    - 每个场景对应的参数类型 `SceneParamTypeMap<T>`，控制路由 state 的 shape。
    - 每个场景的响应映射 `SCENE_RESPONSE_MAP`，把 route 参数解析成 URL 与业务响应字段，保证包含 `url` 字段。
  - [index.ts](src/page-jump/index.ts)：对外暴露两个核心 hooks：
    - `usePageJumpService`：封装 `react-router-dom` 的 `useNavigate`，根据 `SceneType` 和参数自动选择 `navigate` 或 `window.open`，并写入路由 `state`（附带 `scene`）。
    - `usePageJumpResponse`：在目标页读取 `location.state`，结合 `PAGE_SCENE_MAP` 校验 `scene` 是否属于当前 `PageType`，再根据 `SCENE_RESPONSE_MAP` 计算响应值，返回带有 `scene` 与 `clearScene` 的结果。
- 数据流说明：
  - 源页面调用 `usePageJumpService().jump(sceneType, params)`：
    1. 由 `SCENE_RESPONSE_MAP[sceneType]` 生成 URL 与响应辅助信息。
    2. 如果参数中存在 `newWindow`，则 `window.open(url, '_blank')`；否则使用 `navigate(url, { state: { ...param, scene: sceneType } })`。
  - 目标页面调用 `usePageJumpResponse(PageType.XXX)`：
    1. 从 `useLocation()` 读取 `state`，检查是否携带合法 `scene`，并校验是否在 `PAGE_SCENE_MAP[pageType]` 中。
    2. 通过 `SCENE_RESPONSE_MAP[scene]` 生成响应对象，并追加 `scene` 和 `clearScene`。
    3. 业务侧再通过判定 `scene` 来做类型收窄（discriminated union）。

## 关键开发与运行流程
- 包管理与初始化：
  - 整体仓库使用 Rush 管理；首次或依赖变更后需在仓库根目录执行 `rush update`。
- 构建与打包：
  - 本包当前 `package.json` 中 `build` 为 `exit 0`，说明实际构建由上层统一工具链负责（如统一打包脚本或 rsbuild 配置），在本子包内部无需单独执行构建逻辑。
- 测试：
  - 测试工具：Vitest，配置文件为 [vitest.config.ts](vitest.config.ts)，通过 `@coze-arch/vitest-config` 统一封装：
    - `preset: 'web'`，`test.setupFiles: ['./setup']`，`includeSource: ['./src']`。
    - 覆盖率统计：默认 `all: true`，包含 `src` 下全部文件，排除 `src/index.ts`、`src/global.d.ts` 和 `src/page-jump/config.ts`。
  - 常用命令（在本子包目录）：
    - `npm test`：执行 `vitest --run --passWithNoTests`。
    - `npm run test:cov`：执行带覆盖率的测试。
- Lint 与格式：
  - ESLint 配置位于 [eslint.config.js](eslint.config.js)，使用内部共享配置 `@coze-arch/eslint-config`，注意：
    - 存在较严格的规则（如 `@typescript-eslint/naming-convention`、`max-len` 等），在局部需要用 eslint-disable 注释时，保持现有注释格式。
  - Stylelint 配置在根目录 [.stylelintrc.js](.stylelintrc.js)，但当前子包几乎不涉及样式文件。

## 项目约定与常见模式
- hooks 聚合与封装约定：
  - `src/index.ts` 作为“单一对外出口”，既转发其它子包的 hooks，也导出本子包的 page-jump hooks 与相关类型。
  - 新增本包自有 hooks 时，应在对应子目录实现后，再从 `src/index.ts` 统一导出，保证消费方始终从 `@coze-arch/bot-hooks` 入口引入。
- 场景枚举与命名规范（page-jump）：
  - 所有场景必须在 `SceneType` 中声明，采用英文驼峰 value、全大写 + 双下划线的 key，例如：
    - `BOT__VIEW__WORKFLOW = 'botViewWorkflow'`
    - `BOT_LIST__VIEW_PUBLISH_RESULT_IN__BOT_DETAIL = 'botListViewPublishResultInBotDetail'`
  - 语义规则：
    - `{SOURCE}__TO__{TARGET}`：简单的“从某页到某页”的跳转。
    - `{SOURCE}__{ACTION}__{TARGET}`：细化行为（例如 `VIEW`、`BACK`、`PUBLISHED`）。
    - 可通过追加后缀 `__BACK`、`__PUBLISHED` 等区分“跳转并回退”场景。
- PageType 与 PAGE_SCENE_MAP 约束链：
  - 新增场景时，必须：
    1. 在 `PageType` 中声明新页面（如有新页面）。
    2. 在 `PAGE_SCENE_MAP` 中把新场景挂到对应 `PageType` 上，`satisfies Record<PageType, SceneType[]>` 用来在编译期保证所有页面均有场景数组。
    3. 在 `SceneParamTypeMap` 中给新场景定义入参类型。
    4. 在 `SCENE_RESPONSE_MAP` 中实现新的响应函数（返回值必须含 `url: string`），否则 `SceneResponseConstraint` 会在 TS 编译时报错。
- 参数与响应的分离：
  - `SceneParamTypeMap<T>` 代表“源页面写入路由 state 的数据结构”，可以包含复杂的业务字段。
  - `SCENE_RESPONSE_MAP` 返回“目标页面消费的数据结构”，通常会：
    - 把部分参数整合为 URL query（如 `workflow_id`、`bot_id`）。
    - 保留必要的业务字段（如 `workflowModalState`、`pluginID` 等）。
  - 业务页面只依赖 `SceneResponseType`（通过 `usePageJumpResponse` 获得），不直接依赖 `SceneParamTypeMap`，便于后续对 param 形态做非破坏式调整。
- 类型收窄与 discriminated union：
  - `SceneResponseType<T extends SceneType>` 利用分布式条件类型，为每个 `SceneType` 推导出不同的返回 shape，并统一追加 `scene` 与 `clearScene`。
  - 业务代码应通过判断 `routeResponse.scene === SceneType.XXX` 来做类型收窄，而不是对字段做“鸭子类型”判断。
- 跳转清理行为：
  - `usePageJumpResponse` 返回的 `clearScene(forceRerender?: boolean)` 负责清理当前页面所有与场景关联的路由状态：
    - 默认分支：使用 `history.replaceState({}, '')`，不触发重新渲染；`useLocation` 在一次渲染中仍能拿到旧值。
    - `forceRerender = true`：通过 `navigate(location.pathname, { replace: true })` 触发一次替换导航，使得 `useLocation` 中的 state 被清空，并重新渲染组件。

## 外部依赖与集成细节
- React Router 集成：
  - 本包通过 `useNavigate` / `useLocation` 实现路由跳转与状态读取，要求在使用方组件树外层已配置好 `react-router-dom` Router。
  - 所有场景参数通过 `navigate(url, { state })` 写入 `location.state`，不使用 query-string 解析库。
- 业务 API 类型依赖：
  - [src/page-jump/config.ts](src/page-jump/config.ts) 引入 `WorkflowMode` 与 `WorkFlowListStatus` 自 [@coze-arch/bot-api/workflow_api]，只在类型层面使用，用于增强 workflow 相关场景的参数与响应约束。
- 全局类型与 window 扩展：
  - [src/global.d.ts](src/global.d.ts) 通过三斜线引用 [@coze-arch/bot-typings] 并扩展全局：
    - 声明 `ENABLE_COVERAGE: boolean`，用于测试环境是否开启覆盖率统计。
    - 扩展 `window.Tea` 字段（类型为 `any`），用于埋点或监控 SDK，调用时不做类型约束。

## 开发流程与协作规范
- 代码风格：
  - TypeScript 版本统一由仓库根部的 Rush/ts-config 管理，不在本包内自行覆盖。
  - 避免在类型层使用 `any`，仅在 TS 推断极难或与外部库兼容时，使用带明确 eslint 注释的 `as any` 形式，参考 [src/page-jump/index.ts](src/page-jump/index.ts) 中对 `SCENE_RESPONSE_MAP` 的调用。
- hooks 扩展流程（以新增一个页面跳转场景为例）：
  1. 在 [src/page-jump/config.ts](src/page-jump/config.ts) 中新增 `SceneType` 枚举值，并根据需要扩展 `PageType`。
  2. 将新场景挂入 `PAGE_SCENE_MAP` 中对应页面数组内。
  3. 在 `SceneParamTypeMap` 中为新场景增加一条映射，定义 route state 结构。
  4. 在 `SCENE_RESPONSE_MAP` 中为新场景实现响应函数，返回 `url` 与其它业务字段。
  5. 在目标页面代码中，通过 `usePageJumpResponse(PageType.XXX)` 获取 `routeResponse`，并使用 `routeResponse.scene` 做类型收窄。
  6. 如需要在外部重复使用相关类型，考虑在 [src/index.ts](src/index.ts) 中 re-export 对应枚举/类型。

## 项目流程与其他约定
- 版本与依赖：
  - 所有 `@coze-arch/*` 与 `@coze-studio/*` 依赖均通过 `workspace:*` 管理，不要在本包单独锁死版本。
  - 测试、lint、tsconfig 等基础设施，优先沿用上游共享配置（如 `@coze-arch/vitest-config`、`@coze-arch/ts-config`），仅在确有需要时在本包内微调。
- 分支与发布：
  - 本文件不记录仓库级分支策略与发布流程，AI 助手在涉及版本号或发布脚本变更时，应优先查阅仓库根目录的 README、CONTRIBUTING 及 Rush 相关配置。

## 特殊注意事项
- 请不要直接修改 `build` 脚本逻辑（目前为 `exit 0`），真实构建流程由仓库顶层统一控制，修改前应查阅根目录构建脚本与文档。
- 在 `page-jump` 模块中新增或修改场景时，务必让 TypeScript 类型检查通过：
  - 若 `SceneType` 增加但 `SceneParamTypeMap` 或 `SCENE_RESPONSE_MAP` 未同步更新，会触发编译错误；不要通过 `as any` 粗暴规避，而应补全配置。
- 新增全局类型时，统一放在 [src/global.d.ts](src/global.d.ts)，并保持只做类型声明，不写任何可执行代码。
