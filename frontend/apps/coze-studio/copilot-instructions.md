# Copilot 使用说明（@coze-studio/app）

本说明用于指导 AI 编程助手在本子包（frontend/apps/coze-studio）中安全、高效地协作开发。

## 全局架构与职责边界

- 本子包是 Coze Studio Web 前端主应用，位于 monorepo 顶层 frontend/apps/coze-studio，作为壳应用（shell app）聚合各 workspace/*、agent-ide/*、project-ide/* 子包能力。
- 技术栈：React 18 + React Router v6（data router API）+ rsbuild/rspack 构建，样式体系使用 tailwindcss + global.less/index.less + 业务各包自己的样式。
- 入口层：
  - src/index.tsx：负责初始化特性开关（@coze-arch/bot-flags）、i18n（@coze-arch/i18n）、MD 组件样式，并挂载 React 根节点。
  - src/app.tsx：挂载 RouterProvider，并通过 Suspense + @coze-arch/coze-design 的 Spin 实现全局懒加载状态。
  - src/layout.tsx：封装 GlobalLayout + useAppInit，统一全局布局/初始化（账号、空间、主题等均在 @coze-foundation/global-adapter 中处理）。
- 路由层：
  - src/routes/index.tsx 定义整个应用的路由树，使用 createBrowserRouter：
    - 顶层 Layout 负责全局错误展示（GlobalError）和 children 嵌套路由。
    - /space/* 为工作空间主入口，内部再分 develop、bot（Agent IDE）、project-ide、library、knowledge、database、plugin 等子模块。
    - /work_flow、/search、/explore 等模块提供工作流、全局搜索和探索页。
    - /open/docs/*、/docs/*、/information/auth/success 等路由统一走 Redirect 页面。
  - src/routes/async-components.tsx 将绝大部分业务页面通过 React.lazy 按需加载，真正的业务 UI 由 workspace-adapter、agent-ide、project-ide、community/explore 等子包提供，本 app 只负责装配与路由。
- 页面层：
  - src/pages/develop.tsx、src/pages/library.tsx 等仅做轻薄的路由参数解析（useParams）+ 渲染对应 adapter（例如 @coze-studio/workspace-adapter/develop、library）。
  - src/pages/plugin/* 提供插件详情/工具页路由壳，与 @coze-studio/workspace-base、@coze-studio/plugin-* 等包对接。
- 配置与构建层：
  - rsbuild.config.ts 使用 @coze-arch/rsbuild-config 包装，统一接入公司内部构建规范，扩展 rspack / PostCSS、别名、环境变量注入、代理配置等。
  - vitest.config.ts 和 eslint.config.js 依赖 @coze-arch/* 配置包，保证测试、lint 行为与整个 monorepo 一致。

## 构建、运行、测试与调试

- 所有命令在本子包根目录（frontend/apps/coze-studio）执行，通常通过 rush：
  - 开发：rushx dev
    - 等价于在 package 内执行 IS_OPEN_SOURCE=true CUSTOM_VERSION=release rsbuild dev。
    - Web 服务默认端口由 rsbuild 决定，后端 API 通过 rsbuild.config.ts 中的 proxy 转发至 http://localhost:${WEB_SERVER_PORT || 8888}/。
  - 构建：rushx build
    - 调用 IS_OPEN_SOURCE=true rsbuild build，产物输出路径由 rsbuild-config 统一管理（无需在本包内硬编码）。
  - 预览：rushx preview
    - 使用 rsbuild preview 本地起静态资源预览服务，适合验证生产构建结果。
  - 单测：rushx test 或 rushx test:cov
    - 使用 Vitest，配置来自 @coze-arch/vitest-config（preset:web），默认启用 jsdom 环境、React 相关测试预设。
  - Lint：rushx lint
    - 使用 ESLint，配置由 @coze-arch/eslint-config 提供 preset:web，packageRoot=本目录，用于自动解析 ts/tsx、React Hooks 规则等。
- 调试路由和数据：
  - 路由关键文件为 src/routes/index.tsx 和 src/routes/async-components.tsx；新增或修改页面时，需同时更新这两处（路由树 + 懒加载组件）。
  - 路由 loader 返回的对象（例如 hasSider、requireAuth、subMenu、menuKey、pageName 等）由 layout/global 框架消费，控制侧边栏显示、鉴权、移动端提示等；在新增路由时保持字段语义一致，不要随意更改字段名。
  - 绝大部分业务数据（空间、Agent、工程、插件、知识库、数据库等）均在各 adapter 包内部通过统一的数据层访问，本子包只透传必要的参数（如 spaceId、bot_id、project_id）。

## 项目特有约定与模式

- 模块职责划分：
  - 本 app 不直接实现业务 UI 与数据逻辑，而是将 workspace、agent-ide、project-ide、knowledge、plugin、explore 等拆分成独立子包，通过 workspace-adapter、agent-ide/*、community/* 等包暴露 React 组件接口；本 app 仅负责：
    - 统一路由与导航结构。
    - 传递 URL 参数（space_id、bot_id、project_id、dataset_id、table_id、plugin_id、tool_id 等）。
    - 管理全局 layout、错误边界与 loading 体验。
  - 新业务（或页面）优先考虑在对应子包中实现 UI + 逻辑，然后在本 app 中以“轻壳”形式装配。
- 路由与懒加载约定：
  - src/routes/async-components.tsx 中所有导出均为 React.lazy 包装后的组件引用，原始组件来自外部包或 src/pages；路径命名以使用场景为主（LoginPage、SpaceLayout、AgentIDE、WorkflowPage 等）。
  - src/routes/index.tsx 中构建 createBrowserRouter 路由树时，一律使用 Component/element/loader 写法，不直接在此处引入外部包，避免打包体积过大；业务组件均从 async-components.tsx 引入。
  - explore 相关路由在 src/routes/index.tsx 与 src/pages/explore.tsx 中均有定义（前者直接使用 async-components 引入 ExplorePluginPage/ExploreTemplatePage，后者导出 exploreRouter 供其它应用/场景复用），保持两者逻辑一致。
- loader 约定：
  - 路由 loader 返回的对象结构并未在本包定义类型，而是由上层 layout/global 系统约束；常见字段：
    - hasSider：是否显示左侧导航。
    - requireAuth：是否需要登录态。
    - subMenu/subMenuKey/menuKey：空间/探索等模块的子菜单与选中态。
    - showMobileTips：是否在移动端显示不支持提示。
    - requireBotEditorInit/pageName/pageModeByQuery 等：特定模块的行为控制。
  - 在新增 loader 字段时，优先搜索其它路由使用方式，保持风格与语义一致。
- 参数透传模式：
  - 所有基于 space 的页面统一使用 URL 中的 :space_id 段，通过 useParams 解析后传给对应 adapter 组件：
    - 例：src/pages/develop.tsx、src/pages/library.tsx。
  - 其他资源（bot_id、project_id、dataset_id、table_id、plugin_id、tool_id 等）也通过 URL params 直接传入 adapter，页面组件中不做额外数据处理。
- 样式与 UI：
  - 全局样式入口为 src/global.less 与 src/index.less，配合 tailwind.config.ts 与 postcss.config.js；不要在单个页面随意重置全局样式。
  - UI 组件应优先使用 @coze-arch/coze-design 与各 adapter 内封装好的组件，而非直接引入第三方库重复造轮子。

## 关键依赖与集成点

- 构建/运行相关：
  - @coze-arch/rsbuild-config：封装 rsbuild 配置，统一 server/html/source/performance 等选项；本包只传入局部差异（如 html.title、proxy、import-watch-loader 规则）。
  - @coze-arch/import-watch-loader：rspack loader，用于对 TS/JS/CSS/LESS 等文件进行导入变更监听，配合 dev server 实现更稳定的热更新；rsbuild.config.ts 中对 apps/coze-studio/src/index.css、node_modules、packages/arch/i18n 做了排除。
  - tailwindcss：通过 tools.postcss 配置的 addPlugins(require('tailwindcss')('./tailwind.config.ts')) 接入；修改 tailwind 相关行为时优先调整 tailwind.config.ts。
  - path-browserify：在 rsbuild.config.ts 的 resolve.fallback 中将 path 指向浏览器版实现，方便前端代码中少量使用 path API。
- 全局状态与上下文：
  - @coze-foundation/global-adapter：提供 GlobalLayout 与 useAppInit，用于初始化账号、空间、全局 context 等；新增全局能力优先考虑在该包中扩展，而非在本 app 中堆逻辑。
  - @coze-arch/web-context：提供 BaseEnum 等全局枚举，路由 loader 中的 menuKey 等字段应使用这些枚举常量，避免 magic string。
  - @coze-foundation/space-ui-adapter / space-ui-base：负责空间相关布局与侧边栏；spaceSubMenu、SpaceLayout、SpaceIdLayout 均从这些包中懒加载。
- 功能模块适配器：
  - @coze-studio/workspace-adapter：提供工作区内各模块页面（Develop、Library 等），本 app 页面只负责从 URL 中取参数并直接渲染。
  - @coze-agent-ide/*：提供 Agent IDE 主编辑器、布局、发布页、各种调试工具等；相关路由主要在 /space/:space_id/bot/:bot_id/* 下配置。
  - @coze-project-ide/main、@coze-studio/project-publish：工程 IDE 与发布相关页面，通过 /space/:space_id/project-ide/:project_id/* 路由进来。
  - @coze-community/explore：探索页、插件/模板市场与搜索页共用此包组件；对应 exploreSubMenu、ExplorePluginPage、ExploreTemplatePage、SearchPage 等。
  - @coze-studio/workspace-base：知识库、数据库等资源的详情/上传等基础页面由此包提供，在 routes 中以 KnowledgePreview、KnowledgeUpload、DatabaseDetail 等形式接入。
- i18n & feature flags：
  - @coze-arch/i18n/raw：在 src/index.tsx 中通过 initI18nInstance 初始化语言，默认从 localStorage.i18next 或 IS_OVERSEA 环境变量推断中英文；新增语系/文案时，应在对应 i18n 包中处理，而非在本 app 中硬编码。
  - @coze-arch/bot-flags：pullFeatureFlags 负责初始化特性开关，目前 fetchFeatureGating 是一个返回空对象的占位实现；若接入真实配置，请在该包或上游统一扩展。
  - @coze-arch/bot-md-box-adapter：dynamicImportMdBoxStyle 用于按需加载 MD 渲染组件样式，避免初始包体过大。

## 团队流程与协作规范

- 分支与发布：
  - 具体分支策略在仓库根部 README/CONTRIBUTING/Makefile 中维护，本说明不重复；在修改本 app 行为时，需确保与上游各 adapter 包版本兼容（依赖均为 workspace:*，注意不要引入破坏性改动）。
  - 修改路由或全局 layout 时，优先评估对其它依赖此 app 的场景（如外部嵌入、历史链接）的影响，保持 URL 兼容或提供 Redirect 迁移策略。
- 代码风格与质量：
  - 严格遵从 @coze-arch/eslint-config 与 @coze-arch/ts-config 约束；新增文件应使用 TypeScript（.tsx/.ts），配合现有 tsconfig.build.json/tsconfig.misc.json 结构。
  - 统一使用 React 18 hooks 模式，组件函数命名保持 PascalCase，文件使用默认导出或具名导出时与当前文件风格保持一致。
  - 路由配置建议保持“结构从上到下、从常用到少用”的顺序；对复杂路由块（如 /space）尽量通过 children 结构清晰分组，而不要在多个文件中拆得过碎。

## 非常规特性与注意事项

- rsbuild.config.ts 中对 source.include 使用了 workspace 顶层路径与特定 node_modules 匹配（marked、@dagrejs、@tanstack），用于强制这些包参与转译以支持新语法特性（如私有方法）；如新增类似三方库，也应在此处添加正则匹配。
- rsbuild.config.ts 的 tools.rspack.ignoreWarnings 中存在一个始终返回 true 的函数，会吞掉所有 rspack 警告；在排查构建问题时需要注意这一点（必要时可暂时注释）。
- Decorators 使用 legacy 版本（source.decorators.version = 'legacy'），用于兼容 inversify 等依赖；在新增使用装饰器的代码时，确保遵循该模式，不要混用 stage-3 装饰器语义。
- 全局环境变量通过 source.define 注入 process.env.*，包括 IS_REACT18、ARCOSITE_SDK_REGION/SCOPE、TARO_*、RUNTIME_ENTRY、ENABLE_COVERAGE 等；前端代码中若依赖这些变量，需要保证值能在构建阶段静态替换（使用 process.env.KEY，而不是动态访问）。
- 探索/插件等模块的路由结构在多个地方复用（routes/index.tsx 与 pages/explore.tsx），在修改相关路径或 loader 参数时，请同步更新两个文件，避免行为偏差。
