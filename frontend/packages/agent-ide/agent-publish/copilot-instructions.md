# @coze-agent-ide/agent-publish 开发协作说明（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/agent-publish）中安全、高效地协作开发。

## 全局架构与职责边界

- 子包定位：为 Agent IDE 提供「Bot 发布管理」页面能力，主要暴露页面组件 `AgentPublishPage`，供上层应用（如 Studio、Agent IDE Shell）通过 React 路由嵌入使用。
- 入口导出：
  - [src/index.ts](frontend/packages/agent-ide/agent-publish/src/index.ts) 仅导出 `AgentPublishPage`：
    - `export { AgentPublishPage } from './components/bot-publish';`
  - 调用方通常通过路由配置（react-router-dom）在 `space/:space_id/bot/:bot_id/publish` 等路径渲染该页面。
- 页面结构（[src/components/bot-publish/index.tsx](frontend/packages/agent-ide/agent-publish/src/components/bot-publish/index.tsx)）：
  - 外层使用 `UILayout`（来自 @coze-arch/bot-semi）承载标题区和内容区；
  - Header 区：
    - 左侧：`BackButton` 返回 bot 详情页；
    - 右侧：发布按钮或“返回”按钮，取决于当前 `publishStatus`（`Publish.NoPublish` / `Publish.HadPublished`）。
  - Content 区：
    - 通过 `PublishTableContext.Provider` 下发发布相关上下文（`publishLoading`、`refreshTableData`）。
    - 使用 `Spin` 包裹，展示加载态。
    - 当 `publishStatus === Publish.NoPublish`：渲染 `PublishTable`，用于配置发布渠道和变更说明；
    - 否则渲染 `PublishResult`，展示各平台发布结果。
- 对外职责边界：
  - 本包不负责 Bot 详情、编辑或工作流逻辑，只围绕「发布流程」做交互和 API 调用；
  - Bot 基础信息、货币化配置由 `useGetPublisherInitInfo` / 上游 `@coze-agent-ide/space-bot` 等包提供，本包只消费这些数据；
  - 与空间、用户、埋点等通用能力通过 `@coze-arch/*`、`@coze-studio/*` 等 workspace 包集成。

## 关键数据流与组件协作

### 顶层页面 AgentPublishPage

- 路由与上下文：
  - 使用 `useParams<DynamicParams>()` 读取 `space_id`、`bot_id`、`commit_version` 等路由参数；
  - 使用 `useNavigate()` 构造返回 bot 详情页的跳转（`/space/:space_id/bot/:bot_id`）。
- 初始化数据：
  - `useGetPublisherInitInfo()`：获取 `botInfo`（bot 名称等）和 `monetizeConfig`（货币化配置），来自本包 hooks 目录；
  - 通过 `useRequest`（ahooks）请求 `SpaceApi.PublishConnectorList`：
    - 入参：`{ bot_id, commit_version }`；
    - 返回：
      - `publish_connector_list`：各发布渠道/连接器信息列表；
      - `connector_brand_info_map`：品牌信息映射；
      - `submit_bot_market_option.can_open_source`：可否开源；
      - `publish_tips.cost_tips`：发布费用提示文案。
- 状态字段（useState）：
  - `publishStatus: Publish`：当前发布状态（`NoPublish` / `HadPublished`）；
  - `connectInfoList: PublishConnectorInfo[]`：发布渠道列表；
  - `connectorBrandInfoMap: Record<string, ConnectorBrandInfo>`：品牌信息；
  - `publishResult: PublishResultInfo | undefined`：发布结果；
  - `publishDisabled: PublishDisabledType | undefined`：发布按钮禁用原因；
  - `publishLoading: boolean`：是否正在发布；
  - `canOpenSource: boolean`：是否允许开源；
  - `publishTips: string`：费用提示；
  - `publishRef: Ref<PublishRef>`：向下传递给 `PublishTable`，用于在页面级触发发布。
