# @coze-project-ide/biz-plugin-registry-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/project-ide/biz-plugin-registry-adapter）中安全、高效地协作开发。

## 1. 子包角色与全局架构

- 位置与包名：位于 frontend/packages/project-ide/biz-plugin-registry-adapter，对应 npm 包名 `@coze-project-ide/biz-plugin-registry-adapter`。
- 子域定位：属于「Project IDE」前端子域，用于在 IDE 布局系统中注册业务插件（biz plugin）主界面，是「插件业务模块」接入 Project IDE 的适配层。
- 对外 API 极精简：
  - src/index.ts 仅导出 `PluginWidgetRegistry`，作为 IDE 框架的 widget 注册描述对象。
  - 核心实现位于 src/registry.tsx，定义如何在布局系统中渲染插件页面及展示图标。
- 依赖的上游能力：
  - `@coze-project-ide/framework`：提供布局系统概念与类型（`LayoutPanelType`、`withLazyLoad`、`WidgetRegistry`），本包只做「声明接入」不修改框架行为。
  - `@coze-project-ide/biz-plugin`：实际的业务插件页面实现（路径 `@coze-project-ide/biz-plugin/main`），本子包只负责延迟加载并放入指定区域。
  - `@coze-arch/coze-design/icons`：使用 `IconCozPlugin` 作为该 widget 的图标，与 Studio 其他区域保持一致的视觉语言。

## 2. WidgetRegistry 与数据流

- `PluginWidgetRegistry`（见 src/registry.tsx）是本包唯一的主要导出，对应 `WidgetRegistry` 类型实例：
  - `match: /\/plugin\/.*/`：
    - 用正则匹配 IDE 路由或路径，当当前路径匹配 `/plugin/...` 时，由框架选择本 widget 作为主内容渲染器。
    - AI 在修改时应仅调整在确有需求的情况下（如需要扩展到更多路径），否则会影响 IDE 路由与插件入口对应关系。
  - `area: LayoutPanelType.MAIN_PANEL`：
    - 指定该 widget 渲染在主工作区面板（Main Panel），而不是侧栏或浮层。
    - 该枚举来自 `@coze-project-ide/framework`，如需更换区域，必须先确认框架支持并与产品确认布局设计。
  - `renderContent()`：
    - 使用 `withLazyLoad(() => import('@coze-project-ide/biz-plugin/main'))` 懒加载业务插件主组件：
      - `withLazyLoad`：由框架提供的 HOC，用于封装 React.lazy / Suspense 等懒加载逻辑，避免直接在适配层处理 loading/error 细节。
      - 内部 import 的是业务包的入口组件，返回值作为 React 组件使用：`return <Component />;`。
    - 这里不直接传递 props；业务插件如需路由信息、全局状态等上下文，由上层框架或 `@coze-project-ide/biz-plugin` 自行解决，本包不参与。
  - `renderIcon()`：
    - 返回 `<IconCozPlugin />`，用于 IDE 的侧边栏 / Tab / 面板标题等处显示图标。
    - 修改图标时需保证来源仍来自 `@coze-arch/coze-design/icons`，以遵守统一设计体系。
- 数据流特征：
  - 本包自身不维护业务状态，不直接发起网络请求；仅提供「路径 → 布局区域 → 懒加载组件 + 图标」的映射。
  - 所有业务数据流均发生在 `@coze-project-ide/biz-plugin` 及其依赖链中。

## 3. 构建、测试与开发流程

- 包级脚本（见 package.json）：
  - `build`: `exit 0`
    - 当前为占位命令，本包不在自身目录进行真实打包；类型构建和产物生成由上层 Rush/前端构建体系统一处理。
  - `lint`: `eslint ./ --cache`
    - 使用工作区统一 ESLint 配置 `@coze-arch/eslint-config`，preset 为 web。
  - `test`: `vitest --run --passWithNoTests`
  - `test:cov`: `npm run test -- --coverage`
    - 测试框架为 Vitest，配置从 `@coze-arch/vitest-config` 继承（参见 vitest.config.ts）。当前包暂无实质测试文件，命令主要用于保持流水线一致性。
- TypeScript 配置：
  - tsconfig.build.json：
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，`rootDir: src`，`outDir: dist`，`jsx: react-jsx`，`moduleResolution: bundler`，适配现代打包工具。
    - references 显式依赖：
      - `../../arch/bot-typings/tsconfig.build.json`
      - `../biz-plugin/tsconfig.build.json`
      - 若干 config 包（eslint-config/stylelint-config/ts-config/vitest-config）。
      - `../framework/tsconfig.build.json`
    - 增加新的上游 workspace 依赖时，如需在 TS project references 中建立依赖链，应同步更新此 references 列表，保证 Rush 的 `tsc --build` 顺序正确。
