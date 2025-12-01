# @coze-studio/premium-components-adapter 开发协作说明

本说明用于指导 AI 编程助手在本子包（frontend/packages/studio/premium/premium-components-adapter）中安全、高效地协作开发。

## 子包定位与角色
- 本包对应 Rush 项目 `@coze-studio/premium-components-adapter`，目录为 `frontend/packages/studio/premium/premium-components-adapter`，在 Rush 中标记为 `level-3`。
- 职责：为「高级版 / 付费功能」提供一组 **UI 组件与业务 Hook 适配层**，供 Studio / Agent-IDE 等上层应用以统一接口接入。
- 当前实现以 **空壳/占位实现** 为主（返回空节点、固定值或仅打印日志），强调接口形态稳定，可在后续根据业务逐步替换为真实实现。

## 代码结构与全局架构
- 根入口：[src/index.ts](src/index.ts)
  - 聚合导出：
    - Premium 管理：`useInitOpenPremiumManage`、`usePremiumManageModal`、`PremiumManage`（来自 `components/premium-manage`）。
    - 付费墙：`PremiumPaywallScene`、`useBenefitAvailable`、`usePremiumPaywallModal`（来自 `components/premium-paywall`）。
    - 付费墙 Banner：`useFetchKnowledgeBenefit`、`PremiumPaywallBannerScene`、`PremiumPaywallBanner`（来自 `components/premium-paywall-banner`）。
    - 静态资源：`TelegramImage`、`DiscordImage` SVG 资源，从 `components/premium-manage/assets` 引入并再导出。
  - 该文件定义了「本包对外能力边界」，新增能力优先在此集中导出。
- 类型注入：[src/typings.d.ts](src/typings.d.ts)
  - 通过 `/// <reference types='@coze-arch/bot-typings' />` 引入全局类型，保持与整体架构统一。
- Premium Manage 区域：[src/components/premium-manage](src/components/premium-manage)
  - [index.tsx](src/components/premium-manage/index.tsx)
    - 导出 `useInitOpenPremiumManage`、`usePremiumManageModal`，并提供 `PremiumManage` 组件（当前仅返回空节点）。
    - 结构上作为「Premium 管理弹窗/页面」的统一入口。
  - [use-init-open-premium-manage.ts](src/components/premium-manage/use-init-open-premium-manage.ts)
    - 接收 `{ open: () => void }`，当前实现为空函数，用于后续挂载埋点、预加载等初始化逻辑。
  - [use-premium-manage-modal.tsx](src/components/premium-manage/use-premium-manage-modal.tsx)
    - 返回 `{ node, open, close }` 结构，`node` 为 ReactNode，`open/close` 为操作入口。
    - 当前 `node` 为空节点，`open/close` 为打印 `unImplement void func` 的占位函数。
    - 该模式在 Studio 其他 adapter 中广泛使用：**通过 hook 返回 UI 节点 + 控制方法**，方便调用方自由挂载。
- Premium Paywall 区域：[src/components/premium-paywall](src/components/premium-paywall)
  - [index.tsx](src/components/premium-paywall/index.tsx)
    - 定义 `PremiumPaywallScene` 枚举，列举各类需要触发高级版的业务场景（如新建空间、跨空间复制资源、API 发布等）。
    - `useBenefitAvailable(props)`：当前固定返回 `true`，未来可接入权益检测接口。
    - `usePremiumPaywallModal(props)`：与 `usePremiumManageModal` 相同的 `{ node, open, close }` 模式，目前为占位实现。
- Premium Paywall Banner 区域：[src/components/premium-paywall-banner](src/components/premium-paywall-banner)
  - [index.tsx](src/components/premium-paywall-banner/index.tsx)
    - `PremiumPaywallBannerScene`：区分「知识库」和「Token 消耗」两类场景。
    - `PremiumPaywallBanner(props)`：接收 `scene` 与可选 `knowledgeBenefit{total, used}` 与布局 `center`，当前返回空节点。
  - [use-fetch-knowledge-benefit.ts](src/components/premium-paywall-banner/use-fetch-knowledge-benefit.ts)
    - `useFetchKnowledgeBenefit(props)`：返回 `{ data: { total, used }, loading }`，当前为固定数据与 `loading=false` 占位。
