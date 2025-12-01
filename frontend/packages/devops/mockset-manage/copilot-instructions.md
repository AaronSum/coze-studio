# @coze-devops/mockset-manage / copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/devops/mockset-manage）中安全、高效地协作开发。

## 1. 全局架构与职责边界
- 子包定位：本包是 DevOps 调试体系中的「插件 Mock 集合（MockSet）管理」前端组件库，提供选择、创建、删除、配置插件 MockSet 的 UI 组件与业务逻辑，对外以 React 组件和工具函数形式暴露。
- 入口导出：核心公共 API 均由 [src/index.tsx](src/index.tsx) 统一导出，包括：
  - 常量 / 枚举：`MockTrafficEnabled`, `CONNECTOR_ID`（调试链路使用的固定 connector 标识）。
  - 组件：`MockSetSelect`, `MockSetDeleteModal`, `MockSetEditModal`, `AutoGenerateSelect`。
  - 工具函数：`getEnvironment`, `getUsedScene`。
  - 类型：`BindSubjectInfo`, `BizCtxInfo`。
- 业务核心流转：
  - 通过 `MockSetSelect` 组件在当前调试场景下获取并轮询绑定的 MockSet 列表（`useInitialGetEnabledMockSet` + `useMockInfoStore`）。
  - 用户在下拉框中切换 MockSet 时，调用 `debuggerApi.BindMockSet` 绑定 / 解绑，并触发埋点上报和重新轮询。
  - 用户创建 / 编辑 MockSet 时，通过 `MockSetEditModal` 调用 `debuggerApi.SaveMockSet`，可选地配置「自动生成 Mock 数据」方式（`AutoGenerateSelect`），在保存成功后跳转到 Mock 数据配置页面。
  - 用户删除 MockSet 时，通过 `MockSetDeleteModal` 先查询引用计数 `debuggerApi.GetMockSetUsageInfo` 再删除 `debuggerApi.DeleteMockSet`，过程有完整埋点与错误上报。
- 状态管理：
  - 使用 `zustand` + `immer` 在 [src/hooks/store.ts](src/hooks/store.ts) 中维护调试场景内「已启用的 MockSet 信息」「当前轮询状态」「组件实例数量」等；
  - 通过 `addMockComp` / `removeMockComp` 统计当前视口内使用 MockSet 功能的组件数量，当计数为 0 时停止轮询，避免无效轮询请求。
- 场景与上下文：
  - 所有与 RPC 交互均依赖 `BizCtx` / `BizCtxInfo`、`ComponentSubject`（组件 / 插件标识），封装在 [src/interface.ts](src/interface.ts) 与 [src/utils/index.ts](src/utils/index.ts) 中；
  - `TrafficScene` 用于区分「单 Bot 调试 / 多 Agent 调试 / Workflow 调试 / Tool 调试」，`getUsedScene` 会把内部场景映射为埋点字段（`bot` / `agent` / `flow`）。

## 2. 构建、测试与本地开发
- 包管理与 workspace：本项目使用 Rush + PNPM（或 NPM）workspace 管理，当前子包的 Rush 配置在 [config/rush-project.json](config/rush-project.json)。新增依赖时，应通过 workspace 统一管理，不要在本包单独安装全局依赖。
- 构建：本包 `package.json` 中的 `build` 目前为占位实现（`exit 0`），真实产物构建通常由上层工程统一驱动；
  - 在本包内 **不要随意改动 `build` 脚本为复杂逻辑**，如需新增打包逻辑请参考上层 frontend 工程的统一规范。
- 测试：
  - 测试框架使用 Vitest，配置在 [vitest.config.ts](vitest.config.ts)，由 `@coze-arch/vitest-config` 统一封装；
  - 运行全部测试：在仓库根目录执行 `rush test --to @coze-devops/mockset-manage`（推荐）或在本包目录执行 `npm test`；
  - 覆盖率：在本包目录执行 `npm run test:cov`。
- Lint：
  - ESLint 配置在 [eslint.config.js](eslint.config.js)，继承 `@coze-arch/eslint-config`，并启用一些内部规则，如 `@coze-arch/max-line-per-function`、`@coze-arch/no-pkg-dir-import` 等；
  - 运行：在本包目录执行 `npm run lint`，或在仓库根目录使用 Rush 的 lint 组合命令（参考顶层 frontend 文档）。
- 样式与 UI：
  - 本包主要依赖 `@coze-arch/bot-semi` 组件库和 `@douyinfe/semi-ui` 样式系统，局部样式使用 Less 模块（如 [src/components/mock-select/index.module.less](src/components/mock-select/index.module.less)）。
  - 修改样式时优先复用已有设计 token / 类名，避免硬编码颜色；对业务不可见的样式调整可宽松一些，但需保持与周边组件视觉一致性。

