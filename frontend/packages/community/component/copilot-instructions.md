# @coze-community/components 开发协作指南

本说明用于指导 AI 编程助手在本子包（frontend/packages/community/component）中安全、高效地协作开发。

## 总体架构与定位
- 本子包 `@coze-community/components` 是 **社区业务域的可复用 React 组件库**，主要面向「模板/插件市场、搜索与列表场景」。
- 输出面向其他包的统一入口为 [src/index.ts](src/index.ts)，将内部组件按业务语义进行聚合导出，例如：
  - 列表与布局：`InfiniteList`、`ConnectorList` 等。
  - 业务卡片：`TemplateCard`、`PluginCard` 及相关骨架组件、标签组件等。
  - 通用交互：`FavoriteBtn`、`FavoriteIconBtn`、`SubMenuItem`、`OfficialLabel`。
  - 搜索与推荐：`SearchInput` 及其内部推荐浮层逻辑。
  - 业务弹窗：`useUsageModal`（账号付费插件调用量弹窗）。
- 组件大量依赖上层基础设施：
  - UI 套件：`@coze-arch/coze-design`、`@coze-arch/bot-semi`、`@coze-arch/responsive-kit` 等，用于布局、列表、弹窗、表单等。
  - 业务 API：`@coze-studio/api-schema`、`@coze-arch/bot-api`（如 `ProductEntityType`、`PluginConnectorInfo`）。
  - 状态与数据：`@coze-foundation/space-store`（空间信息）、`@coze-common/coze-mitt`（事件）、`zustand`（局部 store，如搜索 Store）。
- 打包与类型：
  - `package.json` 中 `main`/`module` 指向 `dist` 产物，`exports` 将 `src/index.ts` 作为模块入口，并额外开放 `./search-input/*` 子路径，便于深度定制搜索组件。
  - TS 编译配置通过 [tsconfig.build.json](tsconfig.build.json) 扩展统一的 `@coze-arch/ts-config/tsconfig.web.json`，并通过 `references` 将依赖包声明到 TS 项目引用中，保持 monorepo 内的增量编译能力。

## 重要组件与数据流
### 1. InfiniteList（无限列表容器）
- 位置：
  - [src/infinite-list/index.tsx](src/infinite-list/index.tsx)
  - [src/infinite-list/hooks/use-scroll.ts](src/infinite-list/hooks/use-scroll.ts)（滚动加载逻辑）
  - [src/infinite-list/components](src/infinite-list/components)（Empty/Footer 等 UI）
- 功能：
  - 封装了「滚动加载 + 空状态 + 底部加载/重试」能力，可在响应式和非响应式两种模式间切换。
  - 通过 `useScroll` hook 管理 `dataList`、`isLoading`、`noMore`、`isLoadingError` 等状态，并暴露 `mutate/reload/insertData/removeData/getDataList`，透传给父组件（通过 `forwardRef`）。
- 使用要点：
  - 通过 `scrollConf` 提供数据加载函数以及分页参数；`isNeedBtnLoadMore` 控制是滚动触底自动加载还是使用按钮加载。
  - `onChangeState` 在 `dataList` 或 `isLoading` 变化时回调，可用于上层同步加载状态。
  - `isResponsive` 为 `true` 时使用 `ResponsiveList`；否则使用 `@coze-arch/bot-semi` 的 `List` 组件。

### 2. SearchInput（搜索输入 + 推荐浮层）
- 位置：
  - [src/search-input/index.tsx](src/search-input/index.tsx)
  - [src/search-input/search-input-store.ts](src/search-input/search-input-store.ts)
  - [src/search-input/components](src/search-input/components)
- 功能：
  - 基于 `@coze-arch/coze-design/Input` 与业务图标封装的搜索框，带有清空按钮、聚焦高亮、移动端遮罩等效果。
  - 集成「推荐浮层」`RecommendPopover`，结合 `entityType`（如 `ProductEntityType.SaasPlugin`）与内部 `useSearchInputStore` 管理的搜索状态，做推荐/联想搜索展示。
- 关键交互：
  - 通过 `useState` 和 `useSearchInputStore` 管理 `inputValue`、焦点态、输入法组合态等。
  - 聚焦/失焦、点击输入框时控制推荐浮层 `visible`；`popoverVisible` 由 `visible` + 是否有结果/输入内容共同决定。
  - 通过 `useImperativeHandle` 暴露 `setInputValue`，允许父组件以 `ref` 形式控制输入框内容。
  - 对 `defaultValue` 做 `decodeURIComponent` 尝试，兼容 URL 编码参数。

### 3. TemplateCard 系列（模板卡片与复制逻辑）
- 位置：
  - [src/card/template/index.tsx](src/card/template/index.tsx)
  - [src/card/components](src/card/components)
  - [src/card/type.ts](src/card/type.ts)