- 依赖与 peerDependencies：
  - 运行时依赖：
    - `@coze-project-ide/framework`：提供 WidgetRegistry 接口与布局枚举。
    - `@coze-project-ide/biz-plugin`：被懒加载的业务模块，需在同一 workspace 中存在并构建正常。
    - `@coze-arch/coze-design`：图标与设计系统。
    - `classnames`：当前实现中未使用，但保留以便未来需要组合 className 时复用；如长期未用可按团队规范清理。
  - peerDependencies：
    - `react`、`react-dom` 均要求 `>=18.2.0`，实际运行由宿主应用提供，不在本包内直接安装。

## 4. 项目约定与编码风格

- 文件结构简洁：
  - src/index.ts：只做导出聚合，不写任何逻辑，保持入口简单稳定。
  - src/registry.tsx：承载全部逻辑，便于 IDE/业务同学快速理解该子包行为。
- 代码风格：
  - 使用 TypeScript + React 18 函数组件风格；本包没有状态组件，仅在 `renderContent` / `renderIcon` 中返回 JSX。
  - 统一 Apache-2.0 版权头部，新增源码文件时应复制相同头注释格式。
  - 遵循 `@coze-arch/eslint-config` 规则，避免在本包内定义与全局冲突的 lint 配置。
- 命名约定：
  - `PluginWidgetRegistry` 明确表意为「插件区域 widget 注册信息」，不要随意更名；如果需要注册额外 widget，建议使用相似命名模式（例如 `XxxWidgetRegistry`）并在 src/index.ts 中按需导出。
  - Layout 区域枚举与匹配规则尽量保持语义化（`MAIN_PANEL` + `/plugin/.*`），修改时先与框架/产品对齐含义。

## 5. 与其它子包和外部系统的集成

- 与 `@coze-project-ide/framework` 的集成：
  - `WidgetRegistry` 类型：定义了 IDE 识别 widget 所需的最小结构（match/area/renderContent/renderIcon 等），本包填充具体实现。
  - `LayoutPanelType.MAIN_PANEL`：指示该 widget 渲染在主面板，具体布局行为由框架控制，本包不直接操作 DOM 布局。
  - `withLazyLoad`：
    - 框架提供的高阶组件，用于封装动态 import；典型签名为 `withLazyLoad<T>(loader: () => Promise<{ default: React.ComponentType<T> }>)`。
    - 本包不应替换为自定义懒加载逻辑，以免丢失框架内置的 loading/error 行为与埋点。
- 与 `@coze-project-ide/biz-plugin` 的集成：
  - `import('@coze-project-ide/biz-plugin/main')`：
    - 假定 `@coze-project-ide/biz-plugin` 暴露 main 入口，该组件即为实际业务插件主页面。
    - 若 main 入口变更（文件名 / 导出方式），应优先在 biz-plugin 包中维持兼容导出，而非在适配层中做复杂分支判断。
- 与设计系统的协作：
  - `IconCozPlugin` 来源于 `@coze-arch/coze-design/icons`，其视觉样式与产品统一规范同步；如需切换不同图标，优先从同一 icon 集中选择。

## 6. 开发与协作注意事项

- 变更影响面：
  - 尽管本包代码量极少，但直接影响 Project IDE 中「插件」路由的呈现行为；任何对 `match`、`area` 或懒加载路径的改动，都可能导致插件入口失效或出现在错误区域。
  - 在修改前建议：
    - 搜索 workspace 中所有对 `@coze-project-ide/biz-plugin-registry-adapter` 的引用，确认使用方式；
    - 在 IDE 宿主应用中手动验证 `/plugin/...` 路由是否能正常打开插件页面。
- 扩展场景建议：
  - 如需新增更多插件入口（例如区分不同插件类型或子路由），推荐在上层框架或 biz-plugin 包内进行路由细分，本包保持只匹配整体 `/plugin/...`；
  - 若确实需要在适配层区分，可以：
    - 增加多个 `WidgetRegistry` 实例（例如不同行为的 registry），并在 src/index.ts 中导出数组由框架统一注册；
    - 或扩展 `match` 为更精确的正则，但一定要确保与框架预期匹配逻辑一致。
- 不要在本包中做的事情：
  - 不进行任何数据请求、权限判断或业务状态管理；这些逻辑应在 `@coze-project-ide/biz-plugin` 或更上层应用中完成。
  - 不直接操作浏览器路由或 DOM，仅通过 WidgetRegistry 声明式描述「在何处、渲染什么」。

## 7. 本子包的特殊点与区别性特征

- 极薄适配层：
  - 本包明确设计为「最薄适配层」，将 Project IDE 框架与具体业务插件解耦；后续若需要接入更多业务子系统，可按本模式新增小型适配包，而不是在框架或业务包内部硬编码路径。
- build 为 no-op：
  - 与 workflow 系列很多包类似，`build` 脚本为 `exit 0`，构建完全由 monorepo 顶层接管；AI 在这里不应单独引入打包工具或输出目录。
- 强依赖 workspace 结构：
  - `@coze-project-ide/biz-plugin` 与 `@coze-project-ide/framework` 都是 workspace:* 依赖，意味着本包随整个前端仓库一同演进；
  - 修改 TS references 或依赖版本时，应同步检查对应包的 tsconfig/build 配置，避免破坏 Rush 的增量构建链路。