- 埋点与性能：
  - 使用 `createReportEvent` + `ReportEventNames.publishPlatform` 记录发布平台列表加载过程的 start/success/error；
  - 使用 `useReportTti({ isLive: !loading })` 上报页面首屏 TTI。
- 发布按钮逻辑：
  - `disabled` 条件：`Boolean(publishDisabled) || !botInfo.name`，避免在 botInfo 未返回时点击发布；
  - `disabledTooltip` 通过 `publishDisabled` 对应到具体 i18n key（未选分类/平台/行业等）；
  - `handlePublish` 调用 `publishRef.current?.publish()`，实际发布逻辑在 `PublishTable` 内部实现。

### PublishTable（发布配置与提交）

- 文件： [src/components/bot-publish/publish-table/index.tsx](frontend/packages/agent-ide/agent-publish/src/components/bot-publish/publish-table/index.tsx)
- 对外 props：
  - `setPublishStatus`、`setPublishResult`：用于回写到页面级状态；
  - `connectInfoList`、`connectorBrandInfoMap`：发布渠道与品牌信息；
  - `botInfo`、`monetizeConfig`：bot 基本信息与货币化配置；
  - `getPublishDisabled(publishDisabledType)`：将当前禁用原因上报给父组件；
  - `getPublishLoading(loading)`：向父组件同步发布请求的 loading 状态；
  - `canOpenSource`、`publishTips`：控制表格内开源选项和费用提示展示。
- 内部状态：
  - `publishId = nanoid()`：单次发布唯一标识，用于埋点；
  - `dataSource: PublishConnectorInfo[]`：本地可编辑的发布渠道列表；
  - `selectedPlatforms: string[]`：当前选中的渠道 `id` 列表；
  - `spaceId`、`botId`：再次从路由参数中取出；
  - `spaceType`：通过 `useSpaceStore` 获取当前空间类型（Personal/Team）；
  - `changeLog: string`：本次发布的变更说明；
  - `hasCategoryList: boolean`：当前是否存在分类列表（由子组件回写）；
  - `isPersonal`：是否个人空间。
- 初始选中逻辑：
  - 首次接收到 `connectInfoList` 时：
    - 先 set 到 `dataSource`；
    - 再根据：
      - `item.allow_punish === AllowPublishStatus.Allowed`；
      - `getConnectorIsSelectable(item, botInfo)`；
    - 自动勾选可用渠道的 `id` 作为 `selectedPlatforms`。
- 发布禁用规则：
  - `notSelectPlatform`：`!selectedPlatforms.length`；
  - `notSelectCategory`：
    - `hasCategoryList` 为 true；
    - 选择了 `STORE_CONNECTOR_ID` 渠道；
    - 该渠道 `bind_info.category_id` 为空；
  - useEffect 根据上述布尔值设置：
    - `PublishDisabledType.NotSelectPlatform` 或 `PublishDisabledType.NotSelectCategory`；
  - useEffect 同步 `publishLoading` 到父组件，通过 `getPublishLoading`。
- 发布实现（`handlePublish`）：
  - 构造 `connectors`：`{ [connectorId]: bind_info }`，仅包含当前选中的渠道；
  - 通过 `sendTeaEvent(EVENT_NAMES.bot_publish, {...})` 上报埋点：空间/机器人/publishId/工作区类型/变更说明情况等；
  - 调用 `useConnectorsPublish` 返回的 `handlePublishBot`：
    - onSuccess：
      - 设置 `Publish.HadPublished`；
      - 使用 `getPublishResult`（来自 `@coze-agent-ide/space-bot`）基于服务端结果和当前渠道列表生成详细 `connectorResult`；
      - 组合 `marketResult`、`publish_monetization_result` 一并写入 `setPublishResult`。