- 功能：
  - `TemplateCard` 接收 `explore.ProductInfo`，展示模板封面图、标题、描述与用户信息，并提供「复制使用」按钮。 
  - 点击复制时弹出 `DuplicateModal`，允许用户输入新项目名称，并通过 `explore.PublicDuplicateProduct` 在指定空间下创建副本。
- 外部依赖与数据流：
  - 使用 `useSpaceList`（来自 `@coze-foundation/space-store`）获取当前空间列表，默认取第一个空间作为 `space_id`。
  - 调用 `@coze-studio/api-schema.explore.PublicDuplicateProduct` 完成后端复制，成功/失败均通过 `Toast` 反馈。

### 4. ConnectorList（插件连接器头像列表）
- 位置： [src/connector-list/index.tsx](src/connector-list/index.tsx)
- 功能：
  - 接收一组 `PluginConnectorInfo`，按最多 `visibleNum` 个展示平台头像，其余数量 `moreNum` 使用 Tag “+N” 汇总并在 Tooltip 中展开详细列表。
  - 使用 `CozAvatar`、`Tag`、`Tooltip`、`Typography.Text` 构建 UI，强调「多平台、多连接器」场景的可用性。

### 5. useUsageModal（账号付费插件调用量弹窗）
- 位置： [src/usage-invoke/use-usage-modal.tsx](src/usage-invoke/use-usage-modal.tsx)
- 功能：
  - `useUsageModal({ entity_id })` 返回 `{ node, open, close }`：
    - `node`：需由调用方插入到 JSX 中的 `Modal` 组件。
    - `open/close`：控制弹窗显隐。
  - 打开时通过 `ahooks/useRequest` 调用 `explore.PublicGetProductCallInfo` 拉取账号调用量信息，并在弹窗中展示：账号信息、订阅版本、调用次数（含进度标签）、QPS 等。
- 约定：
  - 使用 `ready: visible` + `refreshDeps` 控制请求时机，仅在可见时触发请求；避免不必要的网络开销。
  - 辅助函数 `getUseRadio` 用于计算已用比例，高于 80% 时显示黄色 Tag 提示。

## 构建、测试与调试流程
- 本子包采用与前端仓库统一的 rsbuild / vite / vitest 体系。

### 安装依赖（全局）
- 在仓库根目录执行：
  - `rush install`：按照 monorepo 规则安装依赖。
  - 如需更新 lockfile / 新增依赖：`rush update`。

### 本子包脚本
- 目录：frontend/packages/community/component
- `package.json` 中重要脚本：
  - `npm run build`：当前实现为 `exit 0`，即 **占位构建脚本**，真正打包多由上层 rsbuild / Rush 任务驱动；如需扩展独立发布流程，可在此接入 rollup 或 rsbuild 脚本（请遵守仓库现有模式）。
  - `npm run lint`：`eslint ./ --cache`，会使用 monorepo 统一的 eslint 配置（`@coze-arch/eslint-config`）。
  - `npm run test`：`vitest --run --passWithNoTests`，使用 [vitest.config.ts](vitest.config.ts) 中定义的 web 预设与 svgr 插件。
  - `npm run test:cov`：在 `test` 基础上附加 `--coverage` 输出覆盖率信息。

### 测试配置
- [vitest.config.ts](vitest.config.ts)：
  - 使用 `@coze-arch/vitest-config.defineConfig`，`preset: 'web'`，统一 web 端测试环境。
  - 注册 `vite-plugin-svgr` 以支持在测试中 import svg 为 React 组件。
  - `test.setupFiles` 指向 [vitest.setup.ts](vitest.setup.ts)，其中引入 `@testing-library/jest-dom/vitest`。
- [tsconfig.misc.json](tsconfig.misc.json)：
  - 为 `__tests__`、`stories`、`vitest.*` 等文件提供 TS 支持，`types` 包含 `vitest/globals` 与 `@testing-library/jest-dom`。

### 调试建议
- 开发时主要通过被上层应用引用来调试：
  - 在 `apps/coze-studio` 或其他使用该组件库的应用中引入 `@coze-community/components`，运行 `rushx dev`，在页面上验证交互。
- 组件级调试：
  - 优先采用 Vitest + React Testing Library 进行交互测试，尤其是包含异步/浮层逻辑的组件（如 `SearchInput`、`InfiniteList`、`useUsageModal`）。

## 项目约定与风格
### 代码风格
- 全部使用 TypeScript + React 18，函数组件 + Hooks 为主：
  - 使用 `React.FC` 或直接函数组件 + `forwardRef`，尽量避免类组件。
  - 状态管理优先使用 `useState/useEffect/useRef/useImperativeHandle` 等原生 Hooks，必要时使用 `zustand` 做跨组件共享（如搜索 Store）。