## 3. 代码组织与项目特有模式
- 目录结构（子包内）：
  - [src/const.ts](src/const.ts)：与 MockSet 业务相关的常量与校验规则（如 `REAL_DATA_ID`、`MOCK_OPTION_LIST`、`mockSetInfoRules`、`MockTrafficEnabled` 等），**新增常量时优先集中到此文件**；
  - [src/interface.ts](src/interface.ts)：组件对外暴露与内部复用的 TypeScript 接口与枚举（`BizCtxInfo`, `BindSubjectInfo`, `BasicMockSetInfo`, `MockSetStatus` 等），**新增公共类型请放在此处**；
  - [src/hooks/](src/hooks)：与 MockSet 拉取 / 轮询相关的状态与自定义 hook：
    - [src/hooks/store.ts](src/hooks/store.ts)：`useMockInfoStore`，持久化当前 BizCtx、已启用 MockSet 信息和轮询状态；
    - [src/hooks/use-get-mockset.ts](src/hooks/use-get-mockset.ts)：`useInitialGetEnabledMockSet`，负责 `MGetMockSetBinding` 轮询、取消、重启逻辑。
  - [src/utils/index.ts](src/utils/index.ts)：
    - MockSet 辅助工具：`isRealData`, `isCurrent`, `isSameWorkflowTool`, `isSameScene`, `getPluginInfo`, `getMockSubjectInfo`；
    - 环境与场景工具：`getEnvironment`, `getUsedScene`，直接被对外导出供其他子包使用；
  - [src/utils/auto-generate-storage.ts](src/utils/auto-generate-storage.ts)：管理「自动生成 Mock 数据方式」的本地缓存（`localStorage`），始终通过 `getLatestAutoGenerationChoice` / `setLatestAutoGenerationChoice` 访问，不要在其他文件重复使用相同 key。
  - [src/components/](src/components)：UI 组件与业务交互层：
    - `mock-select/`: MockSet 下拉选择与渲染；
    - `mockset-edit-modal/`: 创建 / 编辑模态框，处理表单校验与保存逻辑；
    - `mockset-delete-modal/`: 删除确认对话框，包含引用数查询与删除埋点；
    - `auto-generate-select/`: 自动生成方式选择器，封装本地偏好读取逻辑。
- 全局变量与环境开关：
  - `IS_OVERSEA`, `IS_PROD`, `IS_RELEASE_VERSION` 等为上层打包注入的全局常量（见 `const.ts`, `utils/index.ts`），**不要在本包内重新声明或手动赋值**，统一由构建系统负责；
  - 很多行为在「海外 / 国内」「生产 / 非生产」下有差异（如校验规则、环境字符串），新增逻辑时应保持一致的分支策略。
- 埋点与日志：
  - 埋点统一通过 `@coze-arch/bot-tea` 的 `sendTeaEvent` 上报，事件名使用 `EVENT_NAMES` 枚举：如 `create_mockset_front`, `use_mockset_front`, `del_mockset_front` 等；
  - 日志统一使用 `@coze-arch/logger` 的 `logger.info` / `logger.error`，携带 `eventName` 字段，方便后端检索；
  - 新增网络请求 / 关键用户操作时，应对齐现有模式：**失败打埋点 + logger + 适当 UIToast 提示**。
- API 调用约定：
  - 所有 RPC API 通过 `@coze-arch/bot-api/debugger_api` 暴露，为强类型客户端；新增能力时优先扩展该模块，而不是在本包内写裸 `axios`；
  - `debuggerApi` 请求通常需要传入完整 `bizCtx` 与 `mockSubject` / `mockSubjectInfo`，请使用 `getPluginInfo` / `getMockSubjectInfo` 等工具确保字段一致。

## 4. 关键组件与外部依赖集成
- MockSetSelect（[src/components/mock-select/index.tsx](src/components/mock-select/index.tsx)）
  - 对外 props：`MockSetSelectProps`（见 [src/interface.ts](src/interface.ts)），接受 `bindSubjectInfo`（组件主体信息）与 `bizCtx`（业务上下文），可选 `readonly`、`className`、`style`；
  - 内部行为：
    - 使用 `useInfiniteScroll` + `debuggerApi.MGetMockSet` 获取 MockSet 列表，拼接常量 `MOCK_OPTION_LIST`（始终包含「真实数据」选项）。
    - 使用 `useInitialGetEnabledMockSet` 轮询当前 BizCtx 下的绑定信息，并根据 `isCurrent` 判断是否为当前组件，自动同步选中项。
    - `onChange` 时调用 `debuggerApi.BindMockSet`，并通过 `sendTeaEvent(EVENT_NAMES.use_mockset_front, …)` 上报；
    - 创建入口落在下拉的 `outerBottomSlot`，点击后打开 `MockSetEditModal`，成功后跳转插件 Mock 数据页面（`usePageJumpService` + `SceneType.*`）。
  - 外部可通过 `ref` 获取 `MockSetSelectActions`，目前仅暴露 `handleParentNodeDelete`，用于在父节点被删除时解绑当前 MockSet。