- 表单与表格：
  - 变更说明：
    - `Form.Label` + `TextArea` 输入，多行文本，最多 2000 字；
  - 发布渠道表头：
    - 左侧必填星号 + 标题 `bot_publish_select_title`；
    - 右侧如果有 `publishTips`，则展示提示 Tooltip，文案 key `coze_cost_sharing`。
  - 服务条款弹层：
    - 使用 `PublishTermService` 渲染各渠道的隐私协议和用户协议链接（来自 `privacy_policy` / `user_agreement` 字段）；
  - 渠道列表：
    - 存在数据时渲染 `TableCollection`：
      - 负责勾选渠道、展示各平台配置项、控制是否可开源等；
      - 通过 props 将 `selectedPlatforms`、`dataSource`、`canOpenSource`、`monetizeConfig` 等传入；
      - 通过回调更新 `selectedPlatforms`、`dataSource`、`setHasCategoryList`。
    - 无数据时展示空状态（IconCozEmpty + 两行文案）。

### 上下文与辅助 hooks

- `PublishTableContext`（[publish-table/context/index.tsx](frontend/packages/agent-ide/agent-publish/src/components/bot-publish/publish-table/context/index.tsx)）：
  - 提供：`refreshTableData: () => void` 和 `publishLoading: boolean`；
  - 默认实现 `refreshTableData` 为空函数，`publishLoading` 为 false；
  - `AgentPublishPage` 将 `useRequest` 返回的 `refresh` 方法写入 Provider，用于让子组件在渠道变更后刷新列表；
  - 提供 `usePublishTableContext`、`useRefreshPublishTableData` 方便下游组件直接获取刷新方法。
- `useGetPublisherInitInfo`：
  - 负责获取 bot 基础信息与货币化配置，通常内部会调用 Bot API 与 bot-detail-store；
  - AI 在修改时应保持其返回字段（`botInfo`、`monetizeConfig`）结构稳定。
- `useAuthFail`：
  - 处理鉴权失败场景（如用户账户授权失效）；
  - 在 `AgentPublishPage` 中被直接调用，内部逻辑包括错误弹窗、重定向等。

## 开发与测试工作流

- 包管理：
  - 本仓库使用 Rush + PNPM workspace 管理依赖；
  - 在根目录执行：`rush update` 完成所有前端依赖安装/更新。
- 包内脚本（[package.json](frontend/packages/agent-ide/agent-publish/package.json)）：
  - `build`: `exit 0`
    - 当前子包不单独产出构建结果，真正打包由上层应用/打包系统统一处理；
    - AI 助手不要在本包新增独立 bundler 流程，保持与现有 workflow 系列一致。
  - `lint`: `eslint ./ --cache`
    - 配置入口为 [eslint.config.js](frontend/packages/agent-ide/agent-publish/eslint.config.js)，使用 `@coze-arch/eslint-config` 的 `web` 预设；
    - 建议通过 `rushx lint --to @coze-agent-ide/agent-publish` 在根目录触发。
  - `test`: `vitest --run --passWithNoTests`
  - `test:cov`: `npm run test -- --coverage`
    - 测试配置在 [vitest.config.ts](frontend/packages/agent-ide/agent-publish/vitest.config.ts)，使用 `@coze-arch/vitest-config` 的 `web` 预设；
    - 目前 `__tests__` 目录只有 `.gitkeep`，可按需新增组件/逻辑的单测。
