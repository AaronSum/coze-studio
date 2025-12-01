# @coze-agent-ide/plugin-modal-adapter 开发指南（AI 助手专用）

本说明用于指导 AI 编程助手在本子包（frontend/packages/agent-ide/plugin-modal-adapter）中安全、高效地协作开发。

## 全局架构与职责边界

- 本包是 Agent IDE 中「插件相关弹窗/面板」的 UI 适配层，提供一组对外可复用的 React 组件：
  - PluginPanel（来自 @coze-agent-ide/plugin-shared 的轻封装）
  - PluginFilter（左侧筛选入口列表）
  - PluginModalFilter（弹窗顶部的排序筛选区域）
- 入口文件 src/index.ts 只做类型与组件的聚合导出，不包含业务逻辑：
  - 从 ./components/plugin-modal/plugin-filter 导出 PluginFilter / PluginFilterProps
  - 从 ./components/plugin-modal/filter 导出 PluginModalFilter / PluginModalFilterProp
  - 从 ./components/plugin-panel 导出 PluginPanel / PluginPanelProps
- 组件自身不直接管理插件列表数据，只负责：
  - 触发筛选条件变更（如插件来源、空间类型、排序方式）
  - 根据外部传入的 query/type 渲染当前选中态
  - 调用上游传入的回调（如 setQuery、onChange），由上层业务统一拉取数据与刷新视图
- 数据与类型依赖强依赖其他 workspace 包：
  - @coze-agent-ide/plugin-shared：插件 filter 类型、默认分类、公共 Panel 组件等
  - @coze-arch/bot-api、@coze-studio/api-schema：后端接口与枚举（OrderBy、SpaceType、Int64、explore.PublicGetMarketPluginConfig 等）
  - @coze-arch/bot-studio-store：当前空间信息（space.space_type）
  - @coze-arch/i18n：全局多语言文案 I18n.t
  - @coze-arch/bot-semi：设计体系 UI 组件（UISelect、UICompositionModalSider 等）
- 样式使用 CSS Modules + less：
  - 组件通过 import s from './xxx.module.less' 引入类名
  - 访问方式统一使用 s['class-name']，并结合 classnames 做状态控制

## 关键组件设计要点

- components/plugin-panel/index.tsx
  - 只是对 @coze-agent-ide/plugin-shared 中 PluginPanel 的包装：
    - 重新导出 PluginPanel
    - 将 Props 定义为 Omit<BaseProps, 'slot'>，屏蔽 slot 属性，约束下游使用方式
  - 扩展 Panel 时，应在 plugin-shared 中改造，保持本包仅做 API 收敛/约束，而不复制实现。

- components/plugin-modal/filter/index.tsx（PluginModalFilter）
  - 接口：
    - query: PluginQuery
    - setQuery: (value: Partial<PluginQuery>, refreshPage?: boolean) => void
    - from?: From
  - 内部根据 query.type（PluginFilterType）决定是否渲染排序下拉框：
    - Mine / Team / Project 三种类型展示排序 UI
    - 其他类型返回 null，不展示
  - 排序项：
    - 根据 OrderBy.CreateTime / OrderBy.UpdateTime 构建 timeOptions
    - 使用 I18n.t('Create_time')、I18n.t('Update_time') 取多语言文案
  - 交互逻辑：
    - onChange 时仅调用 setQuery({ orderBy: v })，不直接触发数据请求
    - 是否需要 refreshPage 由外层决定；本组件只透传参数，不内嵌网络逻辑

- components/plugin-modal/plugin-filter/index.tsx（PluginFilter）
  - 入口 props：
    - isSearching: boolean   // 是否处于搜索态
    - type: Int64            // 当前选中的插件分类/来源 id
    - onChange: (type: Int64) => void
    - projectId?: string
    - from?: From
    - isShowStorePlugin?: boolean（默认 true）
  - 与外部协作：
    - 通过 useSpaceStore 获取 space.space_type，决定是否展示「我的插件」入口
    - 通过 explore.PublicGetMarketPluginConfig 接口获取 enable_saas_plugin，决定是否展示 SaaS 插件入口
    - 通过 getDefaultPluginCategory().id 获取默认「探索插件」入口 id
  - 交互约束：
    - onChangeAfterDiff：
      - 若 isSearching === true，则仍然允许切换类型，但注释说明此时保持搜索框文案（上层可据此决定是否清空搜索）
      - 若新类型与当前 type 相同，则不触发 onChange，避免无效刷新
  - 视图结构：
    - 依据 spaceType === SpaceType.Personal 决定是否渲染「我的工具」入口
    - 若 projectId 且 from === From.ProjectWorkflow，则增加项目工具入口
    - 当 isShowStorePlugin 为 true 时：
      - 插入 UICompositionModalSider.Divider 作为分割线
      - 渲染「探索工具」入口
      - 若 enable_saas_plugin 为真，再渲染 Coze.cn 插件入口
    - 所有入口均使用 data-testid / classNames 控制态（便于测试与样式调整）

## 构建、测试与开发工作流

- 包级脚本（见 package.json）：
  - lint: 使用 eslint 对当前目录所有文件检查，带缓存：
    - npm run lint
  - test: 使用 vitest 运行单测：
    - npm test
  - test:cov: 运行测试并生成覆盖率：
    - npm run test:cov
  - build: 当前实现为 "exit 0"，即构建占位，不在此包产生真实 build 产物；实际打包通常交由上层 Rush / 构建体系处理。
