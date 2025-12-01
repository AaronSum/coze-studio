# @coze-agent-ide/bot-plugin-mock-set 协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/bot-plugin/mock-set）中安全、高效地协作开发。

## 1. 子包定位与角色
- 本包名称：`@coze-agent-ide/bot-plugin-mock-set`，位于 `frontend/packages/agent-ide/bot-plugin/mock-set`。
- 主要职责：为 Agent IDE 中的「插件 Mock 集」能力提供 React 组件、业务 Hook 与工具函数，用于在 Bot/Workflow/Tool 调试场景下配置与管理插件 Mock 数据集。
- 输出形式：通过 `package.json.exports` 暴露多个入口（hook、组件、工具），其他子包通过包名 + 子路径导入使用，而不是直接引用源码路径。

## 2. 全局架构与模块划分
- 包结构概览：
  - `src/index.tsx`：包出口占位（当前未导出具体组件，真实对外接口以 `exports` 字段为准）。
  - `src/component/`：UI 组件与页面片段，例如 Mock 集列表、面包屑、介绍文案、选择器等；负责展示和交互，不直接承载复杂业务逻辑。
  - `src/hook/`：业务 Hook，例如 `use-mock-set-in-setting-modal.ts`、`use-trans-schema.ts`，封装 Mock 集启用、绑定、删除、跳转等复杂流程以及 Schema → Mock 数据的转换逻辑。
  - `src/util/`：纯函数工具层，如 `index.ts`（场景判定、真实数据判断）、`utils.ts`（JSON 解析与数据合并等）；避免在组件 / Hook 中编写难以复用的逻辑。
  - `__tests__/`：Vitest 单测目录，按 `hook/`、`util/` 等子目录组织，用于验证 Hook 与工具函数行为。
- 与外部子包的协作边界：
  - 通过 `@coze-arch/bot-api`、`@coze-arch/bot-hooks`、`@coze-arch/bot-tea` 等获取调试接口、路由跳转服务、埋点能力；本包不直接处理底层网络与路由，只包装为更高层的业务操作。
  - 通过 `@coze-studio/mockset-shared` 共享 Mock 集领域模型（`MockSet`、`MockDataWithStatus` 等）、Schema 解析和 UI 组件协议，保证 Mock 能力在 IDE 中风格一致。
  - 通过 `@coze-studio/user-store`、`@coze-arch/bot-studio-store` 获取用户与空间信息，用于区分个人 / 团队空间，并拼装埋点字段。
- 结构设计动机：
  - 明确「领域逻辑（hook/util）」与「展示层（component）」的职责分隔，便于复用业务逻辑到不同容器（如设置弹窗、独立页面）。
  - 所有后端交互都集中在 Hook/Util 中，通过 `debuggerApi.*`、`mockset-shared` 统一与服务通信，减少组件内散落的 RPC 调用。

## 3. 关键业务流程与数据流

### 3.1 设置弹窗中的 Mock 集控制（useMockSetInSettingModalController）
- 实现位置：`src/hook/use-mock-set-in-setting-modal.ts`，是本包最核心的业务 Hook 之一。
- 输入参数：
  - `bindSubjectInfo`：当前绑定对象信息（来自 `@coze-studio/mockset-shared` 的 Mock 主题抽象）。
  - `bizCtx`：业务上下文（`BizCtx`），包含空间、流量场景、调用方 ID 等，来自 `@coze-arch/bot-api/debugger_api`。
  - `readonly`：是否只读模式（不允许修改绑定）。
- 关键依赖：
  - `debuggerApi.MGetMockSet`：分页拉取当前业务场景下可用的 Mock 集列表。
  - `debuggerApi.MGetMockSetBinding`：查询当前场景已绑定的 Mock 集，并可带上 `needMockSetDetail` 获得详细信息。
  - `debuggerApi.BindMockSet`：在当前 BizCtx + Subject 下绑定/解绑 Mock 集。
  - `debuggerApi.DeleteMockSet`：删除 Mock 集。
  - `@coze-arch/bot-tea`：通过 `sendTeaEvent` 上报埋点事件（如 `use_mockset_front`、`del_mockset_front`）。
  - `@coze-arch/bot-hooks` 的 `usePageJumpService`：在点击「查看/编辑」Mock 集时跳转至 Mock 数据页面。
