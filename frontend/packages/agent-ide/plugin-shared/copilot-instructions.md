# @coze-agent-ide/plugin-shared — AI 协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/plugin-shared）中安全、高效地协作开发。

## 全局架构与定位
- 本包提供 Agent IDE 中「插件选择与展示」相关的共享能力，主要面向各种插件弹窗 / 列表组件的复用。
- 典型职责：
  - 定义插件列表查询参数与分页常量（constants/plugin-modal-constants.ts、types/plugin-modal-types.ts）。
  - 封装插件检索服务 fetchPlugin（service/fetch-plugin.ts），统一从市场 / 收藏 / 我的 / 项目等来源拉取插件列表。
  - 提供通用的插件卡片 UI 组件 PluginPanel / PluginItem（components/plugin-panel/*），负责展示插件及其 API 列表并处理「添加/移除」等交互。
  - 提供若干插件类别工具函数，如 getDefaultPluginCategory / getRecommendPluginCategory / getPluginApiKey（utils/index.ts、utils/get-api-unique-id.ts）。
- 对外能力全部通过 src/index.ts 导出；其他子包（如 agent-ide 的 modal/adapter、setting/adapter 等）应只依赖本入口，不直接 import 内部路径，以便未来内部可重构。

## 代码组织与主要模块
- 入口与类型：
  - src/index.ts：统一导出 PluginPanel、fetchPlugin、MineActiveEnum、PluginFilterType、各种 Query/响应类型（CommonQuery、PluginQuery、RequestServiceResp 等）及 open 模式枚举 From / OpenModeType。
  - src/typings.d.ts：补充本包内部使用的全局类型声明（如 JSX 或第三方模块），AI 修改时保持声明最小化，避免与全局重复。
- 常量与类型：
  - constants/plugin-modal-constants.ts：
    - MineActiveEnum：当前筛选 tab（All / Mine）。
    - DEFAULT_PAGE / DEFAULT_PAGE_SIZE：分页默认值（1 / 10）。
    - PluginFilterType：mine / team / favorite / project / local / coze 等过滤类型（目前主要由上层 UI 使用）。
  - types/plugin-modal-types.ts：
    - CommonQuery / PluginQuery：封装插件查询参数，紧耦合后端 product_api / developer_api 定义；扩展查询维度时应优先在这里补充字段并与后端协议同步。
    - RequestServiceResp：统一的列表返回数据结构（list + total + hasMore）。
    - PluginModalModeProps：描述插件弹窗的交互模式（openMode、from、各种回调），是本包组件与上层「插件弹窗容器」之间的主要契约。
- 工具函数：
  - utils/index.ts：
    - getDefaultPluginCategory / getRecommendPluginCategory：构造「全部 / 推荐」分类，依赖 I18n 与图标资源；新增分类时请在上层容器中扩展，而不是直接在这里硬编码更多类型。
    - getPluginApiKey(api)：用 plugin_id + name 拼接唯一 key，用于列表去重／删除时精确匹配。
  - utils/get-api-unique-id.ts：对外导出 getApiUniqueId（当前实现较简单），用于某些列表 key / 缓存 key 场景。
- 服务层：
  - service/fetch-plugin.ts：
    - 定义 SimplifyProductInfo / PluginContentListItem：对后端 ProductInfo + PluginInfoForPlayground 进行裁剪与组合，兼容市场和本地插件。
    - getPluginFromMarket：调用 ProductApi.PublicGetProductList 拉取市场插件，针对 recommend / isCoze / pluginType 做特殊处理，并通过 qs + filterProductListParams 过滤非法 query 参数。
    - getPluginFromFavorite：调用 ProductApi.PublicGetUserFavoriteList 拉取收藏插件列表，保持分页与格式一致。
    - getPluginFromMinOrTeam：调用 PluginDevelopApi.GetPlaygroundPluginList 拉取「我的 / 团队」插件，附带 space_id 和 PluginType 列表。
    - getPluginFromProject：调用 PluginDevelopApi.GetDevPluginList 拉取项目内插件，支持 devId / projectId 过滤。
    - fetchPlugin(queryParams, commParams)：对外统一入口，根据 commParams（isMine、isTeam、isFavorite、isProject）路由到不同数据源；AI 在新增来源时请在此处集中扩展分支。
    - formatCacheKey({ query, isSearching, isTemplate, page })：生成缓存 key，用于上层缓存插件列表；修改缓存策略时统一在此函数调整。
- 组件层：
  - components/plugin-panel/index.tsx：
    - PluginPanel：核心 UI 组件，负责展示单个插件及其下所有 API（PluginItem 列表）并处理添加/移除逻辑。
    - 依赖数据：info（PluginInfoForPlayground 扩展）、productInfo（SimplifyProductInfo）、pluginApiList + onPluginApiListChange、workflowNodes（用于统计已经在 workflow 中引用的次数）、多种 UI 开关（showCreator / showMarketLink 等）。
    - 内部使用 useInViewport + sendTeaEvent 上报曝光和展开事件；不能随意删除这些埋点调用。
    - onApiToggle：
      - 移除：从 pluginApiList 过滤当前 API，并发送「移除」埋点与 Toast 成功提示。
      - 添加：
        - 校验名称冲突：同一插件名 + API 名是否已存在，若冲突则 Toast 错误并返回 false。
        - 若来源为市场：调用 PluginDevelopApi.GetPlaygroundPluginList 再拉取最新插件信息，并补充 plugin_product_status / preset card 等；否则直接使用现有 api + pluginInfo。
        - 若 openMode=OnlyOnceAdd 或 from 属于 WorkflowAddNode / ProjectIde / ProjectWorkflow：调用 openModeCallback 并根据返回值决定是否视为成功（支持返回 boolean 以表示失败）。
        - 否则：在非开源环境下调用 PluginDevelopApi.QuickBindPluginPresetCard，随后将 API 追加进 pluginApiList 并 Toast 成功。
    - renderAuthStatus：根据 productInfo.auth_mode（PluginAuthMode）展示「待开通/未授权/已授权」等标签，交互依赖 ActivatePopover。
  - components/plugin-panel/item.tsx：
    - PluginItem：渲染单个 API 行，包括名称、描述、参数列表（parameters + ParametersPopover）、示例（useViewExample）、调用指标（PluginPerfStatics）以及添加/移除按钮。
    - 负责处理 Popconfirm 提示（本地插件且未在当前 workflow 使用时提示「仅可用于某些连接器」）、按钮文案切换（Add/Added/Remove）和 count（已被多少 workflow 节点使用）。
    - onApiToggle 调用由上层 PluginPanel 传入，返回 Promise<boolean>，用于决定是否增加计数.
  - components/plugin-panel/helper.ts：提供 extractApiParams，用于从 workflow 节点输入参数中取出 pluginID / apiID 等，用于统计 workflowNodes 映射。
  - components/plugin-panel/plugin-perf-statics/*、activate-popover/*：封装性能统计展示和「一键开通」弹层，调用方通过 PluginPanelProps.productInfo / commercialSetting 等字段驱动显示。

## 关键数据流与外部依赖
- 插件与产品数据结构：
  - 来自 @coze-arch/bot-api/product_api 的 ProductInfo / ProductMetaInfo / ProductEntityType / PluginType / CommercialSetting。
  - 来自 @coze-arch/bot-api/plugin_develop 的 PluginInfoForPlayground / PluginApi。
  - SimplifyProductInfo 与 PluginContentListItem 作为本包内部统一结构，既用于列表渲染，也用于 PluginPanel 的 props。
- 空间与用户上下文：
  - 使用 useSpaceStore（@coze-foundation/space-store 或 @coze-arch/bot-studio-store）获取当前 space_id 并传给后台接口；AI 在新增 API 调用时应保持使用 store 获取 spaceId，而不是硬编码。
  - 使用 useBotInfoStore（@coze-studio/bot-detail-store/bot-info）获取 botId，用于埋点与 QuickBindPluginPresetCard 等调用。
- 埋点与工具：
  - 事件上报依赖 @coze-arch/bot-tea 的 sendTeaEvent 与 EVENT_NAMES，以及 @coze-arch/bot-utils 的 emitEvent / OpenBlockEvent / formatDate / formatNumber。
  - withSlardarIdButton（@coze-studio/bot-utils）用于在错误 Toast 内容中附带错误上报按钮；不要移除这类调用。
- UI 与设计体系：
  - 主要 UI 组件来自 @coze-arch/bot-semi（Collapse / Typography / UIButton 等）、@coze-arch/coze-design（Tag / Tooltip / icons）、@coze-community/components（ConnectorList / OfficialLabel）、@coze-studio/components（AvatarName / ParametersPopover / CardThumbnailPopover）。
  - 新增 UI 时优先复用上述组件，保持整体风格统一，避免直接使用原始 HTML + 手写样式。

## 开发与测试工作流
- 依赖与初始化：
  - 在仓库根目录执行 rush update 或 scripts/setup_fe.sh，确保 workspace:* 依赖正确安装。
- 本包常用 npm script（在 frontend/packages/agent-ide/plugin-shared 下）：
  - lint：npm run lint → eslint ./ --cache，规则来自 eslint.config.js（@coze-arch/eslint-config/preset:web）。
  - test：npm test → vitest --run --passWithNoTests，配置在 vitest.config.ts，使用 @coze-arch/vitest-config web 预设；当前 __tests__ 目录仅有占位文件，可按需补充。
  - test:cov：npm run test:cov 以收集覆盖率；CI 中具体阈值由上层 rushx-config 控制。
  - build：npm run build 为占位命令（exit 0），真正的打包由上层应用或构建系统统一负责，本包仅提供源码与类型。
- TypeScript：
  - tsconfig.build.json 继承 @coze-arch/ts-config/tsconfig.web.json，并通过 references 声明依赖 arch/common/community/studio 等子包；新增跨包类型依赖时若遇到编译错误，需要同步维护此列表。

## 项目约定与编码风格
- 对外 API 约定：
  - 新增对外能力时，应在 src/index.ts 中集中导出，并避免直接暴露深层实现（如具体组件子目录），以减少未来重构带来的影响范围。
  - PluginPanelProps / PluginModalModeProps 是上层集成的关键接口：任何破坏性修改都可能影响多个 agent-ide 子包，改动前需全局搜索引用并评估影响。
- 交互与错误处理：
  - 添加/移除插件 API 的交互统一通过 onApiToggle（返回 Promise<boolean>）处理，PluginItem 依赖返回值决定是否更新 count；扩展交互时不要在多个地方重复实现逻辑。
  - 与后端交互失败时，应通过 Toast.error + withSlardarIdButton 提示，而不是静默失败；成功场景用 Toast.success 并尽量携带 plugin/api 名称。
- 样式：
  - 使用 Less 模块 index.module.less，并辅以 Tailwind utility class（如 h-[9px]、text-lg）；新增样式时保持类名语义化，避免在组件中大量内联样式。
  - 与 semi / coze-design 组件联动的样式，通过 :global 选择器覆盖默认样式，谨慎修改以避免影响其他插件列表区域。

## 与其他子包及流程的关系
- 消费方：
  - 各种「插件弹窗 / 插件区域适配器」子包，如 @coze-agent-ide/plugin-modal-adapter、plugin-content-adapter 等会依赖本包导出的常量、类型和组件；这些包通常负责管理弹窗状态、本地缓存和路由，而本包提供展示与底层数据拉取能力。
- 与 workflow 的集成：
  - PluginPanel 支持传入 workflowNodes（来自 @flowgram-adapter/free-layout-editor 的 WorkflowNodeJSON[]），并通过 extractApiParams 提取每个节点绑定的 pluginID/apiID，从而计算某 API 在当前 workflow 中被使用的次数，并在按钮上显示计数徽标；在 workflow 场景扩展时应继续复用这一机制。
- 授权与商业配置：
  - productInfo.auth_mode / commercial_setting 由后台接口返回，本包只负责根据状态展示「待开通/未授权/已授权」与性能指标，不处理授权流程本身；真正的授权流程由 ActivatePopover 和上层业务负责。

## AI 助手修改建议
- 若需新增插件列表来源或过滤模式：
  - 在 types/plugin-modal-types.ts 中扩展 PluginQuery / CommonQuery。
  - 在 service/fetch-plugin.ts 中新增具体 getPluginFromXxx 实现，并在 fetchPlugin 中路由到该实现，同时考虑 formatCacheKey 是否需要区分新来源。
- 若需扩展 PluginPanel 展示信息：
  - 优先通过扩展 SimplifyProductInfo / PluginPanelProps 新字段，并在组件内按需展示；避免直接在组件中访问 productInfo 深层字段。
  - 如需新增埋点，请沿用 sendTeaEvent + EVENT_NAMES，并注意与现有字段（plugin_id / product_id / filter_tag / c_position 等）保持一致。
- 若需适配新的 open 模式：
  - 在 @coze-arch/bot-hooks 中确认 OpenModeType 新枚举后，在 PluginModalModeProps.openMode 与 PluginPanel 中扩展相应逻辑，确保与现有 OnlyOnceAdd / From.WorkflowAddNode 等模式兼容。