- 资源目录：[src/components/premium-manage/assets](src/components/premium-manage/assets)
  - 包含 Telegram、Discord 图标 SVG，由 `src/index.ts` 统一导出给上层使用。

## 依赖与与外部系统的集成
- 外部架构依赖（均为 workspace 包，仅在 tsconfig 中引用，当前源码基本未直接使用）：
  - `@coze-arch/bot-api`：统一封装的 HTTP / API 客户端，用于与后端服务交互（如获取会员状态、权益信息等）。
  - `@coze-arch/bot-utils`：通用工具方法集合。
  - `@coze-arch/i18n`：国际化工具，用于构建多语言提示、文案。
  - `@coze-arch/idl`：IDL 协议相关工具，可供后续接入强类型 API 定义。
  - `@coze-arch/logger`：埋点与日志上报。
  - `@coze-arch/bot-typings`：通过 typings.d.ts 注入的全局类型定义。
- 第三方库（当前本包源码基本未直接使用，但为未来真实实现预置能力）：
  - `classnames`、`dayjs`、`immer`、`lodash-es`、`query-string`、`zustand` 等，主要用于复杂 UI / 状态管理时的辅助。
- 资源集成
  - SVG 通过构建工具（vite + vite-plugin-svgr）处理，直接作为 React 组件或 URL 引用；本包仅负责重新导出。

## 构建、测试与本地开发
- 顶层前端说明参考：[frontend/README.md](frontend/README.md)。
- Rush / pnpm 管理
  - 安装依赖：在仓库根目录执行 `rush install` 或 `rush update`。
  - 在包内可使用 `rushx <script>` 形式运行脚本（推荐保持与 monorepo 统一）。
- 本子包脚本（package.json）
  - `build`: 当前为 `exit 0`，即**不执行真实构建**，主要用于占位避免 CI 失败；未来如需产物请改为使用统一 rsbuild / vite 配置。
  - `lint`: `eslint ./ --cache`，依赖于根目录配置与 `@coze-arch/eslint-config`。
  - `test`: `vitest --run --passWithNoTests`，允许无测试文件时通过。
  - `test:cov`: 运行单测并生成覆盖率（由 `@coze-arch/vitest-config` 统一配置）。
- TypeScript 配置
  - [tsconfig.build.json](tsconfig.build.json)
    - 继承 `@coze-arch/ts-config/tsconfig.web.json`，统一前端构建规范。
    - `rootDir: ./src`，`outDir: ./dist`，`strictNullChecks` 和 `noImplicitAny` 均开启，要求严格类型。
    - `references` 指向多个基础架构包的 tsconfig.build.json，确保 TS 项目引用图正确。
  - [tsconfig.json](tsconfig.json)
    - 用于 TS 项目引用模式（composite=true），但通过 `exclude: ["**/*"]` 禁止直接从根 TS 编译，仅通过 build 配置产物。

## 项目约定与实现模式
- Adapter 模式
  - 本包作为「Premium 相关能力的 Adapter」，其职责是：
    - 对上：提供稳定的 React Hook / 组件接口（`usePremiumPaywallModal`、`PremiumPaywallBanner` 等）。
    - 对下：在未来接入 `@coze-arch/bot-api` 等基础设施，实现真实的网络请求、状态管理与埋点。
  - 在实现尚不完善时，以**空节点 + 打印日志 + 固定返回值**的形式保持接口不变，便于上游提前集成。