- 内部状态与流程：
  - 使用 `useRequest` 管理所有异步请求，并将 `loading`、`data` 暴露给组件：
    - Mock 集列表：`mockSetData` + `isListLoading`。
    - 当前绑定 Mock 集信息：`enabledMockSetInfo` + `isSettingLoading`。
    - 删除被引用计数：`deleteUsingCountInfo`（用于渲染不同的删除文案 `deleteRenderTitle`）。
  - 通过 `getPluginInfo`、`getEnvironment`、`getMockSubjectInfo` 等工具组装 RPC 参数与埋点字段。
  - 切换启用状态 `isEnabled` 时：
    - 启用 → 绑定某个 Mock 集（默认从列表中匹配当前场景，参见 `isCurrent` / `getUsedScene`）。
    - 关闭 → 绑定伪 Mock 集 `REAL_DATA_MOCKSET`，代表「使用真实数据」。
  - 删除 Mock 集时：
    - 先根据 `deleteTargetId` 调用 `GetMockSetUsageInfo`，根据人数展示不同提示语；
    - 确认后调用 `DeleteMockSet` 并刷新列表，成功 / 失败分别打点。
  - 跳转查看详情 `doHandleView`：
    - 根据 `bizCtx.trafficScene` 区分跳转到 Workflow / Bot 调试场景下的 Mock 页面。
    - `jump(SceneType.XXX, {...payload})` 时，`bizCtx` 与 `bindSubjectInfo` 会被 `JSON.stringify` 注入路由参数，供目标页面还原上下文。

### 3.2 Mock 集匹配与场景判断（util/index.ts）
- 实现位置：`src/util/index.ts`。
- 主要函数：
  - `isRealData(mockSet)`：根据 `REAL_DATA_MOCKSET.id` 判断是否为真实数据占位 Mock 集。
  - `isCurrent(sItem, tItem)`：判断某个已绑定 Mock 集记录是否匹配当前组件上下文，
    - 同时比较 `bindSubjectInfo` 与 `bizCtx`（但忽略 `ext` 字段差异）。
    - 对 Workflow 调试场景，额外通过 `isSameWorkflowTool` 比较 `ext.mockSubjectInfo`（JSON 解析后深比较）。
  - `isSameScene(sBizCtx, tBizCtx)`：对比 `bizSpaceID`、`trafficScene`、`trafficCallerID` 确定是否属于同一业务场景。
  - `getUsedScene(scene)`：将具体的 `TrafficScene` 映射为埋点用字符串 `'bot' | 'agent' | 'flow'`。
- 使用约定：
  - Hook / 组件在需要判断「当前绑定是否属于我」时，都应使用 `isCurrent` 而不是手动比较字段，以保证场景兼容逻辑一致。

### 3.3 Schema → Mock 数据转换（useTransSchema）
- 实现位置：`src/hook/use-trans-schema.ts`。
- 关键职责：
  - 根据后端或 IDE 提供的 Tool Schema（字符串）生成带「可编辑状态」的 Mock 数据结构，并与当前已存在的 Mock 数据合并。
  - 提供格式化后的 JSON 文本，用于代码编辑器（如 Monaco）展示。
