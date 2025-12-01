# Coze Community - Explore Copilot 指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/community/explore）中安全、高效地协作开发。

## 1. 子包定位与整体架构

- 包名称：@coze-community/explore，对应社区「发现 / Explore」域的前端页面与组件集合。
- 主要导出：
  - ExploreSubMenu：发现页左侧子菜单组件。
  - SearchPage：搜索结果页（/explore/search/:word）。
  - PluginPage：插件发现页（/explore/plugin）。
  - TemplatePage：模板发现页（/explore/template）。
- 上下游关系：
  - 作为业务子包被上层应用（如 apps/coze-studio）在路由层集成，通过 React Router 配置对应 path 后直接渲染上述页面组件。
  - 列表数据与业务字段来自后端统一产品域 API（@coze-arch/bot-api / @coze-studio/api-schema.explore）。
- 高层次数据流：
  - 路由参数 & URL 查询（react-router-dom + @ahooksjs/use-url-state） → 本包 hooks / store 解析 → 通过 bot-api 请求后端 → 使用 @coze-community/components 渲染卡片、列表和搜索组件。

## 2. 代码结构与关键模块

- [src/index.tsx](src/index.tsx)
  - 包入口，集中导出 ExploreSubMenu, SearchPage, PluginPage, TemplatePage 供上层使用。
- [src/components/sub-menu](src/components/sub-menu)
  - ExploreSubMenu：发现域的侧边子菜单。
  - 依赖 useExploreRoute 判断当前选中态，内部配置菜单项与文案，不直接依赖路由实现细节。
- [src/pages/search](src/pages/search)
  - SearchPage：复杂度最高的页面，负责产品搜索、筛选和无限滚动加载。
  - search-store.ts：使用 zustand 管理搜索条件、排序和统计数据，是搜索页面的状态单一来源。
  - config.ts / type.ts：定义筛选配置、默认值及类型。
  - index.module.less：页面布局与响应式样式。
- [src/pages/plugin](src/pages/plugin)
  - PluginPage：插件发现页，基于 PageList 与 @coze-community/components 中的 PluginCard 渲染。
  - 通过 api-schema.explore.PublicGetMarketPluginConfig / PublicGetProductList 拉取插件列表和 SaaS 插件开关。
- [src/pages/template](src/pages/template)
  - TemplatePage：模板发现页，同样基于 PageList 与 TemplateCard 渲染，仅做一次性列表加载，无滚动翻页。
- [src/components/page-list](src/components/page-list)（及 plugin-page-list、search 子目录）
  - 封装通用的分页/滚动列表 UI 与骨架屏，SearchPage / PluginPage / TemplatePage 复用这套基础结构。
- [src/hooks/use-explore-route.ts](src/hooks/use-explore-route.ts)
  - 对 @coze-arch/bot-hooks.useRouteConfig 的轻量封装，声明 ExploreRouteType，并额外附加 type: 'template' | 'plugin'。
  - ExploreSubMenu 依赖此 hook 获取当前路由配置与 type 字段，从而判定菜单高亮。
- 配置文件：
  - tsconfig.json / tsconfig.build.json / tsconfig.misc.json：采用项目统一 TS 配置，通过 references 接入顶层构建。
  - vitest.config.ts：使用 @coze-arch/vitest-config，preset 为 web。
  - eslint.config.js / .stylelintrc.js：统一继承 @coze-arch/eslint-config 与 @coze-arch/stylelint-config。

## 3. 关键页面与状态流

### 3.1 ExploreSubMenu（子菜单）

- 文件： [src/components/sub-menu/index.tsx](src/components/sub-menu/index.tsx)
- 行为与数据流：
  - 使用 useExploreRoute 读取当前路由的 type 字段（plugin/template）。
  - 本地 getMenuConfig 定义菜单项，包括 type、图标、I18n 文案与跳转 path（/explore/plugin、/explore/template）。
  - 通过 react-router-dom.useNavigate 实现点击导航，并使用 @coze-community/components.SubMenuItem 统一渲染样式。
- 结构约束：
  - 菜单的路由 path 字面量与上层路由配置必须保持一致；调整 path 时需同步修改 router 与本组件配置。
  - type 字段与 useExploreRoute 返回类型 ExploreRouteType.type 强绑定，如新增 tab 类型需要同时更新二者。

### 3.2 SearchPage（搜索页）

- 文件： [src/pages/search/index.tsx](src/pages/search/index.tsx)
- 主要依赖：
  - 路由：react-router-dom.useParams 解析搜索词 :word。
  - 状态：useSearchStore（zustand），管理 sortType、searchFilter、totalCount 等。
  - 布局与 UI：@coze-arch/bot-semi.UILayout、@coze-arch/coze-design（Select, SideSheet, Space, Typography）、@coze-arch/bot-icons、@coze-arch/responsive-kit。
  - 业务 API：@coze-arch/bot-api.ProductApi.PublicSearchProduct（配合 product_api 类型与 product_common.SortType）。
  - 列表与卡片：@coze-community/components.InfiniteList、SearchCard、ResultWord、SearchFilterComponent、renderEmpty 等。
