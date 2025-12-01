# @coze-studio/open-auth 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/open-platform/open-auth）中安全、高效地协作开发。

## 总体架构与角色定位
- 本包是一个 React/TypeScript UI 子库，主要用于「开放平台 PAT（Personal Access Token）/ Open Auth」相关的 UI 能力封装，对外暴露可复用的组件与工具函数，而不是独立运行的应用。
- 入口文件为 `src/index.tsx`，只做「集中导出」：PAT 主体组件 `PatBody`、表格组件 `AuthTable`、时间工具 `utils/time`、说明文案包装 `components/instructions-wrap`、表格高度 Hook `useTableHeight`、表格列配置 `patColumn` 以及权限弹窗 `PermissionModal` 等。
- 业务核心围绕「PAT 列表 + PAT 创建/编辑/删除 + 权限配置」展开，数据读写均通过 `@coze-arch/bot-api/pat_permission_api` 和 `patPermissionApi` 完成；本包只负责 UI 和交互逻辑，不直接管理全局路由或应用状态。
- 组件层级大致为：外部业务页面/容器组件 → 使用导出的 `PatBody`/`AuthTable` 或内部子组件 → 这些组件内部再通过 hooks 调用 API，并触发埋点 (`@coze-arch/report-events` + `@coze-arch/logger`)。
- 设计上强调：将 API 调用集中在 hooks（尤其是 `src/hooks/pat` 下）中，组件只做 UI 渲染和交互编排，使得复用和单元测试更容易。

## 目录结构与关键模块
- `package.json`：
  - `exports` / `main` 指向 `./src/index.tsx`，说明只通过 TS 源码导出（构建产物通常由上层 monorepo 工具链处理）。
  - `scripts`：`build` 暂时为 `exit 0`（构建由上层统一处理），`lint` 使用 `eslint`，`test` 使用 `vitest`，`test:cov` 追加覆盖率。
  - 依赖侧重 Coze 自制组件库 (`@coze-arch/coze-design`)、i18n、logger、report-events，以及 `ahooks`、`dayjs` 等工具。
- `README.md`：对外说明支持 `eslint & ts`、`esm/umd bundle`、`storybook`，并约定：
  - 初始化依赖：`rush update`
  - 本地开发：`npm run dev`（dev 命令在上层或模板中统一定义，本包本身只维护 build/lint/test 脚本）。
- `src/index.tsx`：
  - 只做命名导出，不包含逻辑。对外主要暴露：
    - `PatBody` + `PATProps`：PAT 列表 + 表单 + 结果模态框的整体容器。
    - `AuthTable`：对 `@coze-arch/coze-design/Table` 的轻量包装，统一样式（`index.module.less`）。
    - `utils/time` 中的时间相关方法：`disabledDate`、`getExpirationOptions`、`getExpireAt`、`getDetailTime`、`getExpirationTime`、`getStatus` 以及 `ExpirationDate` 枚举。
    - 说明与提示组件：`LinkDocs`、`PATInstructionWrap`、`Tips`。
    - 布局 Hook：`useTableHeight`。
    - 列配置集合：`patColumn`（封装了 PAT 表格所有列的配置）。
    - 权限弹窗：`PermissionModal` 及其 props/ref 类型。
- `src/components/pat/PatBody`：
  - 接收 `PATProps`：支持自定义顶部区域、空状态、自定义数据源获取与列配置、替换权限弹窗、取消权限弹窗后的回调等。
  - 内部使用 `usePatOperation` 统一管理 PAT 列表、增删改、模态框开关、创建成功结果等状态，并在 `useEffect` 中首次自动拉取列表。
  - 视图结构：顶部区域（默认 `TopBody`，可被 `renderTopBodySlot` 覆盖）+ `DataTable`（传入 `dataSource`、`onEdit`、`onDelete` 等）+ 可选的 `PermissionModal`/自定义弹窗 + `ResultModal`。
- `src/components/auth-table/AuthTable`：
  - 对 `@coze-arch/coze-design/Table` 进行二次封装：统一表格容器和内容 className，并根据 `size`/`type` 追加不同样式类。
- `src/components/pat/data-table`：
  - `table-column` 下按列拆分：`column-name.tsx`、`column-create-at.tsx`、`column-last-use-at.tsx`、`column-expire-at.tsx`、`column-status.tsx`、`column-op.tsx`。
  - `table-column/index.tsx` 中通过 `getTableColumnConf` 组装所有列配置，并导出 `patColumn` 对象供外部按需复用。
- `src/components/instructions-wrap`：
  - `PATInstructionWrap`：展示 PAT 使用提醒与文档链接；根据运行环境（`IS_OVERSEA` 全局变量）决定是否增加额外提醒文案。
  - `LinkDocs`/`Tips`：通用 UI 组件，对 `@coze-arch/coze-design` 的 `Typography`、`Tooltip` 等进行定制。