- 核心流程：
  - `useGetCachedSchemaData(schema)`：
    - 维护一个简单的内存缓存 `cache`，以 Schema 字符串为 key 避免重复解析。
    - 解析流程：`parseToolSchema(schema)` → `transSchema2DataWithStatus(ROOT_KEY, parsed)`。
  - 将解析结果与 `currentMock` 合并：
    - 调用 `getMergedDataWithStatus(result, currentMock)` 得到：
      - `merged`：完整的带状态数据结构。
      - `incompatible`：是否存在结构不兼容。
    - 再调用 `transDataWithStatus2Object(merged, currentMock !== undefined)` 转为普通对象。
    - 使用 `stringifyEditorContent` 得到格式化后的文本，供 UI 编辑器显示。
  - 特殊字段校验 `testValueValid(value)`：
    - 对于名为 `response_for_model` 且类型为字符串的字段，禁止为空字符串；
    - 通过 `safeJSONParse` 对待校验文本进行 JSON 解析，再检查字段内容。
- 返回值约定：
  - `result`：结构化数据（含状态）的原始树。
  - `mergedResult` / `mergedResultExample`：合并后的结构化结果与其对象表示。
  - `formattedResultExample`：编辑器使用的 JSON 文本。
  - `incompatible`：标记当前 Mock 数据是否与最新 Schema 不兼容。
  - `isInit`：根据 `currentMock` 是否为 `undefined` 标记是否为「首次初始化」。

## 4. 开发 & 调试工作流

### 4.1 安装与基础构建
- 本仓库使用 Rush + workspace 管理，进入顶层 `frontend` 后：
  - 安装依赖：`rush update`。
- 本子包 `package.json` 中脚本：
  - `build`: 当前设置为 `exit 0`，说明真实产物构建由上层构建系统（如统一打包脚本 / Rsbuild 配置）负责，本包只参与类型检查与测试。
  - `lint`: `eslint ./ --cache`，使用 `@coze-arch/eslint-config` 提供的 `web` 预设（参见 `eslint.config.js`）。
  - `test`: `vitest --run --passWithNoTests`，底层配置来自 `@coze-arch/vitest-config`，额外设置了覆盖率与 setup。
  - `test:cov`: `npm run test -- --coverage`，根据 `vitest.config.ts` 中的 `coverage` 配置生成覆盖率报告。

### 4.2 测试配置
- 配置文件位置：`vitest.config.ts`，通过 `defineConfig`（@coze-arch/vitest-config）生成最终配置。
- 关键点：
  - 测试 preset：`preset: 'web'`，与前端其他包统一。
  - 覆盖率：
    - `provider: 'v8'`，对 `src` 下所有文件生效；
    - 但排除了大量入口和「高度耦合 UI」文件（如 `src/index.tsx`、`src/component/**`、`src/page/**` 等），更关注 Hook / Util 的行为。
  - `setupFiles: ['./__tests__/setup.ts']`：在测试前统一注入全局配置（如 jsdom、翻译、全局 mock 等）。
- 执行方式：在子包目录执行 `npm test` 或由上层 Rush 统一编排（例如 `rushx test:<tag>`，取决于 monorepo 脚本约定）。

### 4.3 代码风格与静态检查
- ESLint：
  - 配置入口：`eslint.config.js`，调用 `defineConfig({ packageRoot: __dirname, preset: 'web' })`。
  - 风格与规则：继承架构团队统一规则，如最大行数、无未使用变量等；本包在部分 Hook 中通过注释临时关闭长函数相关规则（`max-line-per-function`/`max-lines-per-function`），避免过度拆分核心业务 Hook。
- Stylelint：
  - 使用 `@coze-arch/stylelint-config`，配置文件在根目录 `.stylelintrc.js`。
- TypeScript：
  - `tsconfig.json` 使用 `composite: true` 并通过 `references` 指向 `tsconfig.build.json` / `tsconfig.misc.json`，方便在 Rush 项目中进行增量构建。

## 5. 项目约定与模式

### 5.1 导出与路径约定
- 所有对外可用接口须在 `package.json.exports` 中显式声明：
  - 例如：
    - `./hook/use-mock-set-in-setting-modal` → `src/hook/use-mock-set-in-setting-modal.ts`。
    - `./use-trans-schema` → `src/hook/use-trans-schema.ts`。
    - `./mock-set/utils`、`./util` → `src/util/index.ts`。
    - `./mockset-edit-modal` / `./mockset-delete-modal` / `./mock-data-list` 等组件路径。