- 核心逻辑：
  - 通过 useEntityType（来自本包 hooks）区分搜索实体类型（如 Bot/Project）。Bot 类型与 Project 类型混排显示，但实体类型筛选由 filter 决定：
    - 若筛选项中存在 entity_types，则直接使用；
    - 否则默认 [Bot, Project]，实现混排。
  - fetchSearch 函数封装一次搜索请求：
    - 根据当前 sortType、searchFilter、entityType 构造请求参数。
    - 使用 query-string 对数组参数进行 comma 序列化，避免后端解析问题。
    - 更新 useSearchStore.totalCount（含将 Bot + Project 数量合并的逻辑）。
    - 返回 InfiniteList 需要的 { hasMore, list, nextPage } 结构。
  - UI 行为：
    - 使用 ahooks.useScroll 监听列表容器滚动，控制是否展示顶部分割线（isShowDivider）。
    - 使用 useMediaQuery + useIsResponsive + useSetResponsiveBodyStyle 处理移动端布局与 body 滚动锁定。
    - 在筛选 SideSheet 打开时，添加/移除 document.body 特定 class，禁止背景滚动。
- 响应式与交互特性：
  - 移动端（isResponsive 为 true）时，筛选面板使用 SideSheet 顶部下拉方式展示；
  - InfiniteList 提供 isNeedBtnLoadMore 等移动端专用配置。
- 约定：
  - reloadDeps：InfiniteList.scrollConf.reloadDeps 必须涵盖所有影响结果集的状态（sortType、searchFilter、searchWord、entityType），新增依赖时需同步更新。
  - ProductApi.PublicSearchProduct 的分页从 1 开始；内部通过 nextPage 字段管理自增。

### 3.3 useSearchStore（搜索状态）

- 文件： [src/pages/search/search-store.ts](src/pages/search/search-store.ts)
- 技术栈：使用 zustand.create 定义轻量状态容器，无中间件。
- 状态结构：
  - sortType：当前排序方式（0 表示默认，映射到 undefined）。
  - searchFilter：各实体类型的筛选条件，初始值来自 defaultEntitySearchFilterMap。
  - filterConfig：各实体类型的筛选配置（可用项等），来自 defaultEntityFilterConfigMap。
  - totalCount：各 ProductEntityType 对应的结果数量，Bot 数量会自动加上 Project 数量，用于「混排显示」。
  - pageNum：当前页码（供未来扩展使用）。
  - isClear：当前筛选是否处于「默认/已清空」状态，影响「清空」按钮样式。
- 行为约定：
  - updateSearchFilter / setFilterConfig 均通过浅拷贝与键合并方式更新，保证每个实体类型的 filter 与 config 结构稳定。
  - resetSearchFilter 仅重置 searchFilter，不会影响 totalCount 与 sortType，调用端需自行决定是否重置其他状态。
  - updateTotalCount 会重新计算 Bot 的数量 = Bot + Project；调用端不需要关心此细节，只要传入后端原始计数即可。

### 3.4 PluginPage & TemplatePage

- PluginPage： [src/pages/plugin/index.tsx](src/pages/plugin/index.tsx)
  - 用 ahooks.useRequest 包装 explore.PublicGetMarketPluginConfig 请求，获取 enable_saas_plugin 配置，以控制「Coze 插件」Tab 是否展示。
  - 通过 useUrlState(tab) 将当前 Tab（Local/Coze）写入 URL 查询参数，在刷新或分享链接时仍然可还原状态。
  - getPluginData：按页拉取插件列表（PublicGetProductList），结合 Tab 决定 entity_type（Plugin 或 SaasPlugin）。
  - 自定义顶部区域 customFilters：
    - TabBar 用于切换本地插件 / Coze 插件。
    - Coze 插件 Tab 下展示「用量查看」弹窗按钮；本地插件下展示「配置 coze.cn 插件」文档入口按钮（直接 window.open GitHub Wiki）。
- TemplatePage： [src/pages/template/index.tsx](src/pages/template/index.tsx)
  - 通过 explore.PublicGetProductList 以 TemplateCommon 类型一次性拉取模板列表（page_size=1000）。
  - 使用 PageList 渲染，无滚动分页逻辑，相对简单。

## 4. 开发工作流与命令

- 包级 npm 脚本（见 [package.json](package.json)）：
  - build：exit 0；构建通常由上层应用或打包系统统一处理，本包不单独打包产物。
  - lint：eslint ./ --cache；规则来源于 @coze-arch/eslint-config。
  - test：vitest --run --passWithNoTests；使用 vitest 运行单元测试。
  - test:cov：在 test 基础上增加 --coverage，生成覆盖率报告。
