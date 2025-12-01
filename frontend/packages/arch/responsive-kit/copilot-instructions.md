# copilot-instructions

本说明用于指导 AI 编程助手在本子包（frontend/packages/arch/responsive-kit）中安全、高效地协作开发。

## 总览与架构

- 子包定位：React + Tailwind 风格的响应式布局与媒体查询工具库，服务于上层 @coze-arch 前端产品做多端屏幕适配。
- 入口文件：[src/index.tsx](src/index.tsx)，集中导出常量、hooks、布局组件及类型定义，是其他包唯一推荐的导入入口。
- 核心能力拆分：
  - 屏幕断点与 token 定义：[src/constant.ts](src/constant.ts)。
  - 响应式 token Map 类型工具：[src/types.ts](src/types.ts)。
  - 媒体查询 hooks：[src/hooks/media-query.ts](src/hooks/media-query.ts)。
  - 带响应式列/间距的列表与容器组件：[src/components/layout](src/components/layout)。
  - tokenMap → Tailwind class 串的工具函数：[src/utils](src/utils)（当前已使用 tokenMapToStr）。
- 依赖边界：
  - 运行时只依赖 React 与 classnames；其余 @coze-arch/* 属于开发工具链或测试配置。
  - 样式完全依赖 Tailwind 类名 + 少量 Less 覆盖（如移动端强制单列）。
- 设计理念：
  - 用一套 ScreenRange / tokenMap 抽象统一所有“随屏幕变化的数值属性”（如列数、gap），减少各业务手写 media query / Tailwind 组合。
  - hooks 负责“当前是否命中某个屏幕区间”的逻辑，组件只关心数据结构与 className 组装。

## 关键模块与数据流

- 屏幕断点与 tokens（constant）：
  - ScreenRange 枚举：`sm | md | lg | xl | xl1.5 | 2xl`，与 Tailwind 常见断点保持一致并扩展。
  - SCREENS_TOKENS：从 ScreenRange → px 字符串（如 sm → 640px）。
  - SCREENS_TOKENS_2：当前只维护 `xl1.5` 的扩展 token，useMediaQuery 时会合并两者。
  - 对外导出 ScreenRange、SCREENS_TOKENS 供其他模块/调用者使用。
- 响应式 token Map 类型：
  - [src/types.ts](src/types.ts) 定义 `ResponsiveTokenMap<T extends string>`，用于表达 `{ basic?: number; [key in T]?: number }` 这样的“按断点覆盖”的数值映射。
  - [src/constant.ts](src/constant.ts) 中存在同名 `ResponsiveTokenMap`（基于 ScreenRange），导出给常量使用方；注意与泛型版本区分命名空间，避免 import 混淆。
- 媒体查询 hooks：
  - useCustomMediaQuery：
    - 入参：rangeMinPx / rangeMaxPx（字符串，如 '768px'）。
    - 通过 window.matchMedia 动态监听 `(min-width)` / `(max-width)` / 组合表达式，使用 addEventListener('change') 更新内部 `matches` state。
    - 返回布尔值：当前视口宽度是否命中该区间。
  - useMediaQuery：
    - 入参：rangeMin / rangeMax（ScreenRange，可选）。
    - 底层将 SCREENS_TOKENS 与 SCREENS_TOKENS_2 合并为 tokens，映射为 px 后委托给 useCustomMediaQuery。
    - 供上层直接按业务语义（如 { rangeMin: 'md', rangeMax: 'xl' }）使用。
  - 注意：该 hook 默认直接访问 window，SSR 环境需由调用方在浏览器侧调用或做环境判断。
- 布局组件：
  - ResponsiveBox / ResponsiveBox2（[src/components/layout/ResponsiveBox.tsx](src/components/layout/ResponsiveBox.tsx)）：
    - 接收 contents（ReactNode[]）、colReverse、rowReverse、gaps（ResponsiveTokenMap<ScreenRange>）。
    - 通过 Tailwind 的 flex + 断点 class 组合实现方向在不同屏幕的切换：
      - ResponsiveBox 在 sm 前后均为 column，到 md 及以上变为 row。
      - ResponsiveBox2 简化为小屏 column，大屏 row；更偏静态。
    - gaps 通过 tokenMapToStr 转换为 `gap-{breakpoint}-{value}` 类名串注入。
  - ResponsiveList（[src/components/layout/ResponsiveList.tsx](src/components/layout/ResponsiveList.tsx)）：
    - 泛型 List 组件：dataSource + renderItem，支持 emptyContent、footer、自定义 className。
    - gridCols / gridGapXs / gridGapYs 为 ResponsiveTokenMap<ScreenRange>，分别控制 `grid-cols-*`、`gap-x-*`、`gap-y-*` 的断点值。
    - 默认 gridCols={ sm:1, md:2, lg:3, xl:4 }，覆盖大部分常见栅格布局需求。
    - 引入 responsive.module.less 中的 `.grid-cols-1` 样式，配合 `@media (max-width: 640px)` 强制移动端单列。

## 构建、测试与本地开发

- Node / 包管理：项目整体使用 Rush + pnpm 管理，请优先在 monorepo 顶层执行 `rush update` 初始化依赖。
- 本子包 scripts（见 package.json）：
  - `npm run build`：当前实现为 `exit 0`，仅占位，真实打包通常由上层构建体系统一处理；本包主要以源码形式被消费。
  - `npm run lint`：`eslint ./ --cache`，使用 @coze-arch/eslint-config 预设，preset 为 'web'。
  - `npm run test`：`vitest --run --passWithNoTests`，测试配置由 [vitest.config.ts](vitest.config.ts) 委托给 @coze-arch/vitest-config。
  - `npm run test:cov`：在 test 基础上开启 coverage。
- Vitest 配置：
  - [vitest.config.ts](vitest.config.ts) 通过 `defineConfig({ dirname: __dirname, preset: 'web' })` 引用公司统一 web 预设，包括 jsdom 环境、别名和常规快照等规则。
  - 新增测试文件时优先放在 __tests__ 目录，对应源码路径下建立同名子目录（components/hooks/utils）。
- TS 配置：
  - [tsconfig.json](tsconfig.json) 使用 references 指向 tsconfig.build.json / tsconfig.misc.json，整体由上层 @coze-arch/ts-config 驱动；本地单包通常无需独立调整。

## 代码风格与约定

- 代码风格：
  - JS/TS：统一走 @coze-arch/eslint-config 的 web 规则（[eslint.config.js](eslint.config.js)），不要私自增加强约束规则；自定义规则留空或做到“最小补充”。
  - CSS：主要通过 Tailwind 原子类组织布局，配合少量 Less 文件处理 Tailwind 难以覆盖的情况（如极端媒体条件）。
  - import 顺序遵循 ESlint/TSConfig 默认规则，避免循环依赖；公共类型优先从 src/types.ts/constant.ts 导出集中复用。
- 响应式约定：
  - 所有“随断点变化的数值属性”统一用 ResponsiveTokenMap 表达，键为 ScreenRange 枚举值或 'basic'，值为 number（如列数或 spacing 单位）。
  - 通过 tokenMapToStr 工具将 tokenMap 与属性前缀（如 'gap', 'grid-cols', 'gap-x'）拼接成 Tailwind class 串，避免在组件内直接拼字符串。
  - 扩展断点时，应先在 constant 中增加 ScreenRange & SCREENS_TOKENS，再更新 tokenMapToStr 支持逻辑与相关组件默认值，保证一致性。
- React 组件约定：
  - 尽量保持“纯展示 + 轻逻辑”：例如 ResponsiveList 不持有内部 state，仅根据 props 决定 className 与 children 渲染。
  - hooks 负责与浏览器环境交互（如 window.matchMedia），组件中不要重复访问 window；方便后续在 Node/SSR 环境做统一封装。

## 外部依赖与集成

- React / ReactDOM：
  - 作为 peerDependencies（>=18.2.0），上层应用需自行安装；本包不应直接升级主版本，需与整体前端栈保持一致。
- classnames：
  - 用于合并 Tailwind class 与条件式样式，新增组件时统一使用该库，不要自行手写字符串拼接（避免空格/条件判断错误）。
- 内部工具包：
  - @coze-arch/bot-env / @coze-arch/bot-typings 等仅用于测试/构建环境，不要在运行时代码中新增强依赖。
  - 测试/构建配置通过 @coze-arch/vitest-config、@coze-arch/ts-config 统一管理，如需变更测试环境优先修改这些统一配置而不是在本包内硬编码。

## 开发流程与协作建议

- 变更范围控制：
  - 新增/修改 ScreenRange 或 SCREENS_TOKENS 时，一定评估对 useMediaQuery 和所有使用 tokenMapToStr 的组件的影响，保持断点语义清晰且后向兼容。
  - 对 ResponsiveBox / ResponsiveList 的改动需特别注意：这些组件往往被上层广泛复用，避免随意更改默认断点或 className 结构。
- 测试策略：
  - hooks 层：优先使用 Vitest + @testing-library/react-hooks 模拟窗口宽度变化与 matchMedia 行为，验证逻辑分支。
  - 组件层：使用 @testing-library/react 验证根据不同 props 生成的 className 是否符合预期（断点切换、gap 值等）。
- 性能与兼容性：
  - useCustomMediaQuery 当前使用 window.matchMedia + addEventListener('change')，如在旧浏览器需要兼容，建议在统一 polyfill 层处理，而非在组件内部散点处理。
  - 注意 SSR：所有直接访问 window 的逻辑只应在浏览器环境执行；如需要 SSR 兼容，可在调用方加 `typeof window !== 'undefined'` 判断或引入上层提供的环境 hook。

## 不寻常/特别注意事项

- 本包的 build 脚本目前是 no-op，实际构建通常通过 workspace 顶层工具统一完成；AI 助手在修改构建脚本前需确认上游构建流程（rush.json、frontend/下总体配置）。
- 源码导出路径：package.json 的 exports 与 typesVersions 都直接指向 src/* 文件，这意味着：
  - 修改 src 中导出的类型/接口会立即影响到所有消费方；请保持向后兼容或在大改时同步整体依赖链。
  - 不要随意移动/重命名 src 顶层导出文件（index.tsx、constant.ts、types.ts 等），否则会破坏 exports 与 typesVersions 映射。
- hooks 文件使用 .ts 扩展（而非 .tsx），但 index.tsx 仍以 React 组件导出；新增 hooks/组件时注意选择合适扩展名，保持与现有结构一致。
