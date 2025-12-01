# @coze-studio/workspace-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/workspace/entry-adapter）中安全、高效地协作开发。

## 全局架构与角色定位

- 本子包位于 Coze Studio 前端 monorepo 的「Studio Workspace」层，职责是为 Studio 工作空间的菜单入口提供页面适配层，而非承载完整业务逻辑。
- 从 package.json 可知：
  - 导出两个入口：`./develop` 与 `./library`，分别映射到 src/pages/develop/index.tsx 与 src/pages/library/index.tsx，用于不同工作空间子路由（开发列表页、资源库页）。
  - `main` 指向 src/index.ts，目前仅包含版权头，可视为保留占位符，未来可能扩展公共导出。
- 核心业务逻辑全部下沉在依赖包：
  - `@coze-studio/workspace-base/develop` 提供开发页的布局组件、列表数据 hooks、筛选器常量、交互动作等。
  - `@coze-studio/workspace-base/library` 提供资源库页的基础容器和各实体（插件、工作流、知识库、Prompt、数据库等）配置 hooks。
  - `@coze-foundation/space-store-adapter` 提供当前空间信息（如个人空间 / 团队空间）。
  - `@coze-arch/idl/intelligence_api` 定义智能体/工程项（Intelligence）的服务枚举与搜索参数。
  - `@coze-arch/i18n`、`@coze-arch/coze-design`、`@coze-arch/bot-api`、`@coze-arch/bot-tea` 等负责 UI 与埋点。
- 本包整体可以理解为：
  - 在 workspace-base 提供的通用组件之上，组合工作空间入口所需的筛选、搜索、列表与空状态展示。
  - 对外暴露的唯一“能力”是 React 页面组件（Develop / Library），由上层应用（如 studio app 或 iframe 容器）通过包名+子路径引入渲染。

## 目录结构与关键文件

- package.json
  - `name`: `@coze-studio/workspace-adapter`。
  - `scripts`：
    - `build` / `dev`: 当前为 `exit 0`，说明本包不单独参与本地构建/启动流程，而是由上游应用统一构建。
    - `lint`: `eslint ./ --cache`，使用 monorepo 统一 ESLint 配置。
    - `test`: `vitest --run --passWithNoTests`，Vitest 单测；`test:cov` 生成覆盖率。
  - `dependencies`：集中体现本包对 workspace-base、space-store-adapter、i18n、bot-api、bot-tea 等内部包以及 UI 组件库 (coze-design) 的依赖，是理解数据来源与 UI 组合方式的关键。
  - `peerDependencies`: 依赖宿主项目提供 React/ReactDOM >=18.2.0。
- tsconfig.json
  - 仅声明 `composite: true` 与 references（tsconfig.build.json、tsconfig.misc.json），用于支持 TypeScript project references；真实编译选项在 tsconfig.build.json 中由 `@coze-arch/ts-config/tsconfig.web.json` 继承。
- tsconfig.build.json
  - `jsx: "react-jsx"`、`module: "ESNext"`、`moduleResolution: "bundler"`，适配 rsbuild/rspack bundler。
  - `include: ["src"]`，`outDir: dist` 仅作 tsc 输出目录约定，当前 build 脚本未实际使用。
  - references 指向多个上游依赖包（bot-api / bot-tea / bot-typings / i18n / idl / ts-config / vitest-config / entry-base / space-store-adapter），用于 TS 增量编译。
- eslint.config.js
  - 通过 `@coze-arch/eslint-config` 的 `defineConfig({ packageRoot: __dirname, preset: 'web' })` 复用统一前端规范。
- vitest.config.ts
  - 使用 `@coze-arch/vitest-config` 的 `defineConfig({ dirname: __dirname, preset: 'web' })`，与其他 web 子包保持一致；如需调整测试环境，建议在此基础上通过 options 增量配置。
- src/index.ts
  - 当前仅包含版权 License 头，没有导出逻辑；如需新增公共导出，请在此集中导出页面组件或类型，保持单一入口。
- src/pages/library/index.tsx
  - 核心组件 `LibraryPage: FC<{ spaceId: string }>`：
    - 依赖 `@coze-studio/workspace-base/library`：`BaseLibraryPage` 与 `use*Config` 系列 hooks。
    - 使用 `useRef` 拿到 `BaseLibraryPage` 的 `reloadList` 方法，自定义 `configCommonParams`（`spaceId` + `reloadList`）传给各类配置 hooks：
      - `usePluginConfig`
      - `useWorkflowConfig`
      - `useKnowledgeConfig`
      - `usePromptConfig`
      - `useDatabaseConfig`
    - 从每个 hook 中解构 `config` 与 `modals`，将所有 `config` 组合成 `entityConfigs` 传给 `BaseLibraryPage`，并在底部依次渲染对应 `modals`：
      - 这是 workspace-base 定义的一种「配置 + 弹窗组件」模式，本包只负责组合与透传。