- 在 monorepo 中使用：
  - 依赖安装：在仓库根目录执行 rush install / rush update。
  - 仅针对本包运行脚本：根据 Rush 配置，可使用 rushx test --to @coze-community/explore 或在 frontend 层通过 rushx 运行本包脚本。
  - 真正的页面开发与联调通常在应用层（如 apps/coze-studio）通过 rushx dev / rushx start 完成，本包组件被应用路由引入后即可联调。

## 5. 项目特有约定与模式

### 5.1 路由与子菜单协同

- ExploreSubMenu 与上层路由需要遵守以下约定：
  - 菜单配置中的 path（/explore/plugin、/explore/template）与 router 中的 path 必须一一对应。
  - useExploreRoute 返回值中应包含 type: 'plugin' | 'template'；高亮逻辑完全基于 type 字段，避免直接解析 URL。
  - 新增「发现」子页时，推荐做法：
    - 在 use-explore-route 中扩展 ExploreRouteType.type 联合类型；
    - 在 sub-menu/getMenuConfig 中增加菜单项；
    - 在 router 中增加对应 path 并渲染新页面组件。

### 5.2 搜索过滤与统计的统一来源

- SearchPage 中所有与搜索条件（sortType、searchFilter、entityType）和统计（totalCount）相关的逻辑，统一通过 useSearchStore 管理：
  - 不建议在组件内部维护平行的 useState，用 zustand state 作为唯一真源。
  - 筛选条件与配置使用 entityType 作为 key：若新增实体类型（例如新的 ProductEntityType），需在 defaultEntitySearchFilterMap / defaultEntityFilterConfigMap / defaultEntityNumMap 等处补全。
  - 统计逻辑（Bot + Project 混排）封装在 updateTotalCount 内部，避免在多个调用点重复编写累加逻辑。

### 5.3 国际化与文案

- 所有文案通过 @coze-arch/i18n.I18n.t 调用，不直接写死字符串（部分中文文案在 PluginPage 的 Tab 文案中为特殊情况，后续如需要国际化应迁移到 I18n）。
- 搜索与插件/模板相关 key 需与后端 / 其他前端包协同（如 'Plugins', 'template_name', 'store_search_filter' 等）。

### 5.4 响应式和移动端行为

- SearchPage 使用 @coze-arch/responsive-kit 与 @coze-arch/bot-hooks（useIsResponsive、useSetResponsiveBodyStyle）实现统一响应式行为：
  - 移动端下筛选面板以 SideSheet 形式从顶部滑出；
  - 打开时给 body 添加禁止滚动的 class，关闭后移除；
  - InfiniteList 的 isNeedBtnLoadMore, isResponsive, responsiveConf 等参数必须与样式、设计保持同步。
- 如在其他页面中复用类似行为，优先调用相同的 responsive hook 与样式模式。

## 6. 外部依赖与集成要点

- @coze-arch/bot-api & @coze-studio/api-schema.explore
  - 提供产品/插件/模板的类型定义与请求函数，当前使用的接口包括：
    - ProductApi.PublicSearchProduct：搜索产品列表，支持分页与多实体类型混排。
    - explore.PublicGetProductList：获取插件/模板列表。
    - explore.PublicGetMarketPluginConfig：获取市场插件配置（enable_saas_plugin）。
  - 在新增调用时，应遵守现有参数命名与分页/排序约定，优先使用已有枚举类型（SortType, ProductEntityType）。
- @coze-community/components
  - SubMenuItem、InfiniteList、SearchCard、TemplateCard、PluginCard、SearchInput 等为统一样式组件。
  - InfiniteList 的 loadData 需返回 { hasMore, list, nextPage } 结构；renderEmpty 和 renderFooter 需保持与现有使用方式一致。
- @coze-arch/bot-hooks
  - useLoggedIn：判断用户登录态，SearchPage 用于控制搜索页头部行为。
  - useRouteConfig / useExploreRoute：用于从全局路由表中读取配置并注入页面。
- @ahooksjs/use-url-state
  - 在 PluginPage 中用于将当前 tab 写入 URL；如新增其他基于 URL 的 UI 状态，优先使用此 hook 保持行为一致。

## 7. 协作建议（面向 AI 助手）

- 在本子包中新增页面时：
  - 复用已有的 PageList / InfiniteList / SearchStore 模式，避免在组件内重新实现分页和筛选状态。
  - 根据页面类型选择合适的卡片组件（TemplateCard、PluginCard、SearchCard 等），并保持数据结构兼容。
- 修改搜索/筛选逻辑时：
  - 优先修改 search-store.ts 中的默认配置与更新逻辑，再在 SearchPage 中通过 props 或 reloadDeps 触发刷新。
  - 注意维护 entityType 与 ProductEntityType 的对应关系，以及 Bot/Project 混排数量计算逻辑。
- 扩展 Explore 子菜单或路由：
  - 同时更新 use-explore-route、sub-menu/getMenuConfig 与上层路由配置，避免出现菜单可见但无路由或路由存在但不可达的情况。