- 类型分发通过 `typesVersions` 对应到同一份源码文件，避免额外的 `.d.ts` 维护成本。
- 在其他包中使用时，应遵循「包内导出路径」而非硬编码源码路径，方便未来内部重构。

### 5.2 Hook 设计模式
- React Hook 中统一使用：
  - `ahooks` 的 `useRequest` 管理异步状态（`data`、`loading`、`error`），并通过 `ready`、`refreshDeps` 控制请求时机与依赖。
  - `useMemo` / `useMemoizedFn` 做缓存与稳定回调，减少子组件重复渲染。
  - `useRef` 存储跨渲染过程的中间状态（如上次选中的 Mock 集），避免闭包问题。
- 业务 Hook 返回的数据结构一般包含：
  - `actions`: `doXXX` 风格的方法（如 `doChangeMock`、`doConfirmDelete`、`doEnabled`）。
  - `data`: 各类数据源（如 `mockSetData`、`selectedMockSet`、`initialInfo`）。
  - `status`: 各种 loading / flag 状态（如 `isListLoading`、`isSettingLoading`、`showCreateModal` 等）。

### 5.3 埋点与日志
- 埋点：统一使用 `@coze-arch/bot-tea`：
  - 事件常量定义在 `EVENT_NAMES`，参数类型 `ParamsTypeDefine[...]`。
  - 调用形态：
    - `sendTeaEvent(EVENT_NAMES.use_mockset_front, {...fields})`。
  - 所有埋点参数中保持 `environment`、`workspace_id`、`workspace_type`、`tool_id` 等字段一致，
    - 通过 `getEnvironment`、`getPluginInfo`、`getUsedScene` 等帮助函数生成，避免手动拼接。
- 日志：统一使用 `@coze-arch/logger`：
  - 错误日志字段通常包含 `error` 和 `eventName`。
  - TS 类型不完全对齐时允许 `// @ts-expect-error -- linter-disable-autofix` 的注释，但仅限于日志场景。

## 6. 与上游应用的集成方式
- 主要消费方包括：
  - `@coze-studio/mockset-editor`、`@coze-studio/mockset-edit-modal-adapter` 等 Mock 编辑器相关包。
  - Agent IDE 主应用 `frontend/apps/coze-studio` 中的插件配置页面、调试面板等，通过本包提供的 Hook & 组件实现 Mock 集管理能力。
- 通信方式：
  - 与后端 Debugger 服务的 RPC 通信通过 `@coze-arch/bot-api/debugger_api` 完成，本包不直接关心传输层细节。
  - 与 IDE 其他模块的通信主要通过：
    - 共享 Store（user-store / bot-studio-store）。
    - Page Jump Service（`usePageJumpService`）在不同页面 / 场景之间传递上下文。

## 7. 开发注意事项与特殊点
- 不要绕过已有工具函数：
  - 比如在新代码里判断当前 Mock 集是否匹配当前场景，必须使用 `isCurrent` / `isSameScene` / `isSameWorkflowTool`，保持所有入口的行为一致。
- 修改埋点或 RPC 时需关注上下游：
  - 事件名和字段来源自 `@coze-arch/bot-tea` 与 `@coze-studio/mockset-shared`，调整前建议搜索全仓对应用法，确保统计与调试服务一致。
- 注意 cache 行为：
  - `use-trans-schema` 内部对 Schema 做了内存缓存，若新增参数需要影响解析结果（如多语言 / 版本号），应一并纳入 cache key。
- 测试优先覆盖 Hook 与 Util：
  - 组件多以展示为主，覆盖率配置已默认忽略大多数 UI 文件；新增复杂业务逻辑时，优先为 Hook / Util 添加单测。