- 样式：
  - 普遍使用 `*.module.less` + `classnames/cls`，类名遵守现有 BEM-ish / utility 混合写法，如 `styles.template`、`styles['template-wrapper']`。
  - 避免直接写全局样式，公共样式/主题统一交给 `@coze-arch/coze-design` 与 Tailwind 原子类（如 `w-[110px]`）。

### 国际化与文案
- 文案国际化依赖 `@coze-arch/i18n`：
  - 文案 key 如 `I18n.t('copy')`、`I18n.t('creat_project_use_template')`。
  - 新增或修改文案时，请复用已有 key 或在对应 i18n 包中新增；避免在组件内硬编码业务文案（少数中文占位文本为历史遗留或运营需求）。

### 业务 API 调用
- 统一依赖 `@coze-studio/api-schema` 中的 `explore.*` 命名空间：
  - 例如 `explore.PublicDuplicateProduct`、`explore.PublicGetProductCallInfo`、`explore.product_common.ProductEntityType`。
- 类型信息从 `@coze-arch/bot-api` 相关模块获取，如 `ProductEntityType`、`PluginConnectorInfo`、`UserLevel`。
- 网络请求多通过 `ahooks/useRequest` 或业务封装的 hooks 调用：
  - 注意 `ready`、`refreshDeps` 等参数控制请求的生命周期，避免无意义的轮询或在组件未挂载时发请求。

### 状态与 Store 约定
- `SearchInput` 使用局部 store：
  - `useSearchInputStore` 封装在同目录 [search-input-store.ts](src/search-input/search-input-store.ts)，建议在同一组件树中统一使用该 store，以避免多个搜索框间状态冲突。
- 业务级空间信息统一通过 `@coze-foundation/space-store` 的 hook，如 `useSpaceList`。

## 与其他包的集成关系
- 本子包被视作「社区业务组件层」，处于以下关系中：
  - 上层应用：`frontend/apps/coze-studio` 中的社区/市场页面将直接消费这些组件。
  - 平级/依赖层：大量依赖 `arch` / `foundation` / `studio` 等包提供的基础能力和 UI。
- 常见引用方式：
  - 通用组件：`import { InfiniteList, TemplateCard, SearchInput } from '@coze-community/components';`
  - 深度定制搜索：`import { SearchInput } from '@coze-community/components/search-input';`（利用 `exports['./search-input/*']` 开放的深路径）。

## 测试与质量要求（本包视角）
- 由于整个前端仓库采用统一的 Vitest/ESLint 规范，本包新增代码应遵循：
  - 保证类型完备（避免 `any`，使用显式接口定义，例如 `InfiniteListProps<T>`）。
  - 复杂组件（含异步请求、浮层、滚动加载）建议补充对应单元测试或交互测试。
  - 遵守 lint 规则（尤其是 import 顺序、hook 依赖与复杂度限制）；对于确有必要的复杂函数，可以使用 `/* eslint-disable complexity */`，但应尽量控制范围与频率。

## 版本管理与发布（本包参与方式）
- 版本字段：`package.json.version` 当前为 `0.0.1`，版本演进由仓库整体发布流程（Rush + changelog）统一管理。
- 本包的 `files` 中仅导出 `dist` 与 `README.md`，意味着：
  - 发布到 npm/内部 registry 时仅包含构建产物与说明文件。
  - 如需对外暴露更多资源（如类型声明、样式等），需同步更新 `files` 与构建流程。

## 开发注意事项与特殊点
- `build` 脚本目前为 `exit 0`：
  - 不要误以为这是构建失败；这是在 monorepo 中将构建职责交给统一任务的约定。
  - 如需要在本包单独本地调试构建流程，可以临时修改 `build` 脚本，但提交代码前应恢复或与团队约定新的规范化方案。
- SVG 处理：
  - 测试与开发中通过 `vite-plugin-svgr` 支持 `import Icon from './icon.svg';` 的 React 组件用法，新增 SVG 时按现有模式放置与引用即可。
- 性能与体验：
  - 列表相关组件优先考虑懒加载、分页与占位骨架（如 `TemplateCardSkeleton`），避免一次性渲染大量节点。
  - 与移动端/响应式场景相关时，可利用 `@coze-arch/responsive-kit` 的能力，并遵循 `isResponsive`、`useResponsive` 等已有 prop 语义。

---

以上内容主要覆盖了 `@coze-community/components` 的架构、数据流、依赖与开发约定，可作为 AI 编程助手在本子包进行日常开发、重构与调试时的参考。