- Hook 返回 UI + 控制句柄
  - `usePremiumManageModal` / `usePremiumPaywallModal`：
    - 统一返回 `{ node, open, close }`，其中 `node` 通常在调用方 JSX 中直接渲染，`open/close` 则在交互逻辑中被调用。
    - 这种模式在整个 Studio / Agent-IDE 中被广泛使用，是项目特有约定，应保持一致。
- Scene 枚举驱动
  - `PremiumPaywallScene`、`PremiumPaywallBannerScene`：
    - 通过枚举集中管理业务场景，避免使用字符串常量散落在各处。
    - 扩展场景时需考虑对齐后端定义与埋点口径，避免随意修改已有枚举值顺序/语义。
- 占位实现约定
  - 占位函数统一打印 `unImplement void func`，便于在控制台追踪未实现路径。
  - `useBenefitAvailable`、`useFetchKnowledgeBenefit` 当前返回固定值，后续替换真实逻辑时注意保持返回结构兼容（类型与字段名不变）。

## 与其他子包的协作关系
- 与 Premium Store Adapter 协作
  - 相关项目：`@coze-studio/premium-store-adapter`（同级目录 `premium-store-adapter`）。
  - 一般模式是：store-adapter 管理数据状态与与后端交互，components-adapter 提供 UI 与交互入口，两者通过 props 或共享 store 进行协作。
- 与 Knowledge / Data 子包协作
  - 例如 `@coze-data/knowledge-modal-adapter`、`@coze-data/knowledge-ide-adapter` 等，通过 `PremiumPaywallBannerScene.Knowledge` 与 `useFetchKnowledgeBenefit` 等接口共享「知识库权益」信息。
- 与全局架构包协作
  - `@coze-arch/bot-api` 实现与后台 Premium 服务的 HTTP 通信。
  - `@coze-arch/i18n` 用于构建可国际化的 Premium 提示文案。
  - `@coze-arch/logger` 和 `@coze-arch/report-events`（间接）可用于上报点击、曝光与转化闭环数据。

## 开发与修改建议（面向 AI 助手）
- 扩展/修改组件或 Hook 时：
  - **保持对外 API 兼容**：
    - 不随意改变 `usePremiumManageModal` / `usePremiumPaywallModal` 返回对象的字段名与类型形态。
    - 若必须调整，请在本文件中明确标注破坏性变更，并同步联动上游调用方（通常在 Studio app 或 Agent-IDE 包内）。
  - **优先在内部实现填充逻辑**：
    - 例如先在 `useBenefitAvailable` 内接入真实判断，而不是改动所有调用点逻辑分支。
- 引入外部依赖：
  - 尽量复用现有架构依赖（bot-api / i18n / logger 等），避免在本包中直接创建新的 HTTP 层或全局状态容器。
- 日志与埋点：
  - 临时调试可以保留 `console.log`，但正式行为应迁移至 `@coze-arch/logger` 或既有埋点体系。

## 项目流程与规范补充
- 代码质量与 CI
  - 整体前端通过 Rush + `rushx lint` / `rushx test` 集成到流水线，所有包遵循统一 ESLint / Vitest 规则。
  - `level-3` 包在 rushx-config 中覆盖率要求为 0，但仍建议在复杂逻辑引入后补充必要单测。
- 分支与提交（来自仓库通用规范）
  - Rush 根配置中定义了统一的版本号提升与 changelog 提交消息（`chore: bump versions [skip ci]` 等），本包应遵循同样的提交格式与版本管理策略。

## 本包的特别特性
- 当前代码量较少，以接口设计与结构约定为主，是「Premium 能力」在前端 Studio 体系中的对外门面。
- 多数实现为占位，可安全地在不影响其他子包的前提下逐步填充逻辑，非常适合由 AI 助手与人工协作迭代。
- 通过枚举 + Hook + Adapter 模式，将 Premium 功能解耦成多个可复用的组件/场景，有利于在 Studio、Agent-IDE、Project-IDE 等多入口中统一体验。