- src/pages/develop/index.tsx
  - 核心组件 `Develop: FC<DevelopProps>`（`DevelopProps` 来自 `@coze-studio/workspace-base/develop`）：
    - 利用 `useSpaceStore` 获取当前空间是否为 Personal，用以控制筛选范围与埋点参数。
    - 使用 `useCachedQueryParams` 管理查询参数（搜索词、类型、发布状态、最近打开、搜索范围等），并从 `isFilterHighlight()` 中派生出多种高亮状态以驱动筛选器 UI。
    - 使用 `useIntelligenceList` 获取智能体/项目列表：
      - 请求参数中组合空间 id、搜索关键字、类型转换 (`getTypeRequestParams`)、发布状态 (`getPublishRequestParam`)、最近打开标记 (`recentlyOpen`)、搜索范围 (`searchScope`) 以及排序字段 (`orderBy`)；
      - orderBy 根据是否勾选“已发布”决定使用 `search.OrderBy.PublishTime` 或 `search.OrderBy.UpdateTime`。
    - 通过 `useGlobalEventListeners({ reload, spaceId })` 监听全局事件触发列表刷新。
    - 使用 `useProjectCopyPolling` 对列表中的复制状态进行轮询更新。
    - 使用 `useCardActions` 与 `useIntelligenceActions` 管理卡片操作（复制、删除、点击打开等）与创建入口：
      - 删除时根据 `IntelligenceType` 区分 Bot 与 Project，分别调用带 `spaceId` 或 `projectId` 的删除逻辑。
    - 通过多组 UI 组件渲染页面结构：
      - `Layout / Header / SubHeader / Content` 等由 workspace-base 提供。
      - 使用 `Select` 配合 `TYPE_FILTER_OPTIONS` / `CREATOR_FILTER_OPTIONS` / `STATUS_FILTER_OPTIONS` 实现类型、创建者、状态筛选，并在 onChange 中发送 `sendTeaEvent(EVENT_NAMES.workspace_action_front, {...})` 埋点。
      - 顶部 Search 组件联动 `debouncedSetSearchValue` 实现防抖搜索。
      - 使用 `WorkspaceEmpty` 在无数据时展示空状态，`hasFilter` 通过 `isEqualDefaultFilterParams` 判断当前是否为“有筛选条件”的空结果，并提供清除筛选回到 `FILTER_PARAMS_DEFAULT` 的操作。
      - 列表区域通过 `BotCard` 渲染每个智能体/项目卡片，结合多种 callback（复制、删除、更新、点击）和时间标签 `timePrefixType`（最近打开 / 发布 / 编辑）配置。
      - 加载状态由 `Spin` 与底部 Loading 占位控制，无更多数据时表现为占位空白高度。

## 运行与开发工作流

- 依赖安装
  - 在 monorepo 根目录执行 `rush update` 或运行脚本 [scripts/setup_fe.sh](scripts/setup_fe.sh)，以确保所有 `workspace:*` 内部依赖正确链接。
- 本包自身脚本
  - 由于 `build` / `dev` 均为 no-op，本包无法单独以 npm script 启动 UI；通常由上层 app（如某个 studio 应用）以 rsbuild/rsbuild-config 统一构建并加载此包导出的页面。
  - 在本目录可执行：
    - `npm run lint`：运行 ESLint 检查。
    - `npm test` 或 `npm run test:cov`：使用 Vitest 运行单测（当前 __tests__ 目录仅有 .gitkeep，可按需新增测试文件）。
- 调试页面逻辑
  - 调整页面 UI/行为后，通常需要：
    - 在上层应用项目（app）目录执行 `rushx dev` 或 README 中给出的 dev 命令。
    - 通过该应用暴露的路由访问 workspace develop/library 页面，验证筛选、搜索、复制、删除等行为是否符合预期。

## 项目特有约定与模式

- Workspace-base 驱动的「配置 + 容器」模式
  - Library 页面通过 `BaseLibraryPage + use*Config` 组合形成：
    - 每种实体的行为逻辑、接口定义、弹窗实现均在 workspace-base 内部封装，本包仅负责将 `spaceId` 与列表刷新回调 `reloadList` 向下传递，并串联所有 `config` 与 `modals`。
    - 扩展新的实体类型时，推荐先在 `@coze-studio/workspace-base/library` 中实现对应的 `useXxxConfig` 再在本包中追加组合，而不要在此包内直接写具体的接口请求与弹窗逻辑。