- MockSetEditModal（[src/components/mockset-edit-modal/index.tsx](src/components/mockset-edit-modal/index.tsx)）
  - 支持创建与编辑：通过 `initialInfo.id` 是否存在判断，创建时默认生成随机名称 `getRandomName`；
  - 表单校验依赖 `mockSetInfoRules`（`const.ts`），其中名称校验根据 `IS_OVERSEA` 区分中英字符支持；
  - `onSubmit` 调用 `debuggerApi.SaveMockSet`，处理重复名称错误码 `MOCK_SET_ERR_CODE.REPEAT_NAME`，并进行埋点 `EVENT_NAMES.create_mockset_front`；
  - 当开启 `FLAGS['bot.devops.mockset_auto_generate']` 且为创建模式时，显示 `AutoGenerateSelect`，将生成配置写入隐藏字段 `generateMode` / `generateCount`，并回调给调用方。
- MockSetDeleteModal（[src/components/mockset-delete-modal/index.tsx](src/components/mockset-delete-modal/index.tsx)）
  - 打开时先调用 `debuggerApi.GetMockSetUsageInfo` 查询 `usersUsageCount`，根据引用人数动态更新标题文案；
  - 删除时调用 `debuggerApi.DeleteMockSet`，并通过 `sendTeaEvent(EVENT_NAMES.del_mockset_front, …)` 上报。
- AutoGenerateSelect（[src/components/auto-generate-select/index.tsx](src/components/auto-generate-select/index.tsx)）
  - 负责选择「自动生成 Mock 数据方式」：`PluginMockDataGenerateMode.RANDOM` / `LLM`，可选多条生成数量 `generateCount`；
  - 通过 `getLatestAutoGenerationChoice` / `setLatestAutoGenerationChoice` 与本地缓存联动，保证用户在不同位置打开时默认选中上一次选择的方式。
- 环境 / 场景工具（[src/utils/index.ts](src/utils/index.ts)）
  - `getEnvironment`：根据 `IS_PROD`、`IS_OVERSEA`, `IS_RELEASE_VERSION` 拼装成形如 `cn-boe` / `oversea-release` 字符串，主要用于埋点 environment 字段；
  - `getUsedScene`：将 `TrafficScene` 枚举映射为 `bot` / `agent` / `flow`，供埋点参数使用；
  - 这些工具已经在包入口导出，可被其他子包复用，新增场景映射时需保证兼容旧值。

## 5. 协作流程与开发规范
- 分支与提交：
  - 仓库整体遵循 Coze 统一 Git 流程（具体见根目录文档），在本子包开发时遵循常规 feature/bugfix 分支命名；
  - 提交信息建议体现子包名与域：如 `feat(mockset-manage): support llm auto generate`。
- 类型与导出：
  - 对外能力一律从 [src/index.tsx](src/index.tsx) 进行显式导出，避免从 `src/components/*` 直接被其他包依赖；
  - 共用类型统一集中在 [src/interface.ts](src/interface.ts)，避免在多个组件中重复定义类似接口。
- 国际化与文案：
  - 所有可见文案统一通过 `I18n.t` 获取，对应 key 由上层 i18n 资源管理；
  - **禁止在组件中写死中文 / 英文字符串**（除调试日志 / 不展示给用户的常量外）。
- 错误处理：
  - 网络请求失败时：写日志（`logger.error`）、必要时埋点、适度 UIToast 提示（给用户可感知反馈）；
  - 不要吞掉错误，只记录日志却完全不反馈；对于可重试场景优先确保 UI 不会卡死（例如在 mockset 列表加载失败时保留已有选项而不是清空）。

## 6. 不寻常 / 需要特别注意的点
- 轮询任务共用：
  - `useInitialGetEnabledMockSet` + `useMockInfoStore` 实现了一套「按 BizCtx + 组件实例数量共享轮询任务」机制：同一场景下多个 `MockSetSelect` 组件会共享一次轮询；
  - 修改该逻辑时务必保证：**组件卸载后轮询能正确取消，且不会导致已存在组件丢失数据**。
- 真实数据占位项：
  - `REAL_DATA_MOCKSET` / `REAL_DATA_ID` 代表「不使用 Mock，直接走真实数据」；很多判断逻辑会依赖 `isRealData`，新增功能时不要误把它当成普通 MockSet 处理。
- 全局标志位：
  - `FLAGS['bot.devops.mockset_auto_generate']` 控制自动生成能力是否展示；代码中已经按「社区版本暂不开放」设计，扩展时需谨慎，保证关闭 flag 时 UI 与逻辑完全屏蔽该能力。
- 浏览器特有能力：
  - `auto-generate-storage.ts` 直接使用 `localStorage`（异步包了一层但本质仍是浏览器 API），在 SSR 或非浏览器环境下需要由上层确保不会被执行；在本子包内不做环境适配。

> 提示：在新增能力前，建议先阅读本文件提到的关键文件，并沿用现有模式（埋点、日志、状态管理、环境开关），这样可以让不同子包间行为保持一致，也更方便后续排查问题。