- `src/hooks/pat/use-token.ts`：
  - 封装所有 PAT 相关 API 调用：列表、创建、更新、删除、获取权限详情，并在成功/失败时统一上报埋点：
    - 上报事件常量来自 `@coze-arch/report-events.REPORT_EVENTS`，核心埋点名如 `openGetPatList`、`openPatAction`。
    - 日志上报通过 `@coze-arch/logger.reporter` 完成（`event`/`errorEvent`）。
  - 所有请求均使用 `ahooks` 的 `useRequest`，默认 `manual: true`，由外层主动触发，避免组件初始化时过早调用。
- `src/hooks/pat/action/use-pat-operation.ts`：
  - 用于统筹 PAT 操作的 UI 状态：是否展示表单、结果弹窗、当前是否创建模式、被编辑的 PAT 记录、成功数据等。
  - 删除成功后会通过 `Toast.success` 和 `I18n` 显示友好提示，并刷新列表。
  - 对外暴露 `onAddClick`、`editHandle`、`runDelete`、`refreshHandle`、`createSuccessHandle`、`onCancel` 等，供 `PatBody` 使用。
- `src/hooks/pat/action/use-pat-form.ts`：
  - 聚合 PAT 表单的校验和提交逻辑：
    - 校验名称是否为空、过期时间选择是否合法、以及可选的自定义参数校验 `validateCustomParams`。
    - 支持自定义参数 `getCustomParams`，用于外部扩展表单字段，但仍由此 Hook 统一触发 `runCreate`/`runUpdate`。
    - 利用 `usePATPermission` 在编辑模式下预填表单名称。
  - 内部通过 `FormApi`（来自 `@coze-arch/coze-design`）读取/写入表单值，不直接依赖具体表单实现。
  - `useAuthMigrateNotice` 使用本地存储 key `auth_migrate_notice_do_not_show_again` 控制迁移提示弹窗只展示一次。
- `src/hooks/use-table-height.ts`：
  - 根据表格所在元素的 `getBoundingClientRect().top` 动态计算高度 `calc(100vh - (top + 80)px)`，并监听 window resize。
- `src/utils/time.ts`：
  - 使用 `dayjs` 和 `@coze-arch/i18n` 封装 PAT 相关的时间逻辑：
    - `disabledDate`：禁用今天及以前的日期，用于日期选择器。
    - `ExpirationDate` 枚举（1 天、30 天、自定义）。
    - `getExpirationOptions`：生成带国际化文案的过期时间选项及预览日期。
    - `getExpireAt`：把选中的日期转换为当天 23:59:59 的 Unix 时间戳。
    - `getDetailTime`/`getExpirationTime`/`getStatus`：为详情展示和状态计算提供统一方法（含永不过期标记）。

## 构建、测试与调试流程
- 依赖安装与初始化：
  - 在 monorepo 根目录执行：`rush update`。
  - 子包本身不推荐直接 `npm install`，以免破坏 Rush workspace 结构。
- 本地开发：
  - 典型做法是在上层应用（例如使用 `@coze-studio/open-auth` 的 app）中运行 `rushx dev` 或对应应用的 dev 命令；本包的组件作为依赖被实时编译/引用。
  - 若需要在本包内进行 Storybook 或独立调试，请参考上层统一配置（本包 README 只说明支持 Storybook，具体命令在其他包中统一）。
- 构建：
  - `npm run build` 当前实现为 `exit 0`，实际打包由 Rush/RSBuild/webpack 等在更高层级统一编排；AI 助手不要在本子包内擅自重写构建流程，除非明确需求。
- Lint：
  - `npm run lint` 使用 `@coze-arch/eslint-config` 的 `web` preset，配置文件为 `eslint.config.js`。
  - 规则以 monorepo 统一风格为主，局部不额外重写；编写代码时尽量遵守现有格式与 import 顺序，避免自定义 ESLint 规则。
- 测试：
  - `npm test` → `vitest --run --passWithNoTests`，使用 `@coze-arch/vitest-config` 的 `web` preset，配置见 `vitest.config.ts`。
  - `test.setupFiles` 为 `./setup` 目录，可能包含全局 mock（如 `IS_OVERSEA`、localStorage、window 尺寸等）。
  - 覆盖率配置覆盖 `src` 目录，但显式排除：
    - 复杂 UI（TSX）、入口文件、部分与浏览器 DOM 强耦合的 hooks / utils（如 `use-arcosite`、`use-show-mask`、图表相关 utils 等）。
  - 在新增代码时，优先为纯函数、业务 hooks 编写单元测试；复杂 UI 组件的细节测试可适当简化，遵守已有排除策略。

## 项目约定与模式
- Hooks 与 API 调用：
  - 所有 PAT 相关网络请求集中在 `src/hooks/pat` 下，统一使用 `ahooks/useRequest`：
    - 默认配置 `manual: true`，由外层控制请求时机。
    - 在 `onSuccess` 中更新本地 state 并上报埋点；在 `onError` 中通过 `reporter.errorEvent` 输出错误日志。
  - 新增接口时，优先在 hooks 中封装，再由组件消费；避免在组件内部直接调用 `patPermissionApi`，以保持职责清晰。
- 事件上报与日志：
  - 埋点事件名统一存放于 `@coze-arch/report-events.REPORT_EVENTS`，请复用既有事件名或在对应包统一新增，不要在本子包里硬编码字符串。
  - 日志接口统一使用 `@coze-arch/logger.reporter`，包含 `event` 和 `errorEvent` 两类。扩展时保持 `meta` 字段结构一致（包含 `action`，可选 `level`）。
- 国际化：
  - 所有文案（包括按钮文案、提示信息、表头文字等）统一通过 `@coze-arch/i18n.I18n.t` 读取，不直接写死中文/英文文本，除非作为兜底值或测试数据。
  - `getExpirationOptions` 使用 `I18nKeysNoOptionsType` 保证 key 类型安全；新增 key 时注意在 i18n 资源文件中补齐。
- UI 组件与样式：
  - UI 基于 `@coze-arch/coze-design`、`@coze-arch/coze-design/icons` 和 Less 模块；
  - 样式文件统一使用 `index.module.less` 命名，并通过 `styles['xxx']` 访问。
  - ClassName 组合依赖 `classnames` (或 `cls`)；新增组件请沿用同样的方式，而不是手写长串 className 字符串。
- 表格列配置：
  - 每一列拆分为单独文件（`column-*.tsx`），集中在 `table-column` 文件夹中；`table-column/index.tsx` 作为组合入口。
  - 新增列优先在该目录中新增 `column-xxx.tsx`，并通过 `getTableColumnConf` / `patColumn` 统一导出，避免在多处手写重复配置。
- 表单与校验：
  - 表单值通过 `FormApi` 读写，不直接依赖某个具体表单组件；
  - 基础校验逻辑（如名称非空、过期时间合法）集中在 `usePatForm` 中；
  - 扩展字段需要：
    - 通过 `getCustomParams` 返回额外字段；
    - 通过 `validateCustomParams` 注入自定义校验；
    - 由外层表单 UI 保证字段存在，避免在 Hook 内耦合太多 UI 实现细节。

## 与其他子包/外部系统的集成
- Bot API：
  - 所有 PAT 相关类型和 API 来自 `@coze-arch/bot-api/pat_permission_api` 与 `patPermissionApi`：
    - 类型：`PersonalAccessToken`、`CreatePersonalAccessTokenAndPermissionRequest`、`UpdatePersonalAccessTokenAndPermissionRequest`、`ListPersonalAccessTokensResponse2` 等。
    - 方法：`ListPersonalAccessTokens`、`CreatePersonalAccessTokenAndPermission`、`UpdatePersonalAccessTokenAndPermission`、`DeletePersonalAccessTokenAndPermission`、`GetPersonalAccessTokenAndPermission`。
  - AI 助手新增/修改请求逻辑时，应遵照现有命名和错误处理模式，并保持响应类型兼容。
- 上层消费方：
  - 例如 `frontend/packages/foundation/global-adapter`、`frontend/packages/agent-ide/agent-publish` 等包会直接引入 `PatBody` 或某些导出的子组件，用于账号设置、插件发布等场景。
  - 因此，对外导出的 API（组件 Props、导出函数签名）修改需特别谨慎：
    - 尽量保持向后兼容；必要时新增 props 而非修改已有类型。
    - 若必须存在 breaking change，请同步更新所有使用点，并在提交说明中明确标注。
- 全局变量与运行环境：
  - 某些组件（如 `PATInstructionWrap`）依赖 `IS_OVERSEA` 等全局变量，通常由上层应用或构建配置注入；新增类似逻辑时注意在测试环境中提供 mock。

## 协作与变更建议
- 在本子包中编写代码时，优先：
  - 复用现有 hooks（如 `usePatOperation`、`usePatForm`、`useGetPATList` 等），必要时通过参数扩展行为，而非复制粘贴逻辑。
  - 保持 API 层（`hooks/pat`）与 UI 层（`components`）的解耦：网络请求、埋点、日志尽量集中在 hooks 中。
  - 严格使用 `@coze-arch/i18n`、`@coze-arch/coze-design` 等内部基础库，不随意引入新的 UI/状态管理库。
- 任何涉及以下内容的修改，都建议在 PR 描述中额外强调，并在本说明或上层说明文件同步更新：
  - 对外导出 API 变更（`src/index.tsx` 导出项）。
  - 埋点事件名、上报逻辑或错误处理策略变化。
  - 与其他子包/应用之间的调用契约（例如 PAT 列表字段结构、权限配置字段名）的变更。