- 开发页的查询状态统一管理
  - 查询参数全部通过 `useCachedQueryParams` 维护，且需与 `FILTER_PARAMS_DEFAULT` / `isEqualDefaultFilterParams` 一致；
  - 新增筛选项时：
    - 需要在 workspace-base 的 `FILTER_PARAMS_DEFAULT` / `isFilterHighlight` / `TYPE_FILTER_OPTIONS` 等公共定义中先扩展；
    - 然后在本包中读取新的字段并在 UI 层增加对应 Select / 控件，保持“源定义在 base，展示及埋点在 adapter”的分工。
- 埋点与搜索逻辑
  - 埋点统一通过 `sendTeaEvent(EVENT_NAMES.workspace_action_front, {...})` 上报，参数中通常包含：
    - `space_id`, `space_type`（personal/teamspace）, `tab_name`（develop）、`action`（filter）、`filter_type` 与 `filter_name` 等。
  - 在添加新的交互埋点时，需保持参数结构与现有筛选的埋点一致，以便下游分析复用。
  - 搜索参数与排序字段依赖 `@coze-arch/idl/intelligence_api` 的枚举，修改时要确保仍符合后端服务接口要求。

## 重要依赖与集成细节

- `@coze-studio/workspace-base/develop`
  - 提供：布局组件、过滤常量、列表查询 hook、交互动作 hook、空状态组件等。
  - 本包中不应复制其内部逻辑，而是通过 props / hooks 组合使用；若需要扩展行为，应优先修改 workspace-base。
- `@coze-studio/workspace-base/library`
  - 通过 `BaseLibraryPage` 提供统一库页面容器，通过 `use*Config` 返回实体配置与弹窗。
  - `ref` 约定暴露 `reloadList` 方法，用于触发重新拉取列表；任何对列表刷新的需求（如新增实体后刷新列表）都应优先通过此方法，而非直接在此包内重写数据逻辑。
- `@coze-foundation/space-store-adapter`
  - 使用 `useSpaceStore` 获取当前空间类型（个人/团队），影响筛选项是否展示“创建人”维度以及埋点的 space_type 字段。
  - 在需要更多空间属性时，应统一通过该 store 读取，避免在本包中引入平行的空间管理状态。
- `@coze-arch/idl/intelligence_api`
  - 提供 `IntelligenceType`、`SearchScope`、`search.OrderBy` 等类型/枚举。
  - 删除/复制逻辑强依赖 `IntelligenceType` 区分 Bot 和 Project，修改时要注意兼容。
- `@coze-arch/i18n`
  - 所有可见文案通过 `I18n.t(key)` 获取；`filter_name` 埋点参数需借助选项中的 `labelI18NKey` 转换为展示名称。
  - 新增筛选项时，要确保对应 i18n key 已在语言包中存在。
- `@coze-arch/coze-design`
  - 提供 `Button`, `IconButton`, `Search`, `Select`, `Spin` 等 UI 组件；使用时遵循设计系统的样式与交互规范（例如使用 `IconCozLoading`, `IconCozPlus` 作为统一图标）。

## 协作流程与规范提示

- 变更影响面评估
  - 虽然本包代码量不大，但作为 workspace 的入口适配层，页面行为变更会直接影响用户在「开发」和「资源库」Tab 的体验：
    - 修改筛选条件、查询参数、排序逻辑或埋点字段时，应假设会影响埋点统计与后端 API 的调用；
    - 在 PR 描述中建议简要说明：
      - 变更了哪些筛选项/查询参数；
      - 是否影响埋点数据口径；
      - 是否需要后端配合修改接口或枚举。
- 与其他包的协作边界
  - 本包应尽量保持「薄适配层」，不要在这里新增大块业务逻辑或请求封装，避免与 workspace-base、数据层包职责重叠。
  - 新的通用逻辑建议先抽到 workspace-base（或其他合适的 shared 包）中再在此组合使用。
- 对 AI 助手的安全提示
  - 不要修改 tsconfig.build.json / vitest.config.ts / eslint.config.js 中的基础 preset 或引用路径，除非在全局范围内同步评估兼容性。
  - 不要在本包中直接引入新后端接口或服务 SDK，如确有需要，应先在相关 data/service 层包中完成封装。
  - 新增文件时优先遵循 monorepo 现有风格：
    - React 组件使用函数式组件 + hooks；
    - 样式优先通过 className + Tailwind/预设样式，而非内联 style（除非 workspace-base 明确要求）。