- TypeScript 配置：
  - [tsconfig.build.json](frontend/packages/agent-ide/agent-publish/tsconfig.build.json)：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`；
    - `rootDir: src`，`outDir: dist`，target 为 ES2020，jsx 使用 `react-jsx`；
    - `references` 声明了对 arch 层 API/配置包、agent-ide-commons、space-bot、studio 组件与 store 等的依赖，确保 TS project references & 增量构建顺序正确。
  - `tsconfig.json` / `tsconfig.misc.json` 则多用于 IDE 体验和非产出文件（如测试）的类型检查。

## 项目约定与编码规范

- 技术栈：
  - React 18 函数组件 + TypeScript；
  - 路由使用 `react-router-dom@6`；
  - 异步请求状态使用 `ahooks/useRequest`；
  - UI 组件采用 `@coze-arch/bot-semi`（UILayout、Form、Space、TextArea、Spin、UIButton 等）和 `@coze-arch/coze-design`（图标、Tooltip 等）。
- i18n：
  - 所有文案均通过 `I18n.t('key')` 获取，Key 由上游 i18n 资源统一管理；
  - 新增/修改文案时，应遵循现有命名模式（如 `publish_tooltip_select_category`、`bot_publish_changelog`），并在对应 i18n 包中补充映射。
- 埋点与日志：
  - 行为埋点：
    - 页面级加载埋点使用 `createReportEvent` + `ReportEventNames.publishPlatform`；
    - 发布行为埋点使用 `sendTeaEvent(EVENT_NAMES.bot_publish, payload)`，payload 中包括空间、bot、工作区类型、变更说明是否为空等字段；
  - 错误处理：
    - 异步请求错误统一通过 `useErrorHandler` 处理，并将 error 信息传给 `getPublishPlatformEvent.error`；
- 组件与 hooks 组织：
  - 页面级容器 `AgentPublishPage` 放在 `components/bot-publish` 下，其内部再拆分：
    - `hooks/`（获取 bot 信息、处理鉴权失败）；
    - `publish-table/`（发布配置表格及相关逻辑、context）；
    - `publish-result/`（发布结果展示，包括 `PublishResult` 和 `PublishResultArea` 等）；
  - 新增子功能时，优先在 `publish-table` 或 `publish-result` 下增量扩展，而不是混入 `AgentPublishPage` 顶层，以保持职责清晰。

## 与外部系统的集成与约束

- 与 Bot / Space API：
  - 读取发布连接器列表：`SpaceApi.PublishConnectorList({ bot_id, commit_version })`；
  - 实际发布请求通过 `useConnectorsPublish` 封装，内部会调用 `developer_api` 对应接口；
  - 连接器状态、允许发布状态、空间类型等所有字段类型均来自 `@coze-arch/bot-api/*` 与 `@coze-arch/bot-typings`，不要在本包重复声明。
- 与 Space Bot 能力：
  - 发布结果结构（`PublishResultInfo`、`PublishRef`、`PublishDisabledType`、`PublishConnectorInfo` 等）来自 `@coze-agent-ide/space-bot`；
  - `getPublishResult` 用于将服务端发布结果与渠道列表结合生成前端展示模型，所有关于结果聚合的逻辑应优先在该函数内部调整，而不是在本包重算。
- 与 Studio / IDE 公共能力：
  - 用户信息、鉴权：`userStoreService.useUserAuthInfo()`、`useAuthFail` 等；
  - 空间信息：`useSpaceStore`；
  - 布局与返回按钮：`UILayout`、`BackButton`；
  - Premium 相关组件：`@coze-studio/premium-components-adapter` 等可能在 `PublishResult` 或 `TableCollection` 中使用（需查看对应文件）。

## 项目流程与协作建议（AI 助手）

- 如果需要扩展发布渠道表格能力（如新增渠道字段、增加筛选/排序）：
  - 优先在 `publish-table/table-collection` 目录下增量实现，并复用 `PublishTableContext` / `useConnectorsPublish`；
  - 不要在 `AgentPublishPage` 直接增加与表格耦合的逻辑。
- 如需调整发布禁用逻辑：
  - 修改 `PublishDisabledType` 的判定逻辑时，一并审查：
    - `PublishTable` 内部 useEffect 计算；
    - 顶层页面中 `disabledTooltip` 和按钮 `disabled` 条件；
    - 相关 i18n 文案与产品规则，避免出现禁用原因与提示不一致。
- 若需要新增埋点字段或事件：
  - 统一在 `EVENT_NAMES` / `ReportEventNames` 与 `sendTeaEvent`/`createReportEvent` 调用处补充；
  - 避免在组件中直接硬编码事件名或上报结构，保持与 arch 层埋点规范一致。
- 变更导出 API：
  - 目前仅导出 `AgentPublishPage`；如需公开更多组件或 hooks，应：
    - 先在实际调用场景中证明有必要；
    - 再在 `src/index.ts` 中集中导出，保持包对外接口收敛；
    - 同时在需要时更新文档与 README。