- 测试配置：
  - vitest 使用 @coze-arch/vitest-config 的统一预设：
    - vitest.config.ts 中通过 defineConfig({ dirname: __dirname, preset: 'web' }) 集中管理 jsdom / alias 等通用配置
  - 若编写新测试文件：
    - 放在 __tests__ 目录或与组件同级，遵循 vitest 默认匹配规则
    - 尽量使用 Testing Library（@testing-library/react）验证交互与可见文案
- Storybook：
  - 本包支持使用 Storybook 展示组件：
    - 配置文件位于 .storybook/main.js 与 .storybook/preview.js
    - 采用 @storybook/react-vite，最终通过 viteFinal 合并 vite 插件：
      - 使用 vite-plugin-svgr 处理 svg 资源
    - 需要时可在 ../stories 下增加 *.stories.tsx 或 mdx 作为交互文档
  - 运行方式：通常由 workspace 顶层脚本统一启动 Storybook；若需要在本包单独调试，请参考 frontend/README.md 或团队约定的 rushx 命令。
- Monorepo 级别命令（参考根目录与 frontend/README）：
  - 初始化依赖：
    - rush update
  - 前端整体开发/调试通常通过根目录 scripts 或 frontend/apps 的应用来引用本包组件，而不是在本包直接运行 dev 服务器。

## 代码风格与项目约定

- 语言与框架：
  - 使用 TypeScript + React 18（函数组件 + FC 类型）
  - 禁止在本包中直接使用 any；应尽量复用上游 @coze-* typings
- 样式：
  - 必须使用 .module.less + CSS Modules
  - 类名风格统一使用 kebab-case，并通过 s['class-name'] 访问
  - 复杂状态需结合 classnames 实现，不直接字符串拼接
- 国际化：
  - 所有展示文案必须通过 I18n.t(key) 调用
  - 不应在组件中写死中文/英文字符串（现有 Coze.cn 插件文案为例外历史包袱，如需调整需评估上游）
- 状态与副作用：
  - 组件自身应保持「纯 UI」属性：
    - 使用 props 透传 query、type 等状态
    - 通过回调 onChange / setQuery 通知上层，不直接管理列表数据
  - 仅允许在需要运行时配置的场景使用 ahooks/useRequest（如获取 enable_saas_plugin），并限制在局部组件内部
- 类型与常量：
  - PluginFilterType、From、PluginQuery 等必须从 @coze-agent-ide/plugin-shared 统一引入
  - SpaceType、Int64、OrderBy 等来自 @coze-arch/bot-api/developer_api
  - 若需要新增筛选类型或来源：
    - 优先在 plugin-shared / bot-api 层面增加枚举与类型
    - 然后在本包组件中按已有分支模式扩展

## 依赖与外部集成细节

- @coze-agent-ide/plugin-shared
  - 提供：
    - PluginPanel 及其基础 Props
    - PluginFilterType / From / PluginQuery / getDefaultPluginCategory
  - 本包的核心职责是基于这些抽象，提供特定场景下的 UI adaptors，而不是重写业务逻辑。

- @coze-arch/bot-api & @coze-studio/api-schema
  - developer_api：提供后端 gRPC / HTTP 接口映射类型与枚举（OrderBy、SpaceType、Int64 等）
  - explore.PublicGetMarketPluginConfig：
    - 用于判断是否开启 SaaS 插件市场
    - 使用 ahooks/useRequest 包裹异步调用，内部返回布尔值 enable_saas_plugin

- @coze-arch/bot-studio-store
  - 通过 useSpaceStore(store => store.space.space_type) 获取当前空间类型
  - SpaceType.Personal 场景下展示「我的工具」，团队/项目空间行为由上层业务约定

- UI 组件库
  - @coze-arch/bot-semi：半定制的 Semi UI 封装
    - UISelect：带 label 的下拉选择器
    - UICompositionModalSider：弹窗侧边栏框架，Divider 用于分割内容区
  - @coze-arch/coze-design & @coze-arch/bot-icons：统一图标源
    - 使用 Icon* 组件时保持命名与设计稿一致

## 开发流程、分支与发布

- 分支/提交规范：
  - 以 monorepo/Rush 为核心管理，具体分支策略在仓库根部文档（README / CONTRIBUTING）中约定；在本包开发时遵循统一策略即可。
  - 修改本包组件时，尽量保持改动局部化，并同时检查 @coze-agent-ide/plugin-shared 等上游包的契约是否被破坏。
- 发布与集成：
  - 本包通过 rush + workspace 协议与其他 packages 一起构建与发布
  - 版本号当前为 0.0.1，多为内部组件库使用；实际对外发布节奏受整体前端工程控制

## 对 AI 助手的特别提示

- 修改现有组件行为前，请先搜索 @coze-agent-ide/plugin-modal-adapter 在其他应用中的使用方式，避免破坏上游依赖：
  - 重点关注 PluginPanel / PluginFilter / PluginModalFilter 的 Props 是否兼容
- 若需要新增筛选项或入口：
  - 先在 @coze-agent-ide/plugin-shared 与 @coze-arch/bot-api 中对齐类型与枚举
  - 然后在本包按照现有分支模式扩展 UI 与交互
- 写测试或 Story 时：
  - 避免依赖真实后端，只 mock explore.PublicGetMarketPluginConfig 与 store 即可
  - 优先通过 data-testid 与文案断言 UI 状态
- 避免在本包中新增全局状态或网络层封装，保持其定位为「UI 适配层」，将复杂业务/数据流放在上游应用或 shared 